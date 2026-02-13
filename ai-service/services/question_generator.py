import re
import random
import spacy
import nltk
from nltk.corpus import stopwords
from typing import List, Dict

# Download required data
try:
    nltk.data.find('corpora/stopwords')
except LookupError:
    nltk.download('stopwords')

class FreeQuestionGenerator:
    def __init__(self):
        try:
            self.nlp = spacy.load("en_core_web_sm")
        except:
            import os
            os.system("python -m spacy download en_core_web_sm")
            self.nlp = spacy.load("en_core_web_sm")
        
        self.stop_words = set(stopwords.words('english'))
    
    def generate(self, content: str, count: int = 10) -> List[Dict]:
        """Generate questions using NLP and templates"""
        doc = self.nlp(content[:3000])  # Limit to first 3000 chars
        
        questions = []
        
        # 1. Named Entity Recognition questions
        questions.extend(self._generate_ner_questions(doc))
        
        # 2. Main idea questions
        questions.extend(self._generate_main_idea_questions(content))
        
        # 3. Detail questions
        questions.extend(self._generate_detail_questions(doc))
        
        # 4. Vocabulary questions
        questions.extend(self._generate_vocabulary_questions(doc))
        
        # 5. Inference questions
        questions.extend(self._generate_inference_questions(content))
        
        # Shuffle and return requested count
        random.shuffle(questions)
        return questions[:count]
    
    def _generate_ner_questions(self, doc) -> List[Dict]:
        """Generate questions about named entities (characters, places)"""
        questions = []
        entities = [(ent.text, ent.label_) for ent in doc.ents]
        
        # Group by type
        persons = [e[0] for e in entities if e[1] == 'PERSON']
        places = [e[0] for e in entities if e[1] in ['GPE', 'LOC']]
        
        if persons:
            # Create character question
            correct = random.choice(persons)
            distractors = self._generate_distractors(correct, persons, 3)
            
            questions.append({
                "question": f"Who is a main character mentioned in this passage?",
                "options": [correct] + distractors,
                "correctAnswer": 0,
                "explanation": f"{correct} is mentioned as a character in the text.",
                "difficulty": "easy"
            })
        
        if places:
            correct = random.choice(places)
            distractors = self._generate_location_distractors(3)
            
            questions.append({
                "question": "Where does this scene take place?",
                "options": [correct] + distractors,
                "correctAnswer": 0,
                "explanation": f"The passage mentions {correct} as the setting.",
                "difficulty": "easy"
            })
        
        return questions
    
    def _generate_main_idea_questions(self, content: str) -> List[Dict]:
        """Generate main idea questions"""
        # Extract first few sentences
        sentences = re.split(r'[.!?]+', content)[:5]
        
        # Common themes in literature
        themes = [
            "love and relationships",
            "conflict and resolution",
            "character development",
            "moral choices",
            "social criticism",
            "coming of age",
            "power and corruption",
            "identity and belonging"
        ]
        
        question = {
            "question": "What is the main theme of this passage?",
            "options": random.sample(themes, 4),
            "correctAnswer": 0,
            "explanation": f"The passage primarily explores {themes[0]}.",
            "difficulty": "medium"
        }
        
        return [question]
    
    def _generate_detail_questions(self, doc) -> List[Dict]:
        """Generate specific detail questions"""
        questions = []
        
        # Find verb phrases
        verbs = [token.text for token in doc if token.pos_ == 'VERB']
        
        if verbs:
            verb = random.choice(verbs)
            questions.append({
                "question": f"What action is described in the passage?",
                "options": [
                    f"Characters {verb}",
                    "Nothing happens",
                    "Only dialogue occurs",
                    "Setting is described"
                ],
                "correctAnswer": 0,
                "explanation": f"The text describes characters who {verb}.",
                "difficulty": "easy"
            })
        
        return questions
    
    def _generate_vocabulary_questions(self, doc) -> List[Dict]:
        """Generate vocabulary questions"""
        questions = []
        
        # Find interesting words (longer, less common)
        interesting_words = [
            token.text for token in doc 
            if len(token.text) > 6 
            and token.pos_ in ['NOUN', 'VERB', 'ADJ']
            and token.text.lower() not in self.stop_words
        ]
        
        if interesting_words:
            word = random.choice(interesting_words)
            
            # Simple synonym/definition matching
            questions.append({
                "question": f"What does '{word}' most likely mean in this context?",
                "options": [
                    self._get_simple_definition(word),
                    "the opposite meaning",
                    "a place",
                    "a person's name"
                ],
                "correctAnswer": 0,
                "explanation": f"Based on context, '{word}' refers to {self._get_simple_definition(word)}.",
                "difficulty": "medium"
            })
        
        return questions
    
    def _generate_inference_questions(self, content: str) -> List[Dict]:
        """Generate inference questions"""
        questions = [
            {
                "question": "What can you infer about the characters' relationships?",
                "options": [
                    "They have complex interactions",
                    "They never speak to each other",
                    "They are all enemies",
                    "They are all strangers"
                ],
                "correctAnswer": 0,
                "explanation": "The text suggests complex character relationships through dialogue and actions.",
                "difficulty": "hard"
            },
            {
                "question": "What is the mood or tone of this passage?",
                "options": [
                    self._detect_tone(content),
                    "completely neutral",
                    "purely factual",
                    "only humorous"
                ],
                "correctAnswer": 0,
                "explanation": f"The language and word choice create a {self._detect_tone(content)} tone.",
                "difficulty": "medium"
            }
        ]
        
        return questions
    
    def _detect_tone(self, text: str) -> str:
        """Simple tone detection"""
        text_lower = text.lower()
        
        if any(word in text_lower for word in ['dark', 'fear', 'death', 'tragic']):
            return "serious and somber"
        elif any(word in text_lower for word in ['love', 'joy', 'happy', 'beauty']):
            return "romantic and hopeful"
        elif any(word in text_lower for word in ['anger', 'fight', 'conflict']):
            return "tense and dramatic"
        else:
            return "thoughtful and reflective"
    
    def _get_simple_definition(self, word: str) -> str:
        """Generate simple definition"""
        # Very basic - in production would use WordNet
        return f"a related concept or action"
    
    def _generate_distractors(self, correct: str, pool: List[str], count: int) -> List[str]:
        """Generate plausible wrong answers"""
        distractors = [p for p in pool if p != correct]
        
        # Add generic distractors if not enough
        generic = ["The narrator", "A minor character", "An unnamed person", "Someone else"]
        distractors.extend(generic)
        
        return random.sample(distractors, min(count, len(distractors)))
    
    def _generate_location_distractors(self, count: int) -> List[str]:
        """Generate location distractors"""
        locations = [
            "A distant city",
            "The countryside",
            "A castle",
            "The forest",
            "A village",
            "The capital"
        ]
        return random.sample(locations, count)
    
    def generate_fallback(self, content: str, count: int) -> List[Dict]:
        """Simple fallback questions"""
        return [
            {
                "question": "What is this passage primarily about?",
                "options": [
                    "Character development and relationships",
                    "Pure description of setting",
                    "Only factual information",
                    "Mathematical concepts"
                ],
                "correctAnswer": 0,
                "explanation": "Literary passages focus on characters and their development.",
                "difficulty": "easy"
            },
            {
                "question": "What literary element is most prominent?",
                "options": [
                    "Dialogue and character interaction",
                    "Scientific facts",
                    "Mathematical formulas",
                    "Historical dates"
                ],
                "correctAnswer": 0,
                "explanation": "Literature emphasizes dialogue and character development.",
                "difficulty": "medium"
            }
        ][:count]