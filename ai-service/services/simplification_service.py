"""
simplification_service.py
=========================
Context-aware text simplification for the Highlight-to-Understand feature.

When a student highlights text, this service:
1. Simplifies without destroying literary voice
2. Explains the author's intent
3. Provides vocabulary support with relatable analogies
4. Adjusts explanation level based on student reading profile
5. Detects literary devices (metaphor, irony, foreshadowing, etc.)

2-tier architecture:
  Tier 1: Gemini API (best quality)
  Tier 2: Rule-based (always available)
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

from services.gemini_service import GeminiService


# ── Literary device detection ─────────────────────────────────────────────────

# ── Kinyarwanda cultural bridge ──────────────────────────────────────────────
# Maps Western literary concepts → Rwandan cultural parallels
# Helps students from Rwanda connect unfamiliar ideas to lived experience.

_KINYARWANDA_BRIDGE: Dict[str, str] = {
    # Honour & family
    "honour":        "Like *icyubahiro* (respect) in Rwandan culture — something earned through how you treat others.",
    "honor":         "Like *icyubahiro* (respect) in Rwandan culture — something earned through how you treat others.",
    "noble":         "Think of the *umwami* (king) and the respect shown to community elders.",
    "loyalty":       "Like the loyalty of *inshuti* (close friends) who stand with you no matter what.",
    "clan":          "Similar to *umuryango* — your extended family who share your identity and history.",
    "tribe":         "Like *ubwoko* — the group you belong to that shapes your community ties.",
    # Fate & nature
    "destiny":       "Like *inzira* (the path) — Rwandans believe each person walks a path shaped by God (*Imana*).",
    "fate":          "Similar to the Rwandan idea that *Imana* (God) guides every life's course.",
    "harvest":       "Like the *isarura* — the season when families come together to gather crops from the hills.",
    "drought":       "Like the *inzara* (hunger seasons) that families in rural Rwanda still endure.",
    # Power & conflict
    "tyranny":       "Like oppressive rule — Rwanda's history of *ubukuru bubi* (bad leadership) makes this very real.",
    "exile":         "Like those forced to leave home — many Rwandans know exile from 1959 and 1994.",
    "war":           "Like *intambara* — Rwanda's history makes the weight of war deeply understood.",
    "betrayal":      "Like breaking *amasezerano* (a sworn agreement) — considered deeply shameful.",
    # Social life
    "feast":         "Like an *umuganda* celebration or wedding feast — a gathering of community with food and song.",
    "market":        "Like the *amasoko* — where community members exchange goods and news.",
    "elder":         "Like *umukuru* — the respected voice of wisdom in every Rwandan village.",
    "ancestors":     "Like *imigabane y'ababyeyi* — the legacy and spirit of those who came before.",
    # Love & relationships
    "courtship":     "Like traditional *gusaba* — the formal process of asking a family for their daughter's hand.",
    "jealousy":      "Like *ishyari* — the feeling of wanting what another person has.",
    # Abstract concepts
    "ambition":      "Like *ubushake* (strong desire) — the drive to achieve that many Rwandan students carry.",
    "grief":         "Like *agahinda* — the deep sorrow felt when loss touches a family.",
    "justice":       "Like *ubutabera* and the *gacaca* courts — where truth and community healing meet.",
    "identity":      "Like *indangamuntu* (identity card) — but deeper, who you are inside, your values and story.",
    # Education & learning
    "school":        "Like *ishuri* — a place of growth and opportunity that many Rwandan families sacrifice for.",
    "teacher":       "Like *umwarimu* — a deeply respected figure who shapes the next generation.",
    "student":       "Like *umunyeshuri* — one who works hard today for a better tomorrow.",
    "exam":          "Like *ikizamini* — a test of what you have learned, taken seriously in Rwanda's education system.",
    "knowledge":     "Like *ubumenyi* — the wisdom passed down from elders and gained through study.",
    "learning":      "Like *kwiga* — the lifelong Rwandan value of seeking understanding and growth.",
    # Nature & environment
    "river":         "Like the *Nyabarongo* — Rwanda's largest river, central to life, farming, and history.",
    "mountain":      "Like the *ibirunga* (volcanoes) of the north — awe-inspiring landmarks that shape the land.",
    "forest":        "Like *ishyamba* — forests that many Rwandan families depend on for firewood and food.",
    "rain":          "Like *imvura* — in Rwanda, rain is a blessing that brings green hills to life.",
    "sun":           "Like *izuba* — the sun that rises over a thousand hills every morning.",
    "hill":          "Like the *inkike* (hills) that define Rwanda's famous landscape — *pays des mille collines*.",
    # Community & belonging
    "community":     "Like *umuryango w'abaturage* — the village community that raises every child together.",
    "refugee":       "Like *impunzi* — a word with deep meaning in Rwanda's history of displacement and return.",
    "home":          "Like *urugo* — the family homestead, a sacred place of belonging.",
    "neighbour":     "Like *umuturanyi* — whom Rwandans greet every morning by name.",
    "stranger":      "Like *umunyamahanga* — in Rwandan culture, even strangers deserve hospitality (*ubushyingiro*).",
    # Modern concepts
    "government":    "Like *leta* — the state that many Rwandans have seen transform dramatically since 1994.",
    "democracy":     "Like *demokarasi* — a concept Rwanda works towards through its *Gacaca* and local governance.",
    "city":          "Like *umujyi wa Kigali* — a rapidly growing city that many students dream of reaching one day.",
    "technology":    "Like Rwanda's *Smart Rwanda* vision — a country that has embraced mobile phones and internet.",
    "phone":         "Like the mobile phones that connect *abaturage* (citizens) across Rwanda's hills.",
    # More literary themes
    "power":         "Like *ingufu* — in Rwanda, the abuse of power has deep historical resonance.",
    "freedom":       "Like *ubwigenge* — independence, celebrated every 1st of July in Rwanda.",
    "hope":          "Like *ibyiringiro* — the hope that Rwanda's *Agaciro* (dignity, self-worth) is built upon.",
    "shame":         "Like *isoni* — a powerful feeling in Rwandan culture, tied to community reputation.",
    "pride":         "Like *ikuzo* — the pride Rwandans feel in their culture, resilience, and progress.",
    "courage":       "Like *ubutwari* — praised in Rwandan history as the quality of great leaders and liberators.",
    "loneliness":    "Like *ubusa* — an unusual feeling in a culture where communal ties are deep.",
    "forgiveness":   "Like *imbabazi* — central to Rwanda's post-genocide reconciliation process.",
    "revenge":       "Like *impyisi* (hyena) in Rwandan fables — seeking revenge but ultimately paying the price.",
    "corruption":    "Like *akarengane* — a betrayal of *agaciro* (dignity) that Rwanda actively fights.",
    "sacrifice":     "Like *gutanga* — giving something precious for others; a virtue celebrated in Rwandan songs.",
}



def _get_kinyarwanda_bridge(text: str) -> Optional[str]:
    """Find a Kinyarwanda cultural analogy for concepts in the text."""
    text_lower = text.lower()
    matches = []
    for concept, bridge in _KINYARWANDA_BRIDGE.items():
        if concept in text_lower:
            matches.append(bridge)
    if not matches:
        return None
    # Return the most relevant bridge (first match, keep it short)
    return matches[0]


_DEVICE_PATTERNS = [
    (r"\blike\s+(?:a|an)\s+\w+", "simile", "a comparison using 'like' or 'as'"),
    (r"\bas\s+\w+\s+as\b", "simile", "a comparison using 'like' or 'as'"),
    (r"\bnot\s+\w+\s+but\s+\w+", "antithesis", "contrasting ideas placed side by side"),
    (r"(.)\1{2,}", "repetition", "a word or sound repeated for emphasis"),
    (r"\b(?:O|Oh)\s+[A-Z]", "apostrophe", "addressing someone absent or an abstract idea"),
]

_ARCHAIC_GLOSSARY: Dict[str, str] = {
    "thou": "you", "thee": "you", "thy": "your", "thine": "yours",
    "hath": "has", "doth": "does", "art": "are", "wilt": "will",
    "shalt": "shall", "ere": "before", "hence": "from here / therefore",
    "hither": "to here", "thither": "to there", "wherefore": "why",
    "forsooth": "truly", "prithee": "please", "methinks": "I think",
    "anon": "soon", "perchance": "perhaps", "nay": "no", "yea": "yes",
    "betwixt": "between", "whence": "from where", "oft": "often",
    "ere": "before", "alas": "unfortunately",
}


class SimplificationService:
    """
    Context-aware simplification engine for highlighted text.
    """

    def __init__(self):
        self.gemini = GeminiService()

    def simplify(
        self,
        highlighted_text: str,
        book_title: str = "",
        author: str = "",
        doc_type: str = "generic",
        chapter_context: str = "",
        speaker: str = "",
        reading_level: str = "intermediate",
        language: str = "en",
    ) -> Dict[str, Any]:
        """
        Simplify highlighted text with full context awareness.

        Returns:
            {
                "simple_version": str,
                "author_intent": str,
                "vocabulary": [{word, meaning, analogy}],
                "literary_devices": [{device, explanation}],
                "cultural_context": str | None,
                "tier": "ollama" | "flan_t5" | "rule_based",
            }
        """
        # Primary: Gemini Cloud LLM
        if self.gemini.is_available():
            try:
                result = self._simplify_gemini(
                    highlighted_text, book_title, author, doc_type,
                    chapter_context, speaker, reading_level, language,
                )
                if result and result.get("simple_version"):
                    result["tier"] = "gemini"
                    # Supplement with local assets + Gemini Vocab
                    llm_vocab = self._extract_vocabulary_gemini(highlighted_text, reading_level)
                    rule_vocab = self._extract_vocabulary(highlighted_text)

                    # Merge (LLM takes priority)
                    final_vocab = llm_vocab
                    seen_words = {v["word"].lower() for v in llm_vocab}
                    for rv in rule_vocab:
                        if rv["word"].lower() not in seen_words:
                            final_vocab.append(rv)

                    result["vocabulary"] = final_vocab
                    result["literary_devices"] = self._detect_devices(highlighted_text)
                    if not result.get("kinyarwanda_bridge"):
                        result["kinyarwanda_bridge"] = _get_kinyarwanda_bridge(highlighted_text)
                    return result
            except Exception as e:
                print(f"Gemini simplification failed: {e}")

        # Fallback: Rule-based (always works)
        return self._simplify_rule_based(
            highlighted_text, book_title, author, doc_type,
            speaker, reading_level, language,
        )

    def _simplify_gemini(
        self,
        text: str,
        book_title: str,
        author: str,
        doc_type: str,
        chapter_context: str,
        speaker: str,
        reading_level: str,
        language: str,
    ) -> Dict[str, Any]:
        """Use Gemini for high-performance simplification."""
        level_desc = {
            "beginner": "a 9-year-old Primary 4 (P4) student",
            "intermediate": "a 10-year-old Primary 5 (P5) student",
            "advanced": "an 11-12 year old Primary 6 (P6) student",
        }.get(reading_level, "a 10-year-old Primary 5 student")

        speaker_ctx = f' spoken by the character "{speaker}"' if speaker else ""
        book_ctx = f' from "{book_title}" by {author}' if book_title else ""

        system_instruction = f"You are an expert pedagogical AI specializing in simplifying literature for {level_desc}. You focus on clarity, cultural relevance (Rwanda), and preserving the author's emotional resonance."

        if language == "fr":
            prompt = f"""Analyse ce passage{book_ctx}{speaker_ctx}:

"{text}"

Contexte du chapitre: {chapter_context[:500] if chapter_context else 'Non fourni'}

Réponds en JSON avec exactement ces clés:
{{
  "simple_version": "Version simplifiée (2-3 phrases)",
  "author_intent": "Pourquoi l'auteur a écrit cela ainsi",
  "cultural_context": "Contexte culturel si pertinent, sinon null",
  "kinyarwanda_bridge": "Analogie culturelle rwandaise — compare avec un concept rwandais (imigabane, umuganda, icyubahiro, etc.)",
  "vocabulary": [
    {{"word": "string", "meaning": "définition simple pour un enfant", "analogy": "comparaison simple", "category": "ex: Archaïque, Vocabulaire, Métaphore"}}
  ]
}}"""
        else:
            prompt = f"""Analyze this passage{book_ctx}{speaker_ctx}:

"{text}"

Chapter context: {chapter_context[:500] if chapter_context else 'Not provided'}

Respond in JSON with exactly these keys:
{{
  "simple_version": "Simplified version (2-3 sentences)",
  "author_intent": "Why the author wrote it this way",
  "cultural_context": "Cultural context if relevant, otherwise null",
  "kinyarwanda_bridge": "Rwanda cultural connection — compare to umuganda, gacaca, icyubahiro, or another Rwandan concept",
  "vocabulary": [
    {{"word": "string", "meaning": "simple child-friendly definition", "analogy": "simple comparison for a 10-year-old", "category": "e.g. Archaic, Vocabulary, Idiom"}}
  ]
}}"""

        result = self.gemini.generate_json(prompt, system_instruction)
        return result if isinstance(result, dict) else {}

    def _simplify_rule_based(
        self,
        text: str,
        book_title: str,
        author: str,
        doc_type: str,
        speaker: str,
        reading_level: str,
        language: str,
    ) -> Dict[str, Any]:
        """Rule-based fallback simplification."""
        # Replace archaic words
        simplified_words = text.split()
        replaced = []
        for word in simplified_words:
            clean = word.lower().strip(".,!?;:'\"()-")
            if clean in _ARCHAIC_GLOSSARY:
                replacement = _ARCHAIC_GLOSSARY[clean]
                # Preserve punctuation
                trailing = ""
                if word and word[-1] in ".,!?;:'\"()-":
                    trailing = word[-1]
                replaced.append(f"{replacement}{trailing}")
            else:
                replaced.append(word)
        simple_version = " ".join(replaced)

        # Break long sentences
        sentences = re.split(r"(?<=[.!?])\s+", simple_version)
        shortened = []
        for sent in sentences:
            if len(sent.split()) > 20:
                if ", and " in sent:
                    parts = sent.split(", and ", 1)
                    shortened.append(parts[0] + ".")
                    shortened.append(parts[1].strip().capitalize())
                elif "; " in sent:
                    parts = sent.split("; ", 1)
                    shortened.append(parts[0] + ".")
                    shortened.append(parts[1].strip().capitalize())
                else:
                    shortened.append(sent)
            else:
                shortened.append(sent)
        simple_version = " ".join(shortened)

        # Generate basic author intent
        speaker_note = f" {speaker} is saying" if speaker else " The author is saying"
        if doc_type == "play":
            intent = f"In this {doc_type},{speaker_note} something important about the situation or characters."
        else:
            intent = f"The author uses these words to create a vivid picture and advance the story."

        if book_title:
            intent += f' This is from "{book_title}"'
            if author:
                intent += f" by {author}"
            intent += "."

        # Add Kinyarwanda cultural bridge if applicable
        kinyarwanda_bridge = _get_kinyarwanda_bridge(text)

        return {
            "simple_version": simple_version,
            "author_intent": intent,
            "vocabulary": self._extract_vocabulary(text),
            "literary_devices": self._detect_devices(text),
            "cultural_context": None,
            "kinyarwanda_bridge": kinyarwanda_bridge,
            "tier": "rule_based",
        }

    def _extract_vocabulary_gemini(self, text: str, reading_level: str) -> List[Dict[str, str]]:
        """Extract difficult words and generate child-friendly definitions using Gemini."""
        if not self.gemini.is_available():
            return self._extract_vocabulary(text)

        level_desc = {
            "beginner": "Primary 4 (9 years old)",
            "intermediate": "Primary 5 (10 years old)",
            "advanced": "Primary 6 (11-12 years old)",
        }.get(reading_level, "Primary 5 student")

        prompt = f"""Identify 3-5 difficult or important words from this text and provide child-friendly definitions:
"{text}"

The definitions should be suitable for a {level_desc}.
Respond in JSON as a list of objects with "word", "meaning", "analogy" (a simple comparison), and "category" (e.g. Vocabulary, Archaic, Figurative).
Example: [{{"word": "astounded", "meaning": "very surprised", "analogy": "like when you see a magic trick", "category": "Vocabulary"}}]
"""
        result = self.gemini.generate_json(prompt)
        return result if isinstance(result, list) else self._extract_vocabulary(text)

    def _extract_vocabulary(self, text: str) -> List[Dict[str, str]]:
        """Extract difficult words with definitions."""
        vocab = []
        words = re.findall(r"[a-zA-Z']+", text)

        for word in words:
            clean = word.lower().strip("'")
            if clean in _ARCHAIC_GLOSSARY:
                vocab.append({
                    "word": word,
                    "meaning": _ARCHAIC_GLOSSARY[clean],
                    "analogy": f'Think of it as a fancy old way of saying "{_ARCHAIC_GLOSSARY[clean]}".',
                    "type": "archaic",
                    "category": "Archaic",
                })

        # Deduplicate
        seen = set()
        unique = []
        for v in vocab:
            if v["word"].lower() not in seen:
                seen.add(v["word"].lower())
                unique.append(v)

        return unique

    def _detect_devices(self, text: str) -> List[Dict[str, str]]:
        """Detect literary devices in the text."""
        devices = []
        for pattern, device_name, explanation in _DEVICE_PATTERNS:
            if re.search(pattern, text, re.IGNORECASE):
                devices.append({
                    "device": device_name,
                    "explanation": explanation,
                })

        # Deduplicate by device name
        seen = set()
        unique = []
        for d in devices:
            if d["device"] not in seen:
                seen.add(d["device"])
                unique.append(d)

        return unique
