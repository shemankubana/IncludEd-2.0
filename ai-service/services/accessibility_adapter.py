import os
from anthropic import Anthropic
from openai import OpenAI

class AccessibilityAdapter:
    def __init__(self):
        self.anthropic_key = os.getenv('ANTHROPIC_API_KEY')
        self.openai_key = os.getenv('OPENAI_API_KEY')
        
        if self.anthropic_key:
            self.client = Anthropic(api_key=self.anthropic_key)
            self.provider = 'anthropic'
        elif self.openai_key:
            self.client = OpenAI(api_key=self.openai_key)
            self.provider = 'openai'
        else:
            self.provider = 'fallback'
    
    async def adapt_text(self, text: str, level: str = "accessible") -> str:
        """
        Adapt literary text for students with learning differences
        """
        if self.provider == 'fallback':
            return self._simple_adaptation(text)
        
        prompt = f"""You are an educational accessibility specialist adapting literature for students with dyslexia, ADHD, and other learning differences.

Original text:
{text[:3000]}  # Limit to first 3000 chars

Adapt this text following these guidelines:
1. MAINTAIN the original meaning and literary quality
2. SIMPLIFY complex sentence structures (break into shorter sentences)
3. REPLACE archaic words with modern equivalents (keep some flavor)
4. ADD paragraph breaks every 3-4 sentences
5. KEEP character names and dialogue structure
6. USE active voice where possible
7. DEFINE difficult words in parentheses on first use

Example:
Original: "Wherefore art thou Romeo? Deny thy father and refuse thy name."
Adapted: "Why are you Romeo? Leave your family and change your name."

Return ONLY the adapted text, no explanations."""

        try:
            if self.provider == 'anthropic':
                response = self.client.messages.create(
                    model="claude-sonnet-4-20250514",
                    max_tokens=4000,
                    messages=[{"role": "user", "content": prompt}]
                )
                return response.content[0].text
            
            elif self.provider == 'openai':
                response = self.client.chat.completions.create(
                    model="gpt-4-turbo-preview",
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=4000
                )
                return response.choices[0].message.content
        
        except Exception as e:
            print(f"AI adaptation error: {e}")
            return self._simple_adaptation(text)
    
    def _simple_adaptation(self, text: str) -> str:
        """Fallback adaptation without AI"""
        # Simple rule-based adaptations
        adapted = text
        
        # Add paragraph breaks
        sentences = adapted.split('. ')
        paragraphs = []
        for i in range(0, len(sentences), 4):
            paragraph = '. '.join(sentences[i:i+4])
            paragraphs.append(paragraph)
        adapted = '\n\n'.join(paragraphs)
        
        # Common archaic word replacements
        replacements = {
            'thou': 'you',
            'thee': 'you',
            'thy': 'your',
            'thine': 'yours',
            'art': 'are',
            'dost': 'do',
            'doth': 'does',
            'hath': 'has',
            'wherefore': 'why',
            'whence': 'from where',
            'hither': 'here',
            'thither': 'there'
        }
        
        for old, new in replacements.items():
            adapted = adapted.replace(f' {old} ', f' {new} ')
        
        return adapted