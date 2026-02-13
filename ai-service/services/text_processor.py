import re

class TextProcessor:
    def clean_text(self, text: str) -> str:
        """Remove excessive whitespace and format text"""
        # Remove multiple spaces
        text = re.sub(r'\s+', ' ', text)
        # Remove page numbers and headers
        text = re.sub(r'Page \d+', '', text)
        # Normalize quotes
        text = text.replace('"', '"').replace('"', '"')
        return text.strip()
    
    def split_into_sentences(self, text: str) -> list:
        """Split text into sentences"""
        sentences = re.split(r'(?<=[.!?])\s+', text)
        return [s.strip() for s in sentences if s.strip()]
    
    def count_words(self, text: str) -> int:
        """Count words in text"""
        return len(text.split())