"""
train_model.py
==============
Generates synthetic data and trains a TF-IDF + Logistic Regression model
for Literature Classification (Play vs. Novel).

Run once to generate 'classifier_v1.joblib' in ai-service/models/.
"""

import os
import joblib
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score

# ── Synthetic Data Generator ───────────────────────────────────────────────────

def generate_synthetic_data(samples_per_class=200):
    """
    Creates a synthetic dataset of Play vs. Novel snippets.
    
    Plays: Character cues in ALL CAPS, stage directions in brackets, short lines.
    Novels: Long prose, dialogue tags (said, replied), first person 'I'.
    """
    data = []
    labels = []

    # Play templates (labels: 0)
    play_snippets = [
        "HAMLET: To be, or not to be, that is the question.",
        "MACBETH: Is this a dagger which I see before me?",
        "[Enter GHENT and LADY MACBETH]",
        "ROMEO: But, soft! what light through yonder window breaks?",
        "JULIET: O Romeo, Romeo! wherefore art thou Romeo?",
        "(Exit MALCOLM and DONALBAIN)",
        "SCENE I. A desert place. Thunder and lightning.",
        "ACT II. SCENE 2. CAPULET'S orchard.",
        "FIRST WITCH: When shall we three meet again?",
        "DRAMATIS PERSONAE: HAMLET, Prince of Denmark.",
        "HORATIO. Friends to this ground and liegemen to the Dane.",
        "OPHELIA. My lord, as I was sewing in my closet,",
    ]

    # Novel templates (labels: 1)
    novel_snippets = [
        "It was the best of times, it was the worst of times, it was the age of wisdom.",
        "I walked through the village, my heart heavy with dread and anticipation.",
        "\"You cannot be serious,\" she said, setting down her cup of tea.",
        "The great fish moved silently through the night water, propelled by short sweeps.",
        "It was a bright cold day in April, and the clocks were striking thirteen.",
        "Mr. Utterson the lawyer was a man of a rugged countenance that was never lighted by a smile.",
        "He said nothing for a long time, staring into the fire as the embers collapsed.",
        "Chapter 1. The Boy Who Lived. Mr. and Mrs. Dursley, of number four, Privet Drive.",
        "Call me Ishmael. Some years ago—never mind how long precisely—having little or no money.",
        "The sun shone, having no alternative, on the nothing new.",
        "In a hole in the ground there lived a hobbit. Not a nasty, dirty, wet hole.",
        "The building was on fire, and it wasn’t my fault.",
    ]

    for _ in range(samples_per_class):
        # Add random play snippet
        data.append(np.random.choice(play_snippets))
        labels.append("play")
        
        # Add random novel snippet
        data.append(np.random.choice(novel_snippets))
        labels.append("novel")

    return data, labels

# ── Training Pipeline ──────────────────────────────────────────────────────────

def train():
    print("🧪 Generating synthetic literature dataset...")
    X, y = generate_synthetic_data(500)  # 1000 total samples
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    print("🧠 Feature engineering (TF-IDF)...")
    vectorizer = TfidfVectorizer(
        ngram_range=(1, 2),
        max_features=2000,
        stop_words='english'
    )
    
    X_train_vec = vectorizer.fit_transform(X_train)
    X_test_vec = vectorizer.transform(X_test)

    print("🚀 Training Logistic Regression model...")
    model = LogisticRegression(C=1.0, random_state=42)
    model.fit(X_train_vec, y_train)

    # Evaluation
    y_pred = model.predict(X_test_vec)
    accuracy = accuracy_score(y_test, y_pred)
    print(f"\n✅ Model trained. Accuracy: {accuracy:.4f}")
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred))

    # Save artifacts
    output_dir = os.path.join(os.path.dirname(__file__), "../models")
    os.makedirs(output_dir, exist_ok=True)
    
    model_path = os.path.join(output_dir, "classifier_v1.joblib")
    vectorizer_path = os.path.join(output_dir, "vectorizer_v1.joblib")
    
    joblib.dump(model, model_path)
    joblib.dump(vectorizer, vectorizer_path)
    
    print(f"\n💾 Model saved to: {model_path}")
    print(f"💾 Vectorizer saved to: {vectorizer_path}")

if __name__ == "__main__":
    train()
