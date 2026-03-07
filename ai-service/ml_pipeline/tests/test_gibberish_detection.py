import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

import unittest
from ml_pipeline.analyzer import LiteratureAnalyzer

class TestGibberishDetection(unittest.TestCase):
    def setUp(self):
        self.analyzer = LiteratureAnalyzer()

    def test_real_prose_is_not_gibberish(self):
        text = "MACBETH. Is this a dagger which I see before me, The handle toward my hand? Come, let me clutch thee."
        self.assertFalse(self.analyzer._is_gibberish(text))

    def test_junk_text_is_gibberish(self):
        # Sample reported by user
        text = "b}PAf; i 's io t[P h?hi c_pA isp aoL v_ avn \u00a4 oS fgtA ioX d?XYRr \u00a4 B?p| o's g[t , oS t[P"
        self.assertTrue(self.analyzer._is_gibberish(text))

    def test_mostly_symbols_is_gibberish(self):
        text = "@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@"
        self.assertTrue(self.analyzer._is_gibberish(text))

    def test_french_prose_is_not_gibberish(self):
        text = "Être ou ne pas être, telle est la question. Est-il plus noble pour l'esprit de subir les coups..."
        self.assertFalse(self.analyzer._is_gibberish(text))

    def test_empty_or_short_is_not_gibberish(self):
        self.assertFalse(self.analyzer._is_gibberish(""))
        self.assertFalse(self.analyzer._is_gibberish("Hello world"))

if __name__ == "__main__":
    unittest.main()
