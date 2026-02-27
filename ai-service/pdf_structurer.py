#!/usr/bin/env python3
"""
pdf_structurer.py
=================
Production-ready PDF → Structured JSON converter.

Supports:
  • Plays     → Act → Scene → Dialogue Blocks
  • Novels    → Chapter → Sections → Paragraphs
  • Generic   → Logical Sections with inferred headings

Usage:
  python pdf_structurer.py input.pdf [output.json] [--api-key YOUR_KEY]

Requirements:
  pip install pdfplumber openai

Environment:
  Set OPENAI_API_KEY in environment or pass --api-key flag.

Author: IncludEd AI Platform
"""

import argparse
import json
import os
import re
import sys
import textwrap
import uuid
import requests
from typing import Any, Dict, List, Optional

# ── PDF parsing ────────────────────────────────────────────────────────────────
try:
    import pdfplumber
except ImportError:
    sys.exit("ERROR: pdfplumber not installed. Run: pip install pdfplumber")

# ── OpenAI ─────────────────────────────────────────────────────────────────────
try:
    from openai import OpenAI
except ImportError:
    sys.exit("ERROR: openai not installed. Run: pip install openai")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 1. PDF TEXT EXTRACTION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def extract_text_from_pdf(pdf_path: str) -> str:
    """
    Extract all readable text from a PDF using pdfplumber.
    Returns the raw concatenated text, or raises on unreadable (scanned) PDFs.
    """
    if not os.path.isfile(pdf_path):
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    pages_text: List[str] = []

    with pdfplumber.open(pdf_path) as pdf:
        if len(pdf.pages) == 0:
            raise ValueError("PDF has no pages.")

        for i, page in enumerate(pdf.pages):
            text = page.extract_text()
            if text:
                # Preserve page boundary with a form-feed marker for later cleanup
                pages_text.append(f"\f[PAGE {i + 1}]\n{text}")

    full_text = "\n".join(pages_text).strip()

    if len(full_text) < 50:
        raise ValueError(
            "Extracted text is too short. The PDF may be scanned/image-based. "
            "Use OCR (e.g., pytesseract) to pre-process it first."
        )

    return full_text


def clean_text(raw: str) -> str:
    """
    Normalise whitespace, remove page markers, fix common PDF broken-line issues.
    Preserves paragraph structure (double newlines).
    """
    # Remove internal page markers
    text = re.sub(r'\f\[PAGE \d+\]', '\n', raw)

    # Rejoin lines that were broken mid-sentence (no punctuation at end)
    # Only join lines that don't look like headings (not all-caps short lines)
    def rejoin_broken_lines(text: str) -> str:
        lines = text.split('\n')
        result = []
        for i, line in enumerate(lines):
            stripped = line.rstrip()
            if (stripped and
                i + 1 < len(lines) and
                lines[i + 1].strip() and
                not stripped.endswith(('.', '!', '?', ':', '"', "'", ']', ')')) and
                    not re.match(r'^[A-Z\s]{3,40}$', stripped.strip())):
                result.append(stripped + ' ')
            else:
                result.append(stripped + '\n')
        return ''.join(result)

    text = rejoin_broken_lines(text)

    # Collapse 3+ consecutive newlines into exactly 2 (paragraph break)
    text = re.sub(r'\n{3,}', '\n\n', text)

    # Remove trailing spaces from lines
    text = re.sub(r'[ \t]+\n', '\n', text)

    return text.strip()


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 2. AI ANALYSIS — ALL GPT CALLS ISOLATED HERE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def call_llm(system_prompt: str, user_content: str, use_ollama: bool = True) -> Dict:
    """
    Gateway for LLM calls (OpenAI or Ollama).
    """
    if use_ollama:
        return call_ollama(system_prompt, user_content)
    else:
        # Fallback to OpenAI if configured
        client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
        return call_gpt(client, system_prompt, user_content)

def call_ollama(system_prompt: str, user_content: str) -> Dict:
    """
    Calls local Ollama instance.
    """
    url = os.environ.get("OLLAMA_URL", "http://localhost:11434")
    model = os.environ.get("OLLAMA_MODEL", "llama3")
    
    payload = {
        "model": model,
        "prompt": user_content,
        "system": system_prompt,
        "format": "json",
        "stream": False,
        "options": {"temperature": 0.2}
    }
    
    try:
        response = requests.post(f"{url}/api/generate", json=payload, timeout=120)
        response.raise_for_status()
        result = response.json()
        return json.loads(result.get("response", "{}"))
    except Exception as e:
        print(f"❌ Ollama request failed: {e}")
        return {}

def call_gpt(client: OpenAI, system_prompt: str, user_content: str, model: str = "gpt-4o") -> Dict:
    """
    Single gateway for all OpenAI calls.
    Forces JSON-only output. Raises on failure.
    """
    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            response_format={"type": "json_object"},
            temperature=0.2,
        )
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        print(f"❌ OpenAI request failed: {e}")
        return {}


def detect_document_type_and_title(text: str, use_ollama: bool = True) -> Dict[str, str]:
    """
    Step 1: Classify the document and extract its title.
    Returns {"document_type": "play|novel|generic", "title": "..."}
    """
    system = textwrap.dedent("""
        You are a literary analyst. Analyze the provided text sample and return STRICT JSON ONLY.
        Determine:
          1. document_type: MUST be exactly one of: "play", "novel", "generic"
          2. title: the document's title if detectable, otherwise "Unknown Title"
        
        Signs of a play: stage directions, character names in ALL CAPS before dialogue, ACT/SCENE headings.
        Signs of a novel: narrative prose, chapter headings, past tense storytelling.
        Generic: academic papers, reports, technical documents.

        Return ONLY this JSON structure, no other text:
        {
          "document_type": "play" | "novel" | "generic",
          "title": "<string>"
        }
    """).strip()

    result = call_llm(system, f"TEXT SAMPLE:\n\n{text[:3000]}", use_ollama=use_ollama)

    # Validate
    if result.get("document_type") not in ("play", "novel", "generic"):
        result["document_type"] = "generic"
    if not result.get("title"):
        result["title"] = "Unknown Title"

    return result


def structure_play(text: str, chunk_size: int = 8000, use_ollama: bool = True) -> List[Dict]:
    """
    Step 2a: Structure a play into Acts → Scenes → Dialogue blocks.
    Processes in chunks to handle large texts.
    """
    system = textwrap.dedent("""
        You are an expert in dramatic literature. Parse the provided play text into STRICT JSON ONLY.
        
        Return this exact structure:
        {
          "acts": [
            {
              "title": "ACT I",
              "inferred": false,
              "scenes": [
                {
                  "title": "Scene 1",
                  "inferred": false,
                  "setting": "A description of the setting if present, else null",
                  "blocks": [
                    {
                      "type": "dialogue",
                      "character": "CHARACTER NAME",
                      "content": "The exact spoken lines verbatim."
                    },
                    {
                      "type": "stage_direction",
                      "character": null,
                      "content": "The stage direction verbatim."
                    }
                  ]
                }
              ]
            }
          ]
        }
        
        CRITICAL RULES:
        - NEVER invent dialogue that is not in the text.
        - content must be VERBATIM from the source text.
        - If act/scene headings are absent, infer logical divisions and set "inferred": true.
        - Return ONLY valid JSON, no markdown.
    """).strip()

    # Process in overlapping chunks to avoid cutting mid-scene
    chunks = _split_into_chunks(text, chunk_size, overlap=500)
    all_acts: List[Dict] = []

    for i, chunk in enumerate(chunks):
        print(f"  🎭 Processing play chunk {i+1}/{len(chunks)}...", flush=True)
        try:
            result = call_llm(system, f"PLAY TEXT:\n\n{chunk}", use_ollama=use_ollama)
            acts = result.get("acts", [])
            all_acts.extend(acts)
        except Exception as e:
            print(f"  ⚠️  Chunk {i+1} failed: {e}", flush=True)

    # Merge duplicate act/scene labels across chunks
    return _merge_play_acts(all_acts)


def structure_novel(text: str, chunk_size: int = 8000, use_ollama: bool = True) -> List[Dict]:
    """
    Step 2b: Structure a novel into Chapters → Sections → Paragraphs.
    """
    system = textwrap.dedent("""
        You are an expert literary analyst. Parse the provided novel/book text into STRICT JSON ONLY.
        
        Return this exact structure:
        {
          "chapters": [
            {
              "title": "Chapter 1: The Beginning",
              "inferred": false,
              "sections": [
                {
                  "title": "A section heading if present, else generate a SHORT descriptive title",
                  "inferred": true,
                  "paragraphs": [
                    "Verbatim paragraph text.",
                    "Another verbatim paragraph."
                  ]
                }
              ]
            }
          ]
        }
        
        CRITICAL RULES:
        - content must be VERBATIM from the source text. Never paraphrase or invent.
        - If chapters are not explicitly marked, infer them from topic shifts, 
          setting changes, or narrative pacing. Set "inferred": true.
        - Generate descriptive titles for inferred chapters (e.g., "The Storm at Sea").
        - Return ONLY valid JSON, no markdown, no commentary.
    """).strip()

    chunks = _split_into_chunks(text, chunk_size, overlap=300)
    all_chapters: List[Dict] = []

    for i, chunk in enumerate(chunks):
        print(f"  📖 Processing novel chunk {i+1}/{len(chunks)}...", flush=True)
        try:
            result = call_llm(system, f"NOVEL TEXT:\n\n{chunk}", use_ollama=use_ollama)
            chapters = result.get("chapters", [])
            all_chapters.extend(chapters)
        except Exception as e:
            print(f"  ⚠️  Chunk {i+1} failed: {e}", flush=True)

    return all_chapters


def structure_generic(text: str, chunk_size: int = 8000, use_ollama: bool = True) -> List[Dict]:
    """
    Step 2c: Structure a generic/academic document into logical sections.
    """
    system = textwrap.dedent("""
        You are a document analyst. Parse the provided document text into STRICT JSON ONLY.

        Return this exact structure:
        {
          "sections": [
            {
              "title": "Section heading (detected or generated)",
              "inferred": false,
              "content": "The verbatim text content of this section."
            }
          ]
        }
        
        CRITICAL RULES:
        - content must be VERBATIM. Never paraphrase or invent.
        - Detect existing headings where present. Set "inferred": false.
        - For body text without headings, create logical sections with descriptive titles. Set "inferred": true.
        - Return ONLY valid JSON, no markdown, no commentary.
    """).strip()

    chunks = _split_into_chunks(text, chunk_size, overlap=200)
    all_sections: List[Dict] = []

    for i, chunk in enumerate(chunks):
        print(f"  📄 Processing generic chunk {i+1}/{len(chunks)}...", flush=True)
        try:
            result = call_llm(system, f"DOCUMENT TEXT:\n\n{chunk}", use_ollama=use_ollama)
            sections = result.get("sections", [])
            all_sections.extend(sections)
        except Exception as e:
            print(f"  ⚠️  Chunk {i+1} failed: {e}", flush=True)

    return all_sections


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 3. OUTPUT NORMALIZATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def normalize_structure(doc_type: str, raw_structure: List[Dict]) -> List[Dict]:
    """
    Flatten and normalize AI output into the canonical output format.
    Every unit must have: id, title, content, inferred.
    """
    output: List[Dict] = []

    if doc_type == "play":
        for act in raw_structure:
            act_id = _uid()
            act_node: Dict[str, Any] = {
                "id": act_id,
                "title": act.get("title", "Unknown Act"),
                "inferred": act.get("inferred", False),
                "content": "",      # Acts contain scenes, not direct content
                "children": []
            }
            for scene in act.get("scenes", []):
                scene_id = _uid()
                # Flatten blocks into a readable content string
                content_lines = []
                if scene.get("setting"):
                    content_lines.append(f"[Setting: {scene['setting']}]")
                for block in scene.get("blocks", []):
                    if block.get("type") == "dialogue":
                        content_lines.append(f"{block.get('character','')}: {block.get('content','')}")
                    elif block.get("type") == "stage_direction":
                        content_lines.append(f"[{block.get('content','')}]")

                scene_node = {
                    "id": scene_id,
                    "title": scene.get("title", "Unknown Scene"),
                    "inferred": scene.get("inferred", False),
                    "content": "\n".join(content_lines),
                    "blocks": scene.get("blocks", [])
                }
                act_node["children"].append(scene_node)

            output.append(act_node)

    elif doc_type == "novel":
        for chapter in raw_structure:
            chapter_id = _uid()
            chapter_node: Dict[str, Any] = {
                "id": chapter_id,
                "title": chapter.get("title", "Unknown Chapter"),
                "inferred": chapter.get("inferred", False),
                "content": "",
                "children": []
            }
            for section in chapter.get("sections", []):
                section_id = _uid()
                paragraphs = section.get("paragraphs", [])
                section_node = {
                    "id": section_id,
                    "title": section.get("title", ""),
                    "inferred": section.get("inferred", False),
                    "content": "\n\n".join(paragraphs),
                    "paragraphs": paragraphs
                }
                chapter_node["children"].append(section_node)
                # Roll up content for full-chapter text access
                chapter_node["content"] += "\n\n" + section_node["content"]

            chapter_node["content"] = chapter_node["content"].strip()
            output.append(chapter_node)

    elif doc_type == "generic":
        for section in raw_structure:
            output.append({
                "id": _uid(),
                "title": section.get("title", "Section"),
                "inferred": section.get("inferred", True),
                "content": section.get("content", ""),
            })

    return output


def _uid() -> str:
    return str(uuid.uuid4())[:12]


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 4. HELPERS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def _split_into_chunks(text: str, chunk_size: int, overlap: int = 200) -> List[str]:
    """Split text into overlapping character-based chunks."""
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        # Try to cut on a double newline to avoid mid-paragraph cuts
        if end < len(text):
            cut = text.rfind('\n\n', start, end)
            if cut > start:
                end = cut
        chunks.append(text[start:end])
        start = end - overlap  # Overlapping window to preserve context
        if start < 0:
            start = 0
    return chunks


def _merge_play_acts(acts: List[Dict]) -> List[Dict]:
    """
    Deduplicate act/scene entries that appear in multiple chunks due to overlap.
    Merges by normalized title.
    """
    seen: Dict[str, Dict] = {}
    merged: List[Dict] = []

    for act in acts:
        key = act.get("title", "").strip().upper()
        if key in seen:
            # Append scenes to the already-seen act
            seen[key]["scenes"].extend(act.get("scenes", []))
        else:
            seen[key] = act
            merged.append(act)

    return merged


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 5. MAIN PIPELINE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def process_pdf(pdf_path: str, output_path: str, api_key: Optional[str] = None, use_ollama: bool = True) -> Dict:
    """
    Full pipeline:
      1. Extract text from PDF
      2. Classify document type
      3. Structure content using LLM (Ollama or GPT-4o)
      4. Normalize and validate output
      5. Save JSON
    """
    print(f"\n📄 Processing: {pdf_path}", flush=True)

    # Step 1 – Extract
    print("🔍 Extracting text...", flush=True)
    raw_text = extract_text_from_pdf(pdf_path)
    text = clean_text(raw_text)
    print(f"   ✅ Extracted {len(text):,} characters from PDF.", flush=True)

    # Step 2 – Classify
    print("🧠 Classifying document type...", flush=True)
    meta_data = detect_document_type_and_title(text, use_ollama=use_ollama)
    doc_type = meta_data.get("document_type", "generic")
    title    = meta_data.get("title", os.path.basename(pdf_path).replace(".pdf", ""))
    print(f"   ✅ Type: {doc_type} | Title: {title}", flush=True)

    # Step 3 – Structure
    print(f"⚙️  Building {doc_type} structure...", flush=True)
    if doc_type == "play":
        raw_structure = structure_play(text, use_ollama=use_ollama)
    elif doc_type == "novel":
        raw_structure = structure_novel(text, use_ollama=use_ollama)
    else:
        raw_structure = structure_generic(text, use_ollama=use_ollama)

    # Step 4 – Normalize
    print("🔧 Normalizing output...", flush=True)
    normalized = normalize_structure(doc_type, raw_structure)

    # Step 5 – Assemble final document
    final_data = {
        "document_type": doc_type,
        "title":         title,
        "metadata": {
            "source_file":     os.path.basename(pdf_path),
            "total_units":     len(normalized),
            "total_chars":     len(text),
        },
        "units": normalized
    }

    # Save
    print(f"💾 Saving to: {output_path}", flush=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(final_data, f, indent=2, ensure_ascii=False)

    print(f"\n✅ Done! Saved: {output_path}", flush=True)
    print(f"   Structure: {len(normalized)} top-level sections", flush=True)
    return final_data


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 6. CLI ENTRY POINT
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def main():
    parser = argparse.ArgumentParser(
        description="Convert any PDF (play, novel, or document) into a structured JSON hierarchy."
    )
    parser.add_argument("pdf",          help="Path to the input PDF file")
    parser.add_argument("output",       nargs="?", help="Path to the output JSON file (default: <pdf>.json)")
    parser.add_argument("--api-key",    help="OpenAI API key (or set OPENAI_API_KEY env var)")
    parser.add_argument("--ollama",     action="store_true", help="Use local Ollama for LLM calls (default: False)")
    parser.add_argument("--model",      default="gpt-4o", help="LLM model to use (default: gpt-4o, or llama3 if --ollama is used)")

    args = parser.parse_args()

    # Resolve output path
    if not args.output:
        base = os.path.splitext(args.pdf)[0]
        args.output = base + "_structured.json"

    # Resolve API key
    api_key = args.api_key or os.environ.get("OPENAI_API_KEY", "")
    if not api_key:
        sys.exit(
            "ERROR: OpenAI API key not provided.\n"
            "Set OPENAI_API_KEY environment variable or use --api-key YOUR_KEY"
        )

    try:
        process_pdf(args.pdf, args.output, api_key, use_ollama=args.ollama)
    except FileNotFoundError as e:
        sys.exit(f"ERROR: {e}")
    except ValueError as e:
        sys.exit(f"ERROR (unreadable PDF): {e}")
    except json.JSONDecodeError as e:
        sys.exit(f"ERROR (invalid JSON from AI): {e}")


if __name__ == "__main__":
    main()


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# EXAMPLE OUTPUT — PLAY (e.g., Macbeth)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""
{
  "document_type": "play",
  "title": "Macbeth",
  "metadata": { "source_file": "macbeth.pdf", "total_units": 5, "total_chars": 89234 },
  "structure": [
    {
      "id": "a1b2c3d4e5f6",
      "title": "ACT I",
      "inferred": false,
      "content": "",
      "children": [
        {
          "id": "g7h8i9j0k1l2",
          "title": "Scene 1 — A desert place",
          "inferred": false,
          "content": "[Setting: A desert place. Thunder and lightning. Enter three Witches.]\nFIRST WITCH: When shall we three meet again In thunder, lightning, or in rain?\nSECOND WITCH: When the hurlyburly's done, When the battle's lost and won.\nTHIRD WITCH: That will be ere the set of sun.",
          "blocks": [
            { "type": "stage_direction", "character": null, "content": "A desert place. Thunder and lightning. Enter three Witches." },
            { "type": "dialogue", "character": "FIRST WITCH", "content": "When shall we three meet again In thunder, lightning, or in rain?" },
            { "type": "dialogue", "character": "SECOND WITCH", "content": "When the hurlyburly's done, When the battle's lost and won." }
          ]
        }
      ]
    }
  ]
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXAMPLE OUTPUT — NOVEL (e.g., Pride and Prejudice)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{
  "document_type": "novel",
  "title": "Pride and Prejudice",
  "metadata": { "source_file": "pride_prejudice.pdf", "total_units": 61, "total_chars": 681234 },
  "structure": [
    {
      "id": "m3n4o5p6q7r8",
      "title": "Chapter 1",
      "inferred": false,
      "content": "It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.\n\n\"My dear Mr. Bennet,\" said his lady to him one day...",
      "children": [
        {
          "id": "s9t0u1v2w3x4",
          "title": "The Bennet Household",
          "inferred": true,
          "content": "It is a truth universally acknowledged...",
          "paragraphs": [
            "It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.",
            "\"My dear Mr. Bennet,\" said his lady to him one day..."
          ]
        }
      ]
    }
  ]
}
"""
