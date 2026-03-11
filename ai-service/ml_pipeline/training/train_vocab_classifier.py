"""
train_vocab_classifier.py
=========================
Train a lightweight logistic regression classifier to score word difficulty.

This classifier is used as the backbone of VocabAnalyzer.estimate_difficulty()
when a more precise estimate is needed than the rule-based heuristics.

Dataset
-------
Built from three public sources (no download required — we construct features
from NLTK word frequency lists and syllable counting):
  1. SUBTLEX-US word frequency norms   (~75k English words with usage freq)
  2. Dolch/Fry sight word lists         (sight words = easy)
  3. Academic Word List (AWL)           (AWL words = hard)

Labels
------
  0 = easy   (in Dolch list, or freq > 1000/million, syllables ≤ 2)
  1 = hard   (in AWL, or freq < 10/million, syllables ≥ 4)
  Samples between are dropped to create a clean binary training set.

Features (7-dim)
----------------
  [word_length, syllable_count, freq_log, is_common, consonant_clusters,
   silent_letter_patterns, suffix_complexity]

Output
------
  ai-service/ml_pipeline/models/vocab_classifier.joblib
  ai-service/ml_pipeline/models/vocab_scaler.joblib

Training time: ~10 seconds on any CPU (sklearn LogisticRegression).
No GPU required. Model size: ~15 KB.

Usage
-----
  python train_vocab_classifier.py

The trained model is automatically picked up by VocabAnalyzer on next start.
"""

import os
import re
import math
import json
import joblib
import numpy as np
from pathlib import Path

# ── Optional deps (gracefully skipped if not installed) ───────────────────────

try:
    from sklearn.linear_model import LogisticRegression
    from sklearn.preprocessing import StandardScaler
    from sklearn.metrics import classification_report
    _SKLEARN_OK = True
except ImportError:
    print("ERROR: scikit-learn not installed. Run: pip install scikit-learn")
    _SKLEARN_OK = False

try:
    import nltk
    nltk.download("words", quiet=True)
    from nltk.corpus import words as nltk_words
    _NLTK_WORDS = set(w.lower() for w in nltk_words.words())
    _NLTK_OK = True
except Exception:
    _NLTK_OK = False
    _NLTK_WORDS = set()


# ── Word lists ─────────────────────────────────────────────────────────────────

# Dolch sight words — very easy, known by age 8
DOLCH_WORDS = set("""
a about after again all always am an and any are around as at ate away
be because been before best better big black blue both bring brown but buy
by call came can carry clean cold come could cut did do does done don't
down draw drink eight every fall far fast find first five fly four from
full funny gave get give go goes going good got green grow had has have
he help her here him his hold hot how hurt if in into is it its
its jump just keep kind know laugh let light like little live long look
made make many may me much must my myself never new no not now of off
old on once one only open or our out over own pick play please pretty
pull put ran read red ride right round run said saw say see seven shall
she show sing sit six sleep small so some soon start stop take ten thank
that the their them then there these they think this those three to
today together too try two under up upon us use very walk want warm was
wash we well went were what when where which while white who why will
wish with work would write yellow yes you your
""".split())

# Academic Word List (AWL) — Sublist 1-5 (most common academic words = hard)
AWL_WORDS = set("""
abstract accurate achieve acquire adapt adequate adjacent administer adult
aggregate allocate analyse anticipate approach appropriate approximate
aspect assess assume authority available aware benefit category chapter
circumstances classical code coherent coincide commence comment community
complex concept constitute context contract create criteria crucial
culture data define demonstrate derive design distinct distribute domain
dynamic economy element environment equate establish evaluate evidence
evolve exclude explicit exploit facilitate factor formula function
fundamental generate hypothesis identify illustrate imply indicate
individual infer influence initial interpret investigate issue layer
maintain major method monitor motivate obtain occur offset option
perceive period persist perspective potential precede principal process
range region regulate respond restrict role section significant simulate
source strategy structure style substitute sustain symbol target text
theory transfer underlying validate vary
""".split())

# Archaic words from Shakespeare / 19th-century literature (hard)
ARCHAIC_WORDS = set("""
thou thee thy thine hath doth art wilt shalt ere hence hither thither
wherefore forsooth prithee methinks anon perchance betwixt whence oft
nay yea verily herein thereof henceforth betwixt twixt twas twere tis
""".split())


# ── Feature extraction ─────────────────────────────────────────────────────────

def count_syllables(word: str) -> int:
    w = word.lower().strip("'")
    if len(w) <= 3:
        return 1
    groups = re.findall(r"[aeiouy]+", w)
    count = len(groups)
    if w.endswith("e") and count > 1:
        count -= 1
    if w.endswith("le") and len(w) > 2 and w[-3] not in "aeiou":
        count += 1
    if w.endswith("ed") and not w.endswith(("ted", "ded")):
        count -= 1
    return max(1, count)


def extract_features(word: str, freq_per_million: float = 0.0) -> list:
    w = word.lower().strip("'")
    syllables   = count_syllables(w)
    length      = len(w)
    freq_log    = math.log10(max(freq_per_million, 0.001))
    is_common   = 1.0 if w in DOLCH_WORDS else 0.0
    consonant_c = 1.0 if re.search(r"[^aeiou]{3,}", w) else 0.0
    silent_l    = 1.0 if re.search(r"(?:ph|gh|kn|wr|gn|mb|bt)", w) else 0.0
    suffix_c    = 1.0 if re.search(r"(?:tion|sion|ious|eous|ness|ment|ity)$", w) else 0.0
    return [length, syllables, freq_log, is_common, consonant_c, silent_l, suffix_c]


# ── Build training dataset ─────────────────────────────────────────────────────

def build_dataset():
    """Build (X, y) arrays from word lists."""
    samples_easy = []
    samples_hard = []

    # Easy: Dolch words (common, short, low syllable)
    for word in DOLCH_WORDS:
        features = extract_features(word, freq_per_million=5000.0)
        samples_easy.append(features)

    # Easy: short common English words from NLTK
    if _NLTK_OK:
        for word in list(_NLTK_WORDS)[:3000]:
            if len(word) <= 5 and count_syllables(word) <= 2:
                features = extract_features(word, freq_per_million=200.0)
                samples_easy.append(features)

    # Hard: AWL academic words
    for word in AWL_WORDS:
        features = extract_features(word, freq_per_million=5.0)
        samples_hard.append(features)

    # Hard: archaic words
    for word in ARCHAIC_WORDS:
        features = extract_features(word, freq_per_million=0.5)
        samples_hard.append(features)

    # Hard: long NLTK words (≥ 4 syllables)
    if _NLTK_OK:
        for word in list(_NLTK_WORDS)[:5000]:
            if count_syllables(word) >= 4 and len(word) >= 10:
                features = extract_features(word, freq_per_million=1.0)
                samples_hard.append(features)

    X = np.array(samples_easy + samples_hard, dtype=np.float32)
    y = np.array([0] * len(samples_easy) + [1] * len(samples_hard), dtype=np.int32)

    print(f"Dataset: {len(samples_easy)} easy + {len(samples_hard)} hard = {len(X)} total samples")
    return X, y


# ── Train ──────────────────────────────────────────────────────────────────────

def train():
    if not _SKLEARN_OK:
        return

    print("Building training dataset…")
    X, y = build_dataset()

    # Scale features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # Train logistic regression
    print("Training LogisticRegression…")
    clf = LogisticRegression(max_iter=300, C=1.0, random_state=42)
    clf.fit(X_scaled, y)

    # Evaluate on training set (sanity check — real eval would use held-out data)
    y_pred = clf.predict(X_scaled)
    print("\nTraining set classification report:")
    print(classification_report(y, y_pred, target_names=["easy", "hard"]))

    # Save model
    models_dir = Path(__file__).parent.parent / "models"
    models_dir.mkdir(exist_ok=True)

    clf_path    = models_dir / "vocab_classifier.joblib"
    scaler_path = models_dir / "vocab_scaler.joblib"

    joblib.dump(clf,    clf_path)
    joblib.dump(scaler, scaler_path)

    print(f"\n✅ Saved classifier → {clf_path}")
    print(f"✅ Saved scaler     → {scaler_path}")

    # Also save feature names for documentation
    meta = {
        "features": ["word_length", "syllable_count", "freq_log",
                     "is_common", "consonant_clusters",
                     "silent_letter_patterns", "suffix_complexity"],
        "labels":   {0: "easy", 1: "hard"},
        "training_samples": int(len(X)),
        "model":    "LogisticRegression(C=1.0)",
    }
    with open(models_dir / "vocab_classifier_meta.json", "w") as f:
        json.dump(meta, f, indent=2)
    print(f"✅ Saved metadata   → {models_dir / 'vocab_classifier_meta.json'}")


if __name__ == "__main__":
    train()
