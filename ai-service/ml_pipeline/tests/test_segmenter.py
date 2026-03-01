"""
test_segmenter.py
=================
Unit tests for StructuralSegmenter.

Run with:
  cd ai-service && python -m pytest ml_pipeline/tests/test_segmenter.py -v
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

import pytest
from ml_pipeline.structural_segmenter import StructuralSegmenter


# ── Helpers ─────────────────────────────────────────────────────────────────────

def _span(text: str, size: float = 12.0, flags: int = 0) -> dict:
    return {"text": text, "size": size, "flags": flags, "font": "Helvetica"}


def _block(lines_texts: list[str], size: float = 12.0, flags: int = 0, page: int = 0) -> dict:
    """Build a single PyMuPDF block dict."""
    return {
        "type": 0,
        "_page": page,
        "lines": [
            {"spans": [_span(t, size, flags)], "bbox": [0, float(i * 14), 400, float(i * 14 + 12)]}
            for i, t in enumerate(lines_texts)
        ],
    }


# ── Tests: Play segmentation ─────────────────────────────────────────────────────

class TestPlaySegmentation:
    seg = StructuralSegmenter()

    def _blocks(self):
        return [
            _block(["ACT I"],    size=20, flags=16),   # large + bold → act heading
            _block(["SCENE 1"],  size=16, flags=16),   # large + bold → scene heading
            _block(["HAMLET.",   "To be, or not to be, that is the question:"]),
            _block(["[Enter HORATIO]"]),
            _block(["HORATIO.", "O, farewell, honest soldier."]),
            _block(["SCENE 2"],  size=16, flags=16),
            _block(["OPHELIA.", "Good night, sweet prince."]),
            _block(["ACT II"],   size=20, flags=16),
            _block(["SCENE 1"],  size=16, flags=16),
            _block(["MARCELLUS.", "Something is rotten in the state of Denmark."]),
        ]

    def test_produces_two_acts(self):
        units = self.seg.segment(self._blocks(), doc_type="play")
        assert len(units) == 2
        assert units[0]["title"].upper().startswith("ACT I")
        assert units[1]["title"].upper().startswith("ACT II")

    def test_act_contains_children_scenes(self):
        units = self.seg.segment(self._blocks(), doc_type="play")
        act1 = units[0]
        assert "children" in act1
        assert len(act1["children"]) >= 1

    def test_scene_contains_blocks(self):
        units = self.seg.segment(self._blocks(), doc_type="play")
        scene1 = units[0]["children"][0]
        assert "blocks" in scene1
        assert len(scene1["blocks"]) > 0

    def test_dialogue_block_has_character(self):
        units = self.seg.segment(self._blocks(), doc_type="play")
        # Find any dialogue block
        for act in units:
            for scene in act.get("children", []):
                for block in scene.get("blocks", []):
                    if block["type"] == "dialogue":
                        assert block["character"] is not None
                        assert len(block["character"]) > 0
                        return
        pytest.fail("No dialogue block found in output")

    def test_stage_direction_type(self):
        units = self.seg.segment(self._blocks(), doc_type="play")
        for act in units:
            for scene in act.get("children", []):
                for block in scene.get("blocks", []):
                    if block["type"] == "stage_direction":
                        assert block["character"] is None
                        return

    def test_units_have_ids(self):
        units = self.seg.segment(self._blocks(), doc_type="play")
        for act in units:
            assert "id" in act and act["id"]
            for scene in act.get("children", []):
                assert "id" in scene and scene["id"]

    def test_act_without_explicit_heading_creates_inferred(self):
        # Only scene headings, no ACT heading → should still produce hierarchy
        blocks = [
            _block(["SCENE 1"],  size=16, flags=16),
            _block(["ROMEO.", "But soft, what light through yonder window breaks?"]),
        ]
        units = self.seg.segment(blocks, doc_type="play")
        assert len(units) >= 1
        assert units[0]["inferred"] is True

    def test_empty_blocks_returns_list(self):
        units = self.seg.segment([], doc_type="play")
        assert isinstance(units, list)


# ── Tests: Novel segmentation ────────────────────────────────────────────────────

class TestNovelSegmentation:
    seg = StructuralSegmenter()

    def _blocks(self):
        return [
            _block(["Chapter 1"], size=18, flags=16),
            _block(["It was the best of times, it was the worst of times, it was the age of wisdom, "
                    "it was the age of foolishness, it was the epoch of belief."]),
            _block(["It was a far, far better thing that I do, than I have ever done before."]),
            _block(["Chapter 2"], size=18, flags=16),
            _block(["The great fish moved silently through the night water, propelled by short sweeps "
                    "of its crescent tail."]),
        ]

    def test_produces_two_chapters(self):
        units = self.seg.segment(self._blocks(), doc_type="novel")
        assert len(units) == 2

    def test_chapter_has_children(self):
        units = self.seg.segment(self._blocks(), doc_type="novel")
        assert "children" in units[0]
        assert len(units[0]["children"]) >= 1

    def test_chapter_content_rolled_up(self):
        units = self.seg.segment(self._blocks(), doc_type="novel")
        # Chapter-level content should be non-empty
        assert len(units[0]["content"]) > 0

    def test_section_has_paragraphs(self):
        units = self.seg.segment(self._blocks(), doc_type="novel")
        for ch in units:
            for sec in ch.get("children", []):
                assert "paragraphs" in sec
                assert isinstance(sec["paragraphs"], list)

    def test_generic_type_produces_chapters(self):
        blocks = self._blocks()
        units = self.seg.segment(blocks, doc_type="generic")
        assert isinstance(units, list)
        assert len(units) >= 1


# ── Tests: Heading threshold ─────────────────────────────────────────────────────

class TestHeadingThreshold:
    seg = StructuralSegmenter()

    def test_threshold_above_median(self):
        from ml_pipeline.structural_segmenter import Span
        spans = [
            Span("body", 12.0, 0, 0),
            Span("body", 12.0, 0, 0),
            Span("body", 11.5, 0, 0),
            Span("heading", 20.0, 16, 0),
        ]
        threshold = self.seg._compute_heading_threshold(spans)
        assert threshold > 12.0   # Must be above body text size
        assert threshold < 30.0   # Must be below an obviously unreasonable ceiling

    def test_threshold_with_single_span(self):
        from ml_pipeline.structural_segmenter import Span
        spans = [Span("only", 12.0, 0, 0)]
        threshold = self.seg._compute_heading_threshold(spans)
        assert threshold > 0
