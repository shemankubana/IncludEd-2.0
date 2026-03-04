"""
train_model.py
==============
Generates synthetic data and trains a TF-IDF + Logistic Regression classifier
for literature type detection: play | novel | generic.

Supports English AND French content (Rwanda CBC curriculum).

Run from ai-service/:
    python -m ml_pipeline.train_model

Or directly:
    cd ai-service && python ml_pipeline/train_model.py
"""

import os
import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score
import random
random.seed(42)


# ── Synthetic Training Data ────────────────────────────────────────────────────

_PLAY_EN = [
    "HAMLET: To be, or not to be, that is the question.",
    "MACBETH: Is this a dagger which I see before me, the handle toward my hand?",
    "[Enter GHOST and HAMLET]\nHAMLET: Angels and ministers of grace defend us!",
    "ROMEO: But, soft! what light through yonder window breaks?",
    "JULIET: O Romeo, Romeo! wherefore art thou Romeo?",
    "(Exit MALCOLM and DONALBAIN, severally)",
    "SCENE I. A desert place. Thunder and lightning. Enter three Witches.",
    "ACT II. SCENE 2. CAPULET's orchard. ROMEO appears below.",
    "FIRST WITCH: When shall we three meet again in thunder, lightning, or in rain?",
    "DRAMATIS PERSONAE: HAMLET, Prince of Denmark. CLAUDIUS, King of Denmark.",
    "HORATIO: Friends to this ground and liegemen to the Dane.",
    "OPHELIA: My lord, as I was sewing in my closet, Lord Hamlet with his doublet all unbraced.",
    "ACT III. SCENE 1. A room in the castle.\nKING: And can you, by no drift of circumstance,",
    "IAGO: I am not what I am.\nOTHELLO: What dost thou mean?",
    "PROSPERO: Thou poisonous slave, got by the devil himself!",
    "[Aside] ANTONIO: I am right glad that he's so out of hope.",
    "SCENE IV. Another part of the forest. Enter TOUCHSTONE and AUDREY.",
    "CAST OF CHARACTERS:\nROSALIND, daughter to the banished Duke.\nCELIA, daughter to Frederick.",
    "ACT I, SCENE 1. Before Prospero's cell. MIRANDA: If by your art, my dearest father,",
    "BRUTUS: There is a tide in the affairs of men, Which, taken at the flood, leads on to fortune.",
    "(Enter LADY MACBETH, reading a letter)\nLADY MACBETH: They met me in the day of success.",
    "FALSTAFF: The better part of valour is discretion.\n[Exeunt, running]",
    "ACT V. SCENE 3. A churchyard. Enter PARIS, and his Page, with flowers and a torch.",
    "PUCK: Lord, what fools these mortals be!\n[Sprinkles fairy dust]",
    "SHYLOCK: Hath not a Jew eyes? hath not a Jew hands, organs, dimensions, senses?",
]

_PLAY_FR = [
    "ACTE I. SCÈNE 1. Une salle dans la maison de Monsieur Jourdain.",
    "ORGON: Mon Dieu! Quel homme! Quelle bonté! Quelle vertu!",
    "ELMIRE: Nous vivons sous un maître absolu dont les volontés n'ont point de loi.",
    "TARTUFFE: Couvrez ce sein que je ne saurais voir.",
    "(TARTUFFE entre, apercevant ELMIRE)",
    "ACTE II. SCÈNE 4. Le même. Entre VALÈRE.",
    "LISTE DES PERSONNAGES:\nTARTUFFE, faux dévot.\nORGON, chef de famille.",
    "SCÈNE 2. ALCESTE: Je veux qu'on soit sincère, et qu'en homme d'honneur.",
    "CÉLIMÈNE: Vos soins ne font que me contrarier.",
    "[CÉLIMÈNE sort, ALCESTE la suit du regard]",
    "PERSONNAGES:\nHARPAGON, père d'Élise et de Cléante.\nÉLISE, fille d'Harpagon.",
    "ACTE III. SCÈNE 5. La scène est dans le salon de CÉLIMÈNE.",
    "HARPAGON: Sans dot! sans dot! Il n'y a rien de tel pour couper court aux discours.",
    "(À part) CLEANTE: Mon père est le plus avare des hommes.",
    "ACTE I. SCÈNE 1. — Une chambre chez FIGARO et SUZANNE.",
    "FIGARO: Cinq pieds deux pouces, il se lève, chante en se mesurant.",
    "SUZANNE: Je t'attendais, Figaro le Barbier.",
    "ACTE V. SCÈNE DERNIÈRE. La comtesse paraît voilée.",
    "BEAUMARCHAIS: Personnages de la comédie. LE COMTE ALMAVIVA.",
    "Il entre en scène. SCÈNE 3. Le Mariage de Figaro.",
]

_NOVEL_EN = [
    "It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness.",
    "I walked through the village, my heart heavy with dread and anticipation.",
    "\"You cannot be serious,\" she said, setting down her cup of tea.",
    "The great fish moved silently through the night water, propelled by short sweeps of its crescent tail.",
    "It was a bright cold day in April, and the clocks were striking thirteen.",
    "Mr. Utterson the lawyer was a man of a rugged countenance that was never lighted by a smile.",
    "He said nothing for a long time, staring into the fire as the embers collapsed.",
    "Chapter 1. The Boy Who Lived. Mr. and Mrs. Dursley, of number four, Privet Drive.",
    "Call me Ishmael. Some years ago, never mind how long precisely, having little or no money.",
    "The sun shone, having no alternative, on the nothing new. Murphy sat out of it.",
    "In a hole in the ground there lived a hobbit. Not a nasty, dirty, wet hole.",
    "The building was on fire, and it wasn't my fault. Well, not really.",
    "Chapter 3. In my younger and more vulnerable years my father gave me some advice.",
    "CHAPTER FIVE. The old man sat alone in the last booth. He was very tired.",
    "She whispered his name into the darkness, hoping he could still hear her.",
    "Part Two: The Journey. The road stretched endlessly before them, grey and featureless.",
    "I replied that I was getting along fine, though in truth I was miserable.",
    "The boy asked the old fisherman about the sea, and the old man smiled.",
    "Chapter 10. Atticus said to Jem one day, 'I'd rather you shot at tin cans in the back yard.'",
    "He murmured her name once, twice, before sleep claimed him entirely.",
    "PROLOGUE. Long ago and far away, in a kingdom by the sea, there lived a princess.",
    "Part I: Childhood. When I was nine years old, my mother left and never came back.",
    "Chapter 22. The whale surfaced again at dawn, and the sailors cried out in fear.",
    "I shouted across the water, but the boat was already too far away.",
    "EPILOGUE. Years later, when asked what he remembered most, he always said: the light.",
]

_NOVEL_FR = [
    "Chapitre 1. Longtemps, je me suis couché de bonne heure.",
    "Il répondit qu'il ne savait pas, qu'il avait oublié les détails.",
    "Nous étions dans la grande salle quand la nouvelle arriva.",
    "CHAPITRE IV. Le lendemain matin, Emma ne se leva pas.",
    "Partie II: La Chute. Les événements se précipitèrent dès lors.",
    "Elle murmura son prénom, une fois, deux fois, dans l'obscurité.",
    "CHAPITRE X. Julien Sorel regardait la plaine avec un sentiment de mélancolie.",
    "Il dit à voix basse qu'il ne reviendrait plus.",
    "La vieille femme marchait lentement le long du chemin bordé d'arbres.",
    "PARTIE III. Le voyage était long et fatigant, la route poussiéreuse.",
    "Chapitre 15. Madame Bovary soupira et regarda par la fenêtre.",
    "Il demanda si elle était heureuse, et elle répondit qu'elle ne savait pas.",
    "Le père Goriot cria son nom dans le vide de la chambre.",
    "PROLOGUE. Il était une fois, dans un royaume lointain, une jeune princesse.",
    "Chapitre 2. Jean Valjean marcha toute la nuit sans se retourner.",
]

_GENERIC = [
    "The process of photosynthesis converts light energy into chemical energy stored in glucose.",
    "To solve for x, multiply both sides of the equation by the denominator.",
    "World War I began in 1914 following the assassination of Archduke Franz Ferdinand.",
    "The mitochondria is often referred to as the powerhouse of the cell.",
    "Instructions: Complete the following exercises in your workbook before class.",
    "Definition: A prime number is a natural number greater than 1 with no divisors other than 1 and itself.",
    "The water cycle describes how water evaporates, condenses, and precipitates.",
    "In mathematics, a function is a relation between a set of inputs and a set of permissible outputs.",
    "Rwanda achieved independence from Belgium on July 1, 1962.",
    "The sine of an angle in a right triangle is the ratio of the opposite side to the hypotenuse.",
    "Exercise 3: Identify the main idea of each paragraph and write a one-sentence summary.",
    "Bibliography:\n1. Smith, J. (2019). Introduction to Biology. Oxford University Press.",
    "Glossary of Terms. Photosynthesis — the process by which plants convert light into food.",
    "Table of Contents\n1. Introduction ... 3\n2. Background ... 7\n3. Methodology ... 12",
    "Abstract: This paper examines the relationship between diet and cognitive performance.",
    "La photosynthèse est le processus par lequel les plantes fabriquent leur nourriture.",
    "Pour résoudre cette équation, il faut d'abord isoler la variable x.",
    "Le Rwanda a obtenu son indépendance le 1er juillet 1962.",
    "Définition: Un nombre premier est un entier naturel supérieur à 1.",
    "Instructions: Répondez aux questions suivantes dans votre cahier d'exercices.",
]


# ── Training Pipeline ──────────────────────────────────────────────────────────

def generate_synthetic_data(samples_per_class: int = 300):
    """
    Build a balanced dataset: play | novel | generic.
    Augmented by combining 2-4 random snippets per sample for variety.
    """
    X, y = [], []

    for _ in range(samples_per_class):
        # Play: mix English and French samples
        n = random.randint(2, 4)
        pool = _PLAY_EN + _PLAY_FR
        X.append("\n".join(random.sample(pool, min(n, len(pool)))))
        y.append("play")

        # Novel: mix English and French
        pool = _NOVEL_EN + _NOVEL_FR
        X.append("\n".join(random.sample(pool, min(n, len(pool)))))
        y.append("novel")

        # Generic
        pool = _GENERIC
        X.append("\n".join(random.sample(pool, min(n, len(pool)))))
        y.append("generic")

    return X, y


def train():
    print("🧪 Generating synthetic multilingual dataset (play | novel | generic)...")
    X, y = generate_synthetic_data(300)   # 900 total samples
    print(f"   Dataset size: {len(X)} samples ({y.count('play')} play / {y.count('novel')} novel / {y.count('generic')} generic)")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    print("🧠 Feature engineering (TF-IDF unigrams + bigrams)...")
    vectorizer = TfidfVectorizer(
        ngram_range=(1, 2),
        max_features=3000,
        sublinear_tf=True,
        analyzer="word",
    )
    X_train_vec = vectorizer.fit_transform(X_train)
    X_test_vec  = vectorizer.transform(X_test)

    print("🚀 Training Logistic Regression (supports predict_proba)...")
    model = LogisticRegression(
        C=2.0,
        max_iter=500,
        random_state=42,
        multi_class="multinomial",
        solver="lbfgs",
    )
    model.fit(X_train_vec, y_train)

    y_pred   = model.predict(X_test_vec)
    accuracy = accuracy_score(y_test, y_pred)
    print(f"\n✅ Accuracy: {accuracy:.4f}")
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred))

    output_dir = os.path.join(os.path.dirname(__file__), "../models")
    os.makedirs(output_dir, exist_ok=True)

    model_path = os.path.join(output_dir, "classifier_v1.joblib")
    vec_path   = os.path.join(output_dir, "vectorizer_v1.joblib")

    joblib.dump(model,      model_path)
    joblib.dump(vectorizer, vec_path)

    print(f"\n💾 Model saved:      {model_path}")
    print(f"💾 Vectorizer saved: {vec_path}")
    print("\n🎓 Classifier ready for IncludEd AI service (English + French)")


if __name__ == "__main__":
    train()
