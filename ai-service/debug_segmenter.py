from ml_pipeline.structural_segmenter import StructuralSegmenter
import os
import time

# Read from the full file
dump_path = "/Users/yvanshema/Documents/SHEMA/IncludEd-2.0/backend/macbeth_content.txt"
if not os.path.exists(dump_path):
    print("Full file not found")
    exit(1)

with open(dump_path, 'r') as f:
    text = f.read()
print(f"TEXT LENGTH: {len(text)}")

# Simulate single-line block
mock_blocks = [{
    "type": 0,
    "lines": [{"spans": [{"text": text}]}]
}]

segmenter = StructuralSegmenter()
print("Starting tokenise...")
tokens = segmenter._tokenise(mock_blocks, "play")
print(f"TOKENS CREATED: {len(tokens)}")

# Check for headings in tokens
headings = [t for t in tokens if t["type"] == "heading"]
print(f"HEADINGS FOUND: {len(headings)}")

# Print first 20 headings
for i, h in enumerate(headings[:20]):
    print(f"  H{i}: {h['level']} | {h['title']}")

# Manually run the TOC detection part to see what it skips
num_tokens = len(tokens)
toc_indices = set()
for i in range(num_tokens):
    if tokens[i]["type"] == "heading":
        lookahead_limit = min(i + 8, num_tokens)
        cluster_indices = [j for j in range(i, lookahead_limit) if tokens[j]["type"] == "heading"]
        if len(cluster_indices) >= 4:
            content_length = sum(len(tokens[j].get("text", "")) for j in range(cluster_indices[0], cluster_indices[-1]) if tokens[j]["type"] == "content")
            if content_length < 200:
                print(f"CLUSTER found at token {i}: {[tokens[idx]['title'] for idx in cluster_indices]} (len: {content_length})")
                for idx in cluster_indices:
                    toc_indices.add(idx)

# Print first 100 tokens summary
print("\n--- FIRST 100 TOKENS ---")
for i, t in enumerate(tokens[:100]):
    is_toc = i in toc_indices
    label = "TOC!" if is_toc else ""
    print(f"{i:3}: {t['type']:7} | {t.get('level', ''):5} | {label:4} | {t.get('title', t.get('text', ''))[:50]}")

print("\nRunning segment...")
units = segmenter.segment(mock_blocks, "play")
print(f"UNITS CREATED: {len(units)}")
if units:
    for u in units:
        print(f"ACT: {u['title']} (scenes: {len(u['children'])})")
