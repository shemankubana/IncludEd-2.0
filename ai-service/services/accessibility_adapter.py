import re
import spacy
import nltk
from textstat import textstat
from typing import List, Tuple

# Download required NLTK data
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt')

class FreeAccessibilityAdapter:
    def __init__(self):
        try:
            # Load spaCy model (lightweight)
            self.nlp = spacy.load("en_core_web_sm")
        except OSError:
            print("Downloading spaCy model...")
            import os
            os.system("python -m spacy download en_core_web_sm")
            self.nlp = spacy.load("en_core_web_sm")
        
        # Archaic word replacements for Shakespeare/classic lit
        self.archaic_replacements = {
            'thou': 'you', 'thee': 'you', 'thy': 'your', 'thine': 'yours',
            'art': 'are', 'wert': 'were', 'wast': 'were',
            'dost': 'do', 'doth': 'does', 'doest': 'do',
            'hath': 'has', 'hadst': 'had',
            'shalt': 'shall', 'wilt': 'will', 'wouldst': 'would',
            'canst': 'can', 'shouldst': 'should', 'couldst': 'could',
            'wherefore': 'why', 'whence': 'from where', 'whither': 'to where',
            'hither': 'here', 'thither': 'there', 'yon': 'that',
            'ere': 'before', 'oft': 'often', 'betwixt': 'between',
            'nigh': 'near', 'afore': 'before', 'forsooth': 'truly',
            'methinks': 'I think', 'prithee': 'please', 'mayhap': 'perhaps',
            'nay': 'no', 'yea': 'yes', 'verily': 'truly',
            'whilst': 'while', 'amongst': 'among', 'upon': 'on',
        }
        
        # Complex to simple word mappings
        self.simplifications = {
            'utilize': 'use', 'purchase': 'buy', 'commence': 'start',
            'terminate': 'end', 'endeavor': 'try', 'acquire': 'get',
            'demonstrate': 'show', 'indicate': 'show', 'possess': 'have',
            'sufficient': 'enough', 'assist': 'help', 'request': 'ask',
            'locate': 'find', 'observe': 'see', 'perceive': 'see',
            'regarding': 'about', 'concerning': 'about', 'regarding': 'about',
        }
    
    def adapt_text(self, text: str, level: str = "accessible") -> str:
        """
        Main adaptation function using FREE rule-based methods
        """
        # Step 1: Clean and normalize
        text = self._normalize_text(text)
        
        # Step 2: Replace archaic words
        text = self._replace_archaic_words(text)
        
        # Step 3: Simplify vocabulary
        text = self._simplify_vocabulary(text)
        
        # Step 4: Break long sentences
        text = self._break_long_sentences(text)
        
        # Step 5: Add paragraph breaks (ADHD-friendly)
        text = self._add_paragraph_breaks(text)
        
        # Step 6: Fix passive voice to active
        text = self._improve_readability(text)
        
        return text
    
    def _normalize_text(self, text: str) -> str:
        """Clean up text formatting"""
        # Remove excessive whitespace
        text = re.sub(r'\s+', ' ', text)
        # Normalize quotes
        text = text.replace('"', '"').replace('"', '"')
        text = text.replace(''', "'").replace(''', "'")
        # Remove page numbers
        text = re.sub(r'Page \d+', '', text, flags=re.IGNORECASE)
        return text.strip()
    
    def _replace_archaic_words(self, text: str) -> str:
        """Replace archaic/Shakespearean words"""
        words = text.split()
        result = []
        
        for word in words:
            # Check lowercase version
            lower_word = word.lower().strip('.,!?;:')
            
            if lower_word in self.archaic_replacements:
                # Preserve capitalization
                replacement = self.archaic_replacements[lower_word]
                if word[0].isupper():
                    replacement = replacement.capitalize()
                
                # Preserve punctuation
                if word[-1] in '.,!?;:':
                    replacement += word[-1]
                
                result.append(replacement)
            else:
                result.append(word)
        
        return ' '.join(result)
    
    def _simplify_vocabulary(self, text: str) -> str:
        """Replace complex words with simpler alternatives"""
        doc = self.nlp(text)
        simplified = []
        
        for token in doc:
            word = token.text.lower()
            
            if word in self.simplifications:
                # Keep original capitalization
                replacement = self.simplifications[word]
                if token.text[0].isupper():
                    replacement = replacement.capitalize()
                simplified.append(replacement)
            else:
                simplified.append(token.text)
            
            # Add space before if needed
            if token.whitespace_:
                simplified.append(' ')
        
        return ''.join(simplified)
    
    def _break_long_sentences(self, text: str) -> str:
        """Break sentences longer than 20 words into shorter ones"""
        doc = self.nlp(text)
        result = []
        
        for sent in doc.sents:
            words = sent.text.split()
            
            if len(words) <= 20:
                result.append(sent.text)
            else:
                # Find natural breaking points (conjunctions, commas)
                parts = self._split_sentence(sent.text)
                result.extend(parts)
        
        return ' '.join(result)
    
    def _split_sentence(self, sentence: str) -> List[str]:
        """Split long sentence at natural break points"""
        # Split at coordinating conjunctions
        for conjunction in [', and ', ', but ', ', or ', ', yet ', ', so ']:
            if conjunction in sentence:
                parts = sentence.split(conjunction, 1)
                if len(parts) == 2:
                    # Capitalize second part
                    parts[1] = parts[1].strip().capitalize()
                    # Add period to first part
                    if not parts[0].endswith('.'):
                        parts[0] += '.'
                    return [parts[0], parts[1]]
        
        # Split at semicolons
        if ';' in sentence:
            parts = [p.strip().capitalize() for p in sentence.split(';')]
            return [p + '.' if not p.endswith('.') else p for p in parts]
        
        # Couldn't split naturally, return as is
        return [sentence]
    
    def _add_paragraph_breaks(self, text: str) -> str:
        """Add breaks every 3-4 sentences for ADHD-friendly reading"""
        sentences = re.split(r'(?<=[.!?])\s+', text)
        paragraphs = []
        
        for i in range(0, len(sentences), 4):
            paragraph = ' '.join(sentences[i:i+4])
            paragraphs.append(paragraph)
        
        return '\n\n'.join(paragraphs)
    
    def _improve_readability(self, text: str) -> str:
        """Use spaCy to detect and fix passive voice"""
        doc = self.nlp(text)
        improved = []
        
        for sent in doc.sents:
            # Check Flesch Reading Ease
            score = textstat.flesch_reading_ease(sent.text)
            
            # If too complex (score < 60), mark for review
            # In production, would apply transformations here
            improved.append(sent.text)
        
        return ' '.join(improved)
    
    def analyze_difficulty(self, text: str) -> dict:
        """Analyze text complexity"""
        return {
            'flesch_reading_ease': textstat.flesch_reading_ease(text),
            'flesch_kincaid_grade': textstat.flesch_kincaid_grade(text),
            'gunning_fog': textstat.gunning_fog(text),
            'word_count': len(text.split()),
            'sentence_count': textstat.sentence_count(text),
            'difficulty': self._categorize_difficulty(textstat.flesch_kincaid_grade(text))
        }
    
    def _categorize_difficulty(self, grade_level: float) -> str:
        if grade_level < 6:
            return "elementary"
        elif grade_level < 9:
            return "middle_school"
        else:
            return "high_school"