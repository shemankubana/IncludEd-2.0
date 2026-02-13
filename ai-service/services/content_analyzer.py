import re

class ContentAnalyzer:
    def analyze_reading_level(self, text: str) -> dict:
        """
        Analyze text complexity
        """
        words = text.split()
        sentences = re.split(r'[.!?]+', text)
        
        avg_word_length = sum(len(w) for w in words) / len(words) if words else 0
        avg_sentence_length = len(words) / len(sentences) if sentences else 0
        
        # Flesch-Kincaid Grade Level approximation
        grade_level = (
            0.39 * avg_sentence_length +
            11.8 * (sum(self._count_syllables(w) for w in words) / len(words)) -
            15.59
        )
        
        return {
            "word_count": len(words),
            "sentence_count": len(sentences),
            "avg_word_length": round(avg_word_length, 2),
            "avg_sentence_length": round(avg_sentence_length, 2),
            "grade_level": max(1, min(12, round(grade_level, 1))),
            "complexity": self._categorize_complexity(grade_level)
        }
    
    def _count_syllables(self, word: str) -> int:
        """Rough syllable count"""
        word = word.lower()
        count = 0
        vowels = "aeiouy"
        previous_was_vowel = False
        
        for char in word:
            is_vowel = char in vowels
            if is_vowel and not previous_was_vowel:
                count += 1
            previous_was_vowel = is_vowel
        
        if word.endswith('e'):
            count -= 1
        if count == 0:
            count = 1
        
        return count
    
    def _categorize_complexity(self, grade_level: float) -> str:
        if grade_level < 6:
            return "elementary"
        elif grade_level < 9:
            return "middle_school"
        else:
            return "high_school"