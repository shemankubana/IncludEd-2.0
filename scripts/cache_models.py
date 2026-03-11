"""
cache_models.py
===============
Pre-download all ML models used by IncludEd 2.0 so the app works offline.

Run this once on a machine with internet access before deploying to a school
without reliable connectivity. All models are cached in ~/.cache/huggingface/

Models downloaded
-----------------
  1. dbmdz/bert-large-cased-finetuned-conll03-english  (~400 MB) — NER
  2. deepset/deberta-v3-base-squad2                     (~180 MB) — Character Q&A
  3. google/flan-t5-base                                (~250 MB) — Quiz + Vocab
  4. en_core_web_sm  (spaCy)                            (~12 MB)  — NER fallback
  5. NLTK corpora (words, punkt, stopwords)             (~30 MB)  — Text processing

Total: ~870 MB on first run. Subsequent runs are instant (cache hit).

Usage
-----
  # From project root (with venv active):
  python scripts/cache_models.py

  # Skip specific models:
  python scripts/cache_models.py --skip-bert --skip-deberta

  # Check what's already cached:
  python scripts/cache_models.py --check-only
"""

import argparse
import sys
import os

# ── CLI args ──────────────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="Pre-cache IncludEd ML models")
parser.add_argument("--skip-bert",    action="store_true", help="Skip BERT NER model")
parser.add_argument("--skip-deberta", action="store_true", help="Skip DeBERTa Q&A model")
parser.add_argument("--skip-flan",    action="store_true", help="Skip FLAN-T5 model")
parser.add_argument("--skip-spacy",   action="store_true", help="Skip spaCy model")
parser.add_argument("--skip-nltk",    action="store_true", help="Skip NLTK corpora")
parser.add_argument("--check-only",   action="store_true", help="Check cache status without downloading")
args = parser.parse_args()


# ── Helpers ───────────────────────────────────────────────────────────────────

def section(title: str):
    print(f"\n{'─' * 50}")
    print(f"  {title}")
    print(f"{'─' * 50}")

def ok(msg: str):    print(f"  ✅  {msg}")
def warn(msg: str):  print(f"  ⚠️   {msg}")
def info(msg: str):  print(f"  ℹ️   {msg}")
def fail(msg: str):  print(f"  ❌  {msg}")

def check_hf_cached(model_id: str) -> bool:
    """Check if a HuggingFace model is already in the local cache."""
    try:
        from huggingface_hub import scan_cache_dir
        cache = scan_cache_dir()
        for repo in cache.repos:
            if repo.repo_id == model_id:
                return True
        return False
    except Exception:
        return False


# ── 1. BERT NER ───────────────────────────────────────────────────────────────

def cache_bert(check_only=False):
    section("1/5  BERT NER  (dbmdz/bert-large-cased-finetuned-conll03-english)")
    model_id = "dbmdz/bert-large-cased-finetuned-conll03-english"

    if check_only:
        status = "CACHED" if check_hf_cached(model_id) else "NOT CACHED"
        info(f"Status: {status}")
        return

    try:
        from transformers import pipeline
        info("Downloading BERT NER model (~400 MB)…")
        _ = pipeline("ner", model=model_id, aggregation_strategy="simple")
        ok("BERT NER cached successfully")
    except Exception as e:
        fail(f"BERT NER failed: {e}")


# ── 2. DeBERTa Q&A ────────────────────────────────────────────────────────────

def cache_deberta(check_only=False):
    section("2/5  DeBERTa Q&A  (deepset/deberta-v3-base-squad2)")
    model_id = "deepset/deberta-v3-base-squad2"

    if check_only:
        status = "CACHED" if check_hf_cached(model_id) else "NOT CACHED"
        info(f"Status: {status}")
        return

    try:
        from transformers import pipeline
        info("Downloading DeBERTa Q&A model (~180 MB)…")
        _ = pipeline("question-answering", model=model_id)
        ok("DeBERTa Q&A cached successfully")
    except Exception as e:
        fail(f"DeBERTa Q&A failed: {e}")


# ── 3. FLAN-T5 ────────────────────────────────────────────────────────────────

def cache_flan(check_only=False):
    section("3/5  FLAN-T5-base  (google/flan-t5-base)")
    model_id = "google/flan-t5-base"

    if check_only:
        status = "CACHED" if check_hf_cached(model_id) else "NOT CACHED"
        info(f"Status: {status}")
        return

    try:
        from transformers import pipeline
        info("Downloading FLAN-T5-base model (~250 MB)…")
        _ = pipeline("text2text-generation", model=model_id, max_new_tokens=200)
        ok("FLAN-T5 cached successfully")
    except Exception as e:
        fail(f"FLAN-T5 failed: {e}")


# ── 4. spaCy ─────────────────────────────────────────────────────────────────

def cache_spacy(check_only=False):
    section("4/5  spaCy  (en_core_web_sm)")

    if check_only:
        try:
            import spacy
            spacy.load("en_core_web_sm")
            info("Status: CACHED")
        except Exception:
            info("Status: NOT CACHED")
        return

    try:
        import spacy
        try:
            spacy.load("en_core_web_sm")
            ok("spaCy en_core_web_sm already installed")
            return
        except OSError:
            pass

        info("Downloading spaCy en_core_web_sm (~12 MB)…")
        import subprocess
        result = subprocess.run(
            [sys.executable, "-m", "spacy", "download", "en_core_web_sm"],
            capture_output=True, text=True
        )
        if result.returncode == 0:
            ok("spaCy en_core_web_sm cached successfully")
        else:
            fail(f"spaCy download failed:\n{result.stderr}")
    except ImportError:
        warn("spaCy not installed — run: pip install spacy")
    except Exception as e:
        fail(f"spaCy failed: {e}")


# ── 5. NLTK corpora ───────────────────────────────────────────────────────────

def cache_nltk(check_only=False):
    section("5/5  NLTK corpora  (words, punkt, stopwords, averaged_perceptron_tagger)")

    CORPORA = ["words", "punkt", "stopwords", "averaged_perceptron_tagger", "punkt_tab"]

    if check_only:
        try:
            import nltk
            for corpus in CORPORA:
                try:
                    nltk.data.find(f"corpora/{corpus}" if corpus not in ("punkt", "punkt_tab", "averaged_perceptron_tagger") else f"tokenizers/{corpus}")
                    info(f"  {corpus}: CACHED")
                except LookupError:
                    info(f"  {corpus}: NOT CACHED")
        except ImportError:
            warn("NLTK not installed")
        return

    try:
        import nltk
        for corpus in CORPORA:
            try:
                info(f"Downloading {corpus}…")
                nltk.download(corpus, quiet=True)
                ok(f"{corpus} cached")
            except Exception as e:
                warn(f"{corpus} failed: {e}")
    except ImportError:
        warn("NLTK not installed — run: pip install nltk")


# ── Summary ───────────────────────────────────────────────────────────────────

def print_summary():
    section("Cache location")
    cache_dir = os.path.expanduser("~/.cache/huggingface/hub")
    if os.path.exists(cache_dir):
        total = sum(
            os.path.getsize(os.path.join(dp, f))
            for dp, _, filenames in os.walk(cache_dir)
            for f in filenames
        )
        ok(f"HuggingFace cache: {cache_dir}")
        ok(f"Total cached size: {total / (1024**3):.2f} GB")
    else:
        info("HuggingFace cache directory not found yet")

    nltk_dir = os.path.expanduser("~/nltk_data")
    if os.path.exists(nltk_dir):
        ok(f"NLTK data: {nltk_dir}")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("=" * 50)
    print("  IncludEd 2.0 — Model Cache Script")
    mode = "CHECK ONLY" if args.check_only else "DOWNLOADING"
    print(f"  Mode: {mode}")
    print("=" * 50)

    if not args.skip_bert:
        cache_bert(args.check_only)

    if not args.skip_deberta:
        cache_deberta(args.check_only)

    if not args.skip_flan:
        cache_flan(args.check_only)

    if not args.skip_spacy:
        cache_spacy(args.check_only)

    if not args.skip_nltk:
        cache_nltk(args.check_only)

    print_summary()

    print(f"\n{'=' * 50}")
    if args.check_only:
        print("  Check complete. Run without --check-only to download.")
    else:
        print("  All models cached. The app can now run offline.")
    print("=" * 50)


if __name__ == "__main__":
    main()
