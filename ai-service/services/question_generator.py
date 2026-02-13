import re
import random
from typing import List, Dict

class FreeQuestionGenerator:
    def __init__(self):
        # Try to load spaCy for better question generation
        try:
            import spacy
            self.nlp = spacy.load("en_core_web_sm")
            print("✅ spaCy loaded for question generation")
            self.has_spacy = True
        except:
            print("⚠️  spaCy not available, using basic question generation")
            self.nlp = None
            self.has_spacy = False
        
        # Common literature themes for questions
        self.themes = [
            "love and relationships",
            "conflict and resolution", 
            "character development",
            "moral choices",
            "power and ambition",
            "fate vs free will",
            "appearance vs reality",
            "betrayal and loyalty"
        ]
        
        # Literary devices
        self.devices = [
            "metaphor",
            "symbolism",
            "foreshadowing",
            "irony",
            "imagery",
            "dialogue"
        ]
    
    def generate(self, content: str, count: int = 10) -> List[Dict]:
        """
        Generate questions using FREE NLP and templates
        Fast and works offline
        """
        questions = []
        
        # Clean content
        content = self._clean_content(content)
        
        if self.has_spacy and len(content) > 100:
            try:
                # Use spaCy for better questions
                doc = self.nlp(content[:2000])  # Limit to prevent slowdown
                
                # 1. Character questions (from Named Entity Recognition)
                questions.extend(self._generate_character_questions(doc))
                
                # 2. Action/Plot questions (from Verbs)
                questions.extend(self._generate_plot_questions(doc))
                
                # 3. Vocabulary questions
                questions.extend(self._generate_vocabulary_questions(doc))
                
            except Exception as e:
                print(f"⚠️  spaCy processing error: {e}")
        
        # 4. Add general literature questions (always)
        questions.extend(self._generate_general_questions(content))
        
        # 5. Add theme questions
        questions.extend(self._generate_theme_questions())
        
        # 6. Add inference questions
        questions.extend(self._generate_inference_questions(content))
        
        # Shuffle and return requested count
        random.shuffle(questions)
        
        # Ensure we have enough questions
        while len(questions) < count:
            questions.extend(self._generate_fallback_questions(content, 2))
        
        return questions[:count]
    
    def _clean_content(self, text: str) -> str:
        """Remove metadata and clean text"""
        # Remove common PDF artifacts
        text = re.sub(r'Folger Shakespeare Library', '', text, flags=re.IGNORECASE)
        text = re.sub(r'Get even more from the Folger', '', text, flags=re.IGNORECASE)
        text = re.sub(r'Page \d+', '', text)
        text = re.sub(r'FTLN \d+', '', text)
        text = re.sub(r'https?://\S+', '', text)
        text = re.sub(r'\s+', ' ', text)
        return text.strip()
    
    def _generate_character_questions(self, doc) -> List[Dict]:
        """Generate questions about characters using NER"""
        questions = []
        
        # Extract person entities
        persons = [ent.text for ent in doc.ents if ent.label_ == 'PERSON']
        persons = list(set(persons))  # Remove duplicates
        
        if len(persons) >= 1:
            correct = random.choice(persons)
            
            # Generate distractors
            distractors = [p for p in persons if p != correct]
            while len(distractors) < 3:
                distractors.append(random.choice([
                    "The narrator",
                    "A minor character", 
                    "An unnamed person",
                    "Someone else",
                    "The protagonist",
                    "The antagonist"
                ]))
            
            random.shuffle(distractors)
            options = [correct] + distractors[:3]
            random.shuffle(options)
            
            questions.append({
                "question": "Who is a main character mentioned in this passage?",
                "options": options,
                "correctAnswer": options.index(correct),
                "explanation": f"{correct} is mentioned as a character in the text.",
                "difficulty": "easy"
            })
        
        if len(persons) >= 2:
            # Relationship question
            char1, char2 = random.sample(persons, 2)
            questions.append({
                "question": f"What is the relationship between {char1} and {char2}?",
                "options": [
                    "They interact in the story",
                    "They never meet",
                    "They are the same person",
                    "Only one appears in the text"
                ],
                "correctAnswer": 0,
                "explanation": f"Both {char1} and {char2} are mentioned in the passage.",
                "difficulty": "medium"
            })
        
        return questions
    
    def _generate_plot_questions(self, doc) -> List[Dict]:
        """Generate questions about actions/plot"""
        questions = []
        
        # Extract main verbs
        verbs = [token.lemma_ for token in doc if token.pos_ == 'VERB' and len(token.text) > 3]
        verbs = list(set(verbs))[:5]  # Top 5 unique verbs
        
        if verbs:
            main_verb = random.choice(verbs)
            questions.append({
                "question": "What action occurs in this passage?",
                "options": [
                    f"Characters {main_verb}",
                    "Nothing happens",
                    "Only dialogue occurs",
                    "The setting is described"
                ],
                "correctAnswer": 0,
                "explanation": f"The text describes characters who {main_verb}.",
                "difficulty": "easy"
            })
        
        return questions
    
    def _generate_vocabulary_questions(self, doc) -> List[Dict]:
        """Generate vocabulary questions"""
        questions = []
        
        # Find interesting/complex words
        interesting_words = [
            token.text for token in doc 
            if len(token.text) > 7 
            and token.pos_ in ['NOUN', 'VERB', 'ADJ']
            and not token.is_stop
        ]
        
        if interesting_words:
            word = random.choice(interesting_words[:10])  # From first 10
            
            questions.append({
                "question": f"What does '{word}' most likely mean in this context?",
                "options": [
                    "A word related to the story's events",
                    "A type of animal",
                    "A mathematical term",
                    "A scientific concept"
                ],
                "correctAnswer": 0,
                "explanation": f"Based on context, '{word}' relates to the story's events.",
                "difficulty": "medium"
            })
        
        return questions
    
    def _generate_general_questions(self, content: str) -> List[Dict]:
        """Generate general literature questions"""
        questions = []
        
        # Detect if it's dialogue-heavy
        has_dialogue = content.count('"') > 5 or content.count("'") > 5
        
        questions.append({
            "question": "What type of literature is this?",
            "options": [
                "Drama or prose fiction",
                "Scientific article",
                "News report",
                "Technical manual"
            ],
            "correctAnswer": 0,
            "explanation": "This is a work of dramatic or prose literature.",
            "difficulty": "easy"
        })
        
        if has_dialogue:
            questions.append({
                "question": "What literary element is most prominent?",
                "options": [
                    "Dialogue and character interaction",
                    "Scientific data",
                    "Historical facts",
                    "Geographic descriptions"
                ],
                "correctAnswer": 0,
                "explanation": "The passage features significant dialogue between characters.",
                "difficulty": "easy"
            })
        
        return questions
    
    def _generate_theme_questions(self) -> List[Dict]:
        """Generate theme-based questions"""
        theme = random.choice(self.themes)
        other_themes = random.sample([t for t in self.themes if t != theme], 3)
        
        options = [theme] + other_themes
        random.shuffle(options)
        
        return [{
            "question": "What is a major theme in this passage?",
            "options": options,
            "correctAnswer": options.index(theme),
            "explanation": f"The passage explores the theme of {theme}.",
            "difficulty": "medium"
        }]
    
    def _generate_inference_questions(self, content: str) -> List[Dict]:
        """Generate inference questions"""
        questions = []
        
        # Detect tone based on keywords
        tone = self._detect_tone(content)
        
        questions.append({
            "question": "What is the mood or tone of this passage?",
            "options": [
                tone,
                "Completely neutral",
                "Purely humorous",
                "Strictly factual"
            ],
            "correctAnswer": 0,
            "explanation": f"The language and word choice create a {tone} tone.",
            "difficulty": "medium"
        })
        
        questions.append({
            "question": "What can you infer about the characters?",
            "options": [
                "They have complex relationships and emotions",
                "They have no feelings",
                "They are all strangers",
                "They never interact"
            ],
            "correctAnswer": 0,
            "explanation": "Literary passages typically explore complex human relationships.",
            "difficulty": "medium"
        })
        
        return questions
    
    def _detect_tone(self, text: str) -> str:
        """Simple tone detection based on keywords"""
        text_lower = text.lower()
        
        if any(word in text_lower for word in ['death', 'murder', 'tragic', 'sorrow', 'dark']):
            return "serious and somber"
        elif any(word in text_lower for word in ['love', 'joy', 'beauty', 'delight']):
            return "romantic and hopeful"
        elif any(word in text_lower for word in ['anger', 'fight', 'conflict', 'rage']):
            return "tense and dramatic"
        elif any(word in text_lower for word in ['wonder', 'mystery', 'strange']):
            return "mysterious and intriguing"
        else:
            return "thoughtful and reflective"
    
    def _generate_fallback_questions(self, content: str, count: int) -> List[Dict]:
        """Simple fallback questions - always work"""
        questions = [
            {
                "question": "What is this passage primarily about?",
                "options": [
                    "Character development and relationships",
                    "Pure description of objects",
                    "Mathematical formulas",
                    "Scientific experiments"
                ],
                "correctAnswer": 0,
                "explanation": "Literary passages focus on characters and their development.",
                "difficulty": "easy"
            },
            {
                "question": "What makes this a work of literature?",
                "options": [
                    "It tells a story with characters",
                    "It contains only facts",
                    "It has mathematical equations",
                    "It gives technical instructions"
                ],
                "correctAnswer": 0,
                "explanation": "Literature tells stories and explores human experiences.",
                "difficulty": "easy"
            },
            {
                "question": "What is the purpose of this text?",
                "options": [
                    "To entertain and convey human experience",
                    "To teach mathematics",
                    "To explain chemistry",
                    "To give directions"
                ],
                "correctAnswer": 0,
                "explanation": "Literature aims to entertain and explore human experiences.",
                "difficulty": "medium"
            },
            {
                "question": "How should you read this passage?",
                "options": [
                    "Looking for character emotions and story",
                    "Looking only for facts and data",
                    "Looking for scientific formulas",
                    "Looking for technical instructions"
                ],
                "correctAnswer": 0,
                "explanation": "Literature is best understood by focusing on characters and narrative.",
                "difficulty": "easy"
            },
            {
                "question": "What skills does reading this develop?",
                "options": [
                    "Understanding human nature and empathy",
                    "Mathematical calculation",
                    "Scientific analysis",
                    "Computer programming"
                ],
                "correctAnswer": 0,
                "explanation": "Reading literature develops empathy and understanding of human nature.",
                "difficulty": "medium"
            }
        ]
        
        return random.sample(questions, min(count, len(questions)))
    
    def generate_fallback(self, content: str, count: int) -> List[Dict]:
        """Public fallback method for external calls"""
        return self._generate_fallback_questions(content, count)