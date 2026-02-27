import re
from typing import List, Dict, Optional
from .ollama_service import OllamaService

class FreeAccessibilityAdapter:
    def __init__(self):
        # Try to load spaCy, but work without it if needed
        try:
            import spacy
            self.nlp = spacy.load("en_core_web_sm")
            print("✅ spaCy loaded")
        except:
            print("⚠️  spaCy not available, using basic mode")
            self.nlp = None
        
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
        }
        
        self.ollama = OllamaService()
    
    def adapt_text(
        self, 
        text: str, 
        level: str = "accessible",
        disability_profile: Optional[Dict] = None,
        use_llm: bool = True
    ) -> str:
        """
        Main adaptation function. Uses Ollama for quality, falls back to rules for speed.
        """
        if use_llm and self.ollama.is_available():
            try:
                return self.adapt_text_llm(text, level, disability_profile)
            except Exception as e:
                print(f"⚠️  LLM adaptation failed: {e}. Falling back to rules.")
        
        # Step 1: Clean and normalize
        text = self._normalize_text(text)
        
        # Step 2: Replace archaic words
        text = self._replace_archaic_words(text)
        
        # Step 3: Simplify vocabulary
        text = self._simplify_vocabulary(text)
        
        # Step 4: Break long sentences
        text = self._break_long_sentences(text)
        
        # Step 5: Add paragraph breaks
        text = self._add_paragraph_breaks(text)
        
        # Step 6: Apply disability-specific adaptations
        if disability_profile:
            disabilities = disability_profile.get("disabilities", [])
            
            # Dyslexia: Extra spacing
            if "dyslexia" in disabilities:
                text = self._add_extra_spacing(text)
            
            # ADHD: Shorter paragraphs
            if "adhd" in disabilities:
                text = self._shorten_paragraphs(text)
            
            # Visual impairment: Add scene markers
            if "visual_impairment" in disabilities:
                text = self._add_scene_descriptions(text)
        
        return text

    def adapt_text_llm(self, text: str, level: str, disability_profile: Optional[Dict]) -> str:
        """
        Uses Llama 3 to intelligently simplify and adapt educational content.
        """
        disabilities = disability_profile.get("disabilities", []) if disability_profile else []
        
        system_prompt = (
            "You are an expert in accessible education. Your task is to rewrite the provided "
            "educational text to be more accessible for students with diverse learning needs."
        )
        
        prompt = f"""
        REWRITE the following text for a student with these priorities:
        - Target Level: {level}
        - Learning Needs: {', '.join(disabilities) if disabilities else 'General Accessibility'}
        
        GUIDELINES:
        1. Replace complex or archaic words with simple, modern alternatives.
        2. Break down long, complex sentences into shorter, clearer ones.
        3. Maintain the original core meaning and educational facts.
        4. Use a supportive, clear tone.
        5. If 'dyslexia' is present, focus on simple phonics and clear structure.
        6. If 'adhd' is present, focus on conciseness and key takeaways.

        TEXT TO REWRITE:
        {text[:3000]}

        Return ONLY the adapted text. No headers, no conversational filler.
        """
        
        # Note: generate_json is for JSON. Using generate for raw text if available, 
        # but let's see if OllamaService has a generic generate.
        # Actually OllamaService only has generate_json. Let's add generate_text.
        
        return self.ollama.generate(prompt, system_prompt) or text
    
    def _normalize_text(self, text: str) -> str:
        """Clean up text formatting"""
        # Remove excessive whitespace
        text = re.sub(r'\s+', ' ', text)
        # Normalize quotes
        text = text.replace('"', '"').replace('"', '"')
        text = text.replace(''', "'").replace(''', "'")
        # Remove page numbers
        text = re.sub(r'Page \d+', '', text, flags=re.IGNORECASE)
        # Remove metadata
        text = re.sub(r'FTLN \d+', '', text)
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
                if len(word) > 0 and word[0].isupper():
                    replacement = replacement.capitalize()
                
                # Preserve punctuation
                if len(word) > 0 and word[-1] in '.,!?;:':
                    replacement += word[-1]
                
                result.append(replacement)
            else:
                result.append(word)
        
        return ' '.join(result)
    
    def _simplify_vocabulary(self, text: str) -> str:
        """Replace complex words with simpler alternatives"""
        if self.nlp:
            try:
                doc = self.nlp(text[:1000])  # Limit to prevent slowdown
                simplified = []
                
                for token in doc:
                    word = token.text.lower()
                    
                    if word in self.simplifications:
                        replacement = self.simplifications[word]
                        if token.text[0].isupper():
                            replacement = replacement.capitalize()
                        simplified.append(replacement)
                    else:
                        simplified.append(token.text)
                    
                    if token.whitespace_:
                        simplified.append(' ')
                
                return ''.join(simplified) + text[1000:]
            except:
                pass
        
        # Fallback without spaCy
        words = text.split()
        result = []
        for word in words:
            lower = word.lower().strip('.,!?;:')
            if lower in self.simplifications:
                replacement = self.simplifications[lower]
                if word[0].isupper():
                    replacement = replacement.capitalize()
                if word[-1] in '.,!?;:':
                    replacement += word[-1]
                result.append(replacement)
            else:
                result.append(word)
        return ' '.join(result)
    
    def _break_long_sentences(self, text: str) -> str:
        """Break sentences longer than 15 words"""
        sentences = re.split(r'(?<=[.!?])\s+', text)
        result = []
        
        for sent in sentences:
            words = sent.split()
            if len(words) > 15:
                # Try to split at comma + and
                if ', and ' in sent:
                    parts = sent.split(', and ', 1)
                    result.append(parts[0] + '.')
                    result.append(parts[1].strip().capitalize())
                elif '; ' in sent:
                    parts = sent.split('; ', 1)
                    result.append(parts[0] + '.')
                    result.append(parts[1].strip().capitalize())
                else:
                    result.append(sent)
            else:
                result.append(sent)
        
        return ' '.join(result)
    
    def _add_paragraph_breaks(self, text: str) -> str:
        """Add breaks every 4 sentences for better readability"""
        sentences = re.split(r'(?<=[.!?])\s+', text)
        paragraphs = []
        
        for i in range(0, len(sentences), 4):
            paragraph = ' '.join(sentences[i:i+4])
            paragraphs.append(paragraph)
        
        return '\n\n'.join(paragraphs)
    
    def _add_extra_spacing(self, text: str) -> str:
        """Add extra spacing for dyslexia"""
        # Double space after periods
        return text.replace('. ', '.  ')
    
    def _shorten_paragraphs(self, text: str) -> str:
        """Shorter paragraphs for ADHD (every 2 sentences)"""
        sentences = re.split(r'(?<=[.!?])\s+', text)
        paragraphs = []
        
        for i in range(0, len(sentences), 2):
            paragraph = ' '.join(sentences[i:i+2])
            paragraphs.append(paragraph)
        
        return '\n\n'.join(paragraphs)
    
    def _add_scene_descriptions(self, text: str) -> str:
        """Add [SCENE] markers for screen readers"""
        # Simple detection of scene changes
        if 'Enter' in text or 'enter' in text:
            text = "[NEW SCENE] " + text
        return text