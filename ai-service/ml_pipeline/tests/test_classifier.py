"""
test_classifier.py
==================
Unit tests for ContentClassifier.

Run with:
  cd ai-service && python -m pytest ml_pipeline/tests/test_classifier.py -v
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

import pytest
from ml_pipeline.content_classifier import ContentClassifier


# ── Helpers ─────────────────────────────────────────────────────────────────────

def _make_block(lines: list[str], font_size: float = 12.0, flags: int = 0, page: int = 0) -> dict:
    """Create a minimal PyMuPDF text block dict for testing."""
    return {
        "type": 0,
        "_page": page,
        "lines": [
            {
                "spans": [{"text": line, "size": font_size, "flags": flags, "font": "Helvetica"}]
            }
            for line in lines
        ],
    }


# ── Tests: Play detection ────────────────────────────────────────────────────────

class TestPlayClassification:
    clf = ContentClassifier()

    def _classify(self, lines: list[str], size: float = 12.0, flags: int = 0) -> str:
        blocks = [_make_block(lines, font_size=size, flags=flags)]
        return self.clf.classify(blocks)

    def test_act_heading_signals_play(self):
        result = self.clf.classify([
            _make_block(["ACT I"], font_size=18, flags=16),
            _make_block(["SCENE 1"], font_size=14, flags=16),
            _make_block(["HAMLET.", "To be, or not to be, that is the question."]),
            _make_block(["[Enter HAMLET]"]),
        ])
        assert result.type == "play"
        assert result.confidence > 0.6
        assert result.signals["act_heading"] >= 1

    def test_scene_and_cue_lines_signal_play(self):
        blocks = [
            _make_block(["SCENE II"]),
            _make_block(["MACBETH.", "Is this a dagger which I see before me?"]),
            _make_block(["LADY MACBETH.", "My hands are of your color, but I shame."]),
            _make_block(["(Exit Lady Macbeth)"]),
        ]
        result = self.clf.classify(blocks)
        assert result.type == "play"
        assert result.signals["scene_heading"] >= 1
        assert result.signals["character_cue"] >= 1

    def test_multiple_acts_high_confidence(self):
        blocks = [
            _make_block(["ACT I"]),
            _make_block(["SCENE 1"]),
            _make_block(["ROMEO.", "What light through yonder window breaks?"]),
            _make_block(["JULIET.", "O Romeo, Romeo, wherefore art thou Romeo?"]),
            _make_block(["ACT II"]),
            _make_block(["SCENE 2"]),
            _make_block(["[Enter FRIAR LAWRENCE]"]),
        ]
        result = self.clf.classify(blocks)
        assert result.type == "play"
        assert result.confidence >= 0.7

    def test_cast_page_is_strong_signal(self):
        blocks = [
            _make_block(["DRAMATIS PERSONAE"], font_size=16, flags=16),
            _make_block(["HAMLET, Prince of Denmark"]),
            _make_block(["HORATIO, friend to Hamlet"]),
        ]
        result = self.clf.classify(blocks)
        assert result.type == "play"
        assert result.signals["cast_page"] >= 1


# ── Tests: Novel detection ───────────────────────────────────────────────────────

class TestNovelClassification:
    clf = ContentClassifier()

    def test_chapter_heading_signals_novel(self):
        blocks = [
            _make_block(["Chapter 1"], font_size=16, flags=16),
            _make_block(["It was a bright cold day in April, and the clocks were striking thirteen."
                         " Winston Smith, his chin nuzzled into his breast in an effort to escape "
                         "the vile wind, slipped quickly through the glass doors of Victory Mansions."]),
        ]
        result = self.clf.classify(blocks)
        assert result.type == "novel"
        assert result.signals["chapter_heading"] >= 1

    def test_multiple_chapters_high_confidence(self):
        blocks = [
            _make_block(["CHAPTER ONE"]),
            _make_block(["I walked through the village, my heart heavy with dread."
                         " The cobblestones gleamed wetly in the rain-soaked afternoon."]),
            _make_block(["CHAPTER TWO"]),
            _make_block(["She said nothing for a long time, staring into the fire "
                         "as the embers collapsed inward upon themselves."]),
        ]
        result = self.clf.classify(blocks)
        assert result.type == "novel"
        assert result.confidence >= 0.6

    def test_prose_and_said_tags_signal_novel(self):
        blocks = [
            _make_block(['"You cannot be serious," she said, setting down her cup of tea '
                         'with unusual deliberateness upon the saucer.']),
            _make_block(['"I assure you I am," replied Mr. Darcy, "though I confess it pains me '
                         'to say so in such company as this."']),
        ]
        result = self.clf.classify(blocks)
        # Should be novel or at minimum not play
        assert result.type in ("novel", "generic")


# ── Tests: Generic / ambiguous ──────────────────────────────────────────────────

class TestGenericClassification:
    clf = ContentClassifier()

    def test_sparse_document_is_generic(self):
        blocks = [_make_block(["Introduction"]), _make_block(["Some content."])]
        result = self.clf.classify(blocks)
        # Sparse = low total score → generic
        assert result.type == "generic"

    def test_empty_blocks_is_generic(self):
        result = self.clf.classify([])
        assert result.type == "generic"

    def test_empty_text_blocks_is_generic(self):
        blocks = [{"type": 0, "_page": 0, "lines": [{"spans": [{"text": "", "size": 12, "flags": 0, "font": ""}]}]}]
        result = self.clf.classify(blocks)
        assert result.type == "generic"
