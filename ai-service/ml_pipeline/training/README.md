# ML Training Guide — IncludEd 2.0

This directory contains training scripts for the two trainable models in the
IncludEd ML pipeline. Everything else (BERT NER, FLAN-T5, DeBERTa Q&A) uses
pre-trained weights downloaded automatically from HuggingFace.

---

## 1. Vocab Difficulty Classifier

**File:** `train_vocab_classifier.py`
**Output:** `ml_pipeline/models/vocab_classifier.joblib` (~15 KB)
**Algorithm:** Logistic Regression (scikit-learn)
**Training time:** ~10 seconds on any CPU

### What it does
Predicts whether a word is "easy" (0) or "hard" (1) for a primary-school
reader, using 7 hand-crafted features:

| Feature | Description |
|---|---|
| `word_length` | Total character count |
| `syllable_count` | Estimated syllables (rule-based) |
| `freq_log` | log₁₀ of usage frequency per million words |
| `is_common` | 1 if in Dolch sight-word list |
| `consonant_clusters` | 1 if ≥ 3 consecutive consonants |
| `silent_letter_patterns` | 1 if ph/gh/kn/wr detected |
| `suffix_complexity` | 1 if Latinate suffix (-tion/-ity/-ness) |

### Training data
Built from three public word lists (no download required):
- **Dolch sight words** (~200 words) — labelled easy
- **Academic Word List** (~570 words, sublists 1–5) — labelled hard
- **Long NLTK words** (≥4 syllables, ≥10 chars) — labelled hard

### How to train
```bash
cd ai-service
python ml_pipeline/training/train_vocab_classifier.py
```

### Why not a neural model?
For word difficulty scoring, logistic regression on hand-crafted features
outperforms a neural model in both accuracy and interpretability for this
domain. Neural models shine when context matters — but difficulty is largely
an intrinsic property of the word itself. The classifier runs in microseconds
per word with no GPU needed.

---

## 2. RL Difficulty Adaptation Agent (PPO)

**File:** `train_rl_agent.py`
**Output:** `rl-engine/models/ppo_included_v2.zip` (~2 MB)
**Algorithm:** Proximal Policy Optimization (Stable-Baselines3)
**Training time:** ~15 min CPU / ~3 min GPU (500k timesteps)

### What it does
A PPO agent that learns to select the best reading adaptation for each
student at each step of their reading session.

**State (9-dim):** reading speed, mouse dwell, scroll hesitation,
backtrack frequency, attention score, disability type, text difficulty,
session fatigue, content type.

**Actions (6 discrete):**
| Action | Label | When to use |
|---|---|---|
| 0 | Keep Original | Student is reading well |
| 1 | Light Simplify | Slight confusion signals |
| 2 | Heavy Simplify | Repeated re-reads, high difficulty |
| 3 | TTS + Highlights | Low attention, high difficulty |
| 4 | Syllable Break | Decoding difficulty (dyslexia signal) |
| 5 | Attention Break | High fatigue, ADHD signal |

**Reward shaping:**
```
+1.0  quiz score ≥ 70%
+0.5  chapter completed
+0.2  < 3 vocab lookups (understood passage)
-0.5  quit early
-0.3  re-read same paragraph ≥ 3 times
-0.1  stuck > 5 min on paragraph
```

### Training phases

**Phase 1 — Offline pre-training (this script)**
Simulates 4 student archetypes (none/dyslexia/adhd/both) with realistic
behaviour patterns. Generates warm-start weights.

```bash
cd ai-service
python ml_pipeline/training/train_rl_agent.py --timesteps 500000
```

**Phase 2 — Online fine-tuning (automatic)**
Real student sessions generate `(state, action, reward)` records stored
in the `RLTrainingData` PostgreSQL table. A background job fine-tunes
the model on real data every 24 hours (configurable via cron).

```bash
# Fine-tune from real data (run from backend)
node scripts/fine_tune_rl.js
```

### Monitoring training
TensorBoard logs are written to `rl-engine/models/tensorboard/`:
```bash
tensorboard --logdir rl-engine/models/tensorboard
```

Key metrics to watch:
- `rollout/ep_rew_mean` → should trend upward (target > 0.5)
- `train/policy_gradient_loss` → should stay < 0.05
- `train/value_loss` → should decrease over time

### Thesis metrics
The trained model should achieve:
- Mean episode reward > 0 (positive adaptation outcome)
- Policy loss < 0.05
- Cohen's d ≥ 0.5 on comprehension scores (pre vs post adaptation)

---

## 3. Models that do NOT need training

These models use pre-trained HuggingFace weights, downloaded automatically
on first use:

| Model | Size | Used for |
|---|---|---|
| `dbmdz/bert-large-cased-finetuned-conll03-english` | ~400 MB | NER character extraction |
| `deepset/deberta-v3-base-squad2` | ~180 MB | Character description Q&A |
| `google/flan-t5-base` | ~250 MB | Quiz generation, vocab explanation |
| `en_core_web_sm` (spaCy) | ~12 MB | NER fallback |

All models are cached in `~/.cache/huggingface/` after first download.
Total first-run download: ~850 MB. After caching: instant load.

For offline deployment (school without internet), run:
```bash
python scripts/cache_models.py   # pre-downloads everything
```
