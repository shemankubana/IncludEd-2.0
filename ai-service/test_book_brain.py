import os
import json
from dotenv import load_dotenv

# Load .env file
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

from ml_pipeline.book_brain import BookBrain
from services.gemini_service import GeminiService

def test_character_descriptions():
    brain = BookBrain()
    
    # Mock some units for a simple story
    content = " ".join([
        "Tommy was a brave little mouse.",
        "\"I love the pond,\" said Tommy.",
        "\"The water is clear,\" replied Lily.",
        "\"Watch out for the cat,\" whispered Tommy.",
        "\"I see Carl,\" shouted Lily.",
        "\"Where is Mrs. Puddle?\" asked Tommy.",
        "\"She is near the pond,\" murmured Lily.",
        "\"Let's go there,\" added Tommy.",
        "\"I am coming,\" thought Lily.",
        "\"Be careful,\" said Tommy.",
        "\"I will,\" replied Lily.",
        "\"The tree is tall,\" whispered Tommy.",
        "\"I can see the nest,\" shouted Lily.",
        "\"Is it safe?\" asked Tommy.",
        "\"Yes,\" murmured Lily.",
        "\"Good,\" added Tommy.",
        "\"I am flying,\" thought Lily."
    ])
    
    units = [
        {
            "title": "Chapter 1",
            "children": [
                {
                    "title": "Opening",
                    "content": content
                }
            ]
        }
    ]
    
    print("🚀 Running BookBrain analysis...")
    result = brain.analyze(units, doc_type="novel", title="Test Story")
    
    print("\n📊 Character Analysis Results:")
    for char in result.characters:
        print(f"Name: {char['name']} ({char['importance']})")
        print(f"Description: {char['description'] or 'MISSING'}")
        print("-" * 20)

    # Check if ANY major/minor character has a description
    has_desc = any(char['description'] for char in result.characters if char['importance'] in ['major', 'minor'])
    if has_desc:
        print("\n✅ SUCCESS: Character descriptions generated!")
    else:
        print("\n❌ FAILURE: No descriptions generated.")

if __name__ == "__main__":
    test_character_descriptions()
