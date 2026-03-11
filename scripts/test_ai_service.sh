#!/usr/bin/env bash
# =============================================================================
# test_ai_service.sh
# IncludEd 2.0 — AI Service curl test suite
#
# Usage:
#   chmod +x scripts/test_ai_service.sh
#   ./scripts/test_ai_service.sh
#
# Options:
#   BASE_URL=http://localhost:8082 ./scripts/test_ai_service.sh
# =============================================================================

BASE_URL="${BASE_URL:-http://localhost:8082}"
PASS=0
FAIL=0

# ── Colours ───────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
RESET='\033[0m'

# ── Helpers ───────────────────────────────────────────────────────────────────

section() { echo -e "\n${CYAN}══════════════════════════════════════${RESET}"; echo -e "${CYAN}  $1${RESET}"; echo -e "${CYAN}══════════════════════════════════════${RESET}"; }

run_test() {
  local name="$1"
  local method="$2"
  local path="$3"
  local body="$4"
  local expect_key="$5"    # jq key that must exist in response

  if [ -n "$body" ]; then
    response=$(curl -s -X "$method" "$BASE_URL$path" \
      -H "Content-Type: application/json" \
      -d "$body" 2>&1)
  else
    response=$(curl -s -X "$method" "$BASE_URL$path" 2>&1)
  fi

  # Check HTTP reachability
  if echo "$response" | grep -q "Connection refused\|Failed to connect"; then
    echo -e "  ${RED}✗ $name${RESET}"
    echo -e "    ${RED}→ AI service not reachable at $BASE_URL${RESET}"
    ((FAIL++))
    return
  fi

  # Check expected key exists in JSON response
  if [ -n "$expect_key" ]; then
    if echo "$response" | python3 -c "import sys,json; d=json.load(sys.stdin); assert '$expect_key' in d or any('$expect_key' in str(v) for v in d.values())" 2>/dev/null; then
      echo -e "  ${GREEN}✓ $name${RESET}"
      ((PASS++))
    else
      echo -e "  ${RED}✗ $name${RESET}"
      echo -e "    ${YELLOW}→ Expected key '$expect_key' in response${RESET}"
      echo -e "    ${YELLOW}→ Got: $(echo "$response" | head -c 200)${RESET}"
      ((FAIL++))
    fi
  else
    # No key check — just verify valid JSON
    if echo "$response" | python3 -c "import sys,json; json.load(sys.stdin)" 2>/dev/null; then
      echo -e "  ${GREEN}✓ $name${RESET}"
      ((PASS++))
    else
      echo -e "  ${RED}✗ $name${RESET}"
      echo -e "    ${YELLOW}→ Response: $(echo "$response" | head -c 200)${RESET}"
      ((FAIL++))
    fi
  fi
}

print_response() {
  local name="$1"
  local method="$2"
  local path="$3"
  local body="$4"

  echo -e "\n${YELLOW}▶ $name${RESET}"
  if [ -n "$body" ]; then
    curl -s -X "$method" "$BASE_URL$path" \
      -H "Content-Type: application/json" \
      -d "$body" | python3 -m json.tool 2>/dev/null || echo "(not valid JSON)"
  else
    curl -s "$BASE_URL$path" | python3 -m json.tool 2>/dev/null || echo "(not valid JSON)"
  fi
}

# =============================================================================
# TESTS
# =============================================================================

echo -e "${CYAN}"
echo "  ██████████████████████████████████████"
echo "  IncludEd 2.0 — AI Service Test Suite"
echo "  Target: $BASE_URL"
echo "  ██████████████████████████████████████"
echo -e "${RESET}"

# ── Health ────────────────────────────────────────────────────────────────────
section "Health Check"
run_test "GET /health" GET /health "" "status"
print_response "Health detail" GET /health ""

# ── Vocab ─────────────────────────────────────────────────────────────────────
section "Vocabulary — On-demand explain"

run_test "POST /vocab/explain — archaic word" POST /vocab/explain \
  '{"word":"wherefore","context":"Wherefore art thou Romeo?","literature_id":"test"}' \
  "modern_meaning"

run_test "POST /vocab/explain — hard word" POST /vocab/explain \
  '{"word":"melancholy","context":"He sat in deep melancholy by the window.","literature_id":"test"}' \
  "analogy"

print_response "Vocab explain — wherefore" POST /vocab/explain \
  '{"word":"wherefore","context":"Wherefore art thou Romeo?","literature_id":"test"}'

section "Vocabulary — Batch analysis"

run_test "POST /vocab/batch-analyze" POST /vocab/batch-analyze \
  '{"sections":["Romeo and Juliet met at the masquerade. He was bewildered by her beauty. She spoke with melancholy in her voice.","Thou art the very benediction of grace. Wherefore dost thou forsake me?"]}' \
  "vocabulary"

run_test "POST /vocab/difficulty" POST /vocab/difficulty \
  '{"text":"The protagonist exhibited extraordinary perseverance despite the adversarial circumstances.","difficulty_threshold":0.4}' \
  "difficult_words"

run_test "POST /vocab/pronunciation" POST /vocab/pronunciation \
  '{"word":"melancholy"}' \
  "pronunciation"

# ── NER / Character Map ───────────────────────────────────────────────────────
section "NER — Character Graph"

NER_SECTIONS='["Romeo and Juliet met at the Capulet feast. Mercutio laughed loudly. Lady Capulet frowned.","Romeo said to Juliet: I love thee. Tybalt drew his sword against Romeo. Mercutio was slain by Tybalt.","Juliet wept. The Nurse comforted her. Romeo was banished by the Prince from Verona."]'

run_test "POST /ner/extract" POST /ner/extract \
  "{\"sections\":$NER_SECTIONS,\"title\":\"Romeo and Juliet\"}" \
  "characters"

print_response "NER extract — Romeo & Juliet" POST /ner/extract \
  "{\"sections\":$NER_SECTIONS,\"title\":\"Romeo and Juliet\"}"

run_test "POST /ner/section-view — spoiler-safe (section 0)" POST /ner/section-view \
  '{"characters":[{"name":"Romeo","importance":"major","first_seen_index":0},{"name":"Juliet","importance":"major","first_seen_index":0},{"name":"Ghost","importance":"minor","first_seen_index":5}],"relationships":[],"locations":[],"up_to_section":0}' \
  "characters"

# ── TTS ───────────────────────────────────────────────────────────────────────
section "TTS — Speech Synthesis with Word Timestamps"

run_test "POST /tts/synthesize — dyslexia voice" POST /tts/synthesize \
  '{"text":"Romeo, Romeo! Wherefore art thou Romeo?","disability_type":"dyslexia","language":"english"}' \
  "audio_base64"

run_test "POST /tts/synthesize — ADHD voice" POST /tts/synthesize \
  '{"text":"Two households, both alike in dignity.","disability_type":"adhd"}' \
  "timestamps"

run_test "POST /tts/synthesize — default voice" POST /tts/synthesize \
  '{"text":"In fair Verona, where we lay our scene.","disability_type":"none"}' \
  "word_count"

# Print timestamp detail for one call
echo -e "\n${YELLOW}▶ TTS timestamps detail (first 3 words)${RESET}"
curl -s -X POST "$BASE_URL/tts/synthesize" \
  -H "Content-Type: application/json" \
  -d '{"text":"Romeo and Juliet.","disability_type":"dyslexia"}' \
  | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'  voice:      {d.get(\"voice\")}')
print(f'  rate:       {d.get(\"rate\")}')
print(f'  duration:   {d.get(\"duration_ms\")} ms')
print(f'  word_count: {d.get(\"word_count\")}')
print(f'  timestamps: {json.dumps(d.get(\"timestamps\", [])[:3], indent=4)}')
" 2>/dev/null || echo "  (parse error)"

# ── Adaptive Quiz Difficulty ──────────────────────────────────────────────────
section "Adaptive Quiz — IRT Difficulty Engine"

run_test "POST /quiz/recommend-difficulty — first quiz (dyslexia)" POST /quiz/recommend-difficulty \
  '{"student_id":"test_student_1","literature_id":"lit_romeo","disability_type":"dyslexia"}' \
  "difficulty"

run_test "POST /quiz/record-attempt — good score (0.85)" POST /quiz/record-attempt \
  '{"student_id":"test_student_1","literature_id":"lit_romeo","chapter_index":0,"score":0.85,"difficulty":"easy","disability_type":"dyslexia"}' \
  "next_difficulty"

run_test "POST /quiz/record-attempt — poor score (0.30)" POST /quiz/record-attempt \
  '{"student_id":"test_student_2","literature_id":"lit_romeo","chapter_index":0,"score":0.30,"difficulty":"medium","disability_type":"adhd"}' \
  "next_difficulty"

run_test "GET /quiz/student-state — after attempts" GET \
  "/quiz/student-state?student_id=test_student_1&literature_id=lit_romeo" \
  "" "theta"

echo -e "\n${YELLOW}▶ Full adaptive state after 3 attempts${RESET}"
# Simulate a learning trajectory
curl -s -X POST "$BASE_URL/quiz/record-attempt" \
  -H "Content-Type: application/json" \
  -d '{"student_id":"test_student_3","literature_id":"lit_gatsby","chapter_index":0,"score":0.65,"difficulty":"medium","disability_type":"none"}' > /dev/null
curl -s -X POST "$BASE_URL/quiz/record-attempt" \
  -H "Content-Type: application/json" \
  -d '{"student_id":"test_student_3","literature_id":"lit_gatsby","chapter_index":1,"score":0.80,"difficulty":"medium","disability_type":"none"}' > /dev/null
curl -s -X POST "$BASE_URL/quiz/record-attempt" \
  -H "Content-Type: application/json" \
  -d '{"student_id":"test_student_3","literature_id":"lit_gatsby","chapter_index":2,"score":0.90,"difficulty":"hard","disability_type":"none"}' > /dev/null

curl -s "$BASE_URL/quiz/student-state?student_id=test_student_3&literature_id=lit_gatsby" \
  | python3 -m json.tool 2>/dev/null || echo "(parse error)"

# ── Quiz Generation ────────────────────────────────────────────────────────────
section "Quiz — Question Generation"

run_test "POST /quiz/generate — novel" POST /quiz/generate \
  '{"content":"Gatsby looked out at the green light across the bay. He had waited five years for this moment. Daisy was finally here, standing in his garden.","doc_type":"novel","count":3,"language":"english"}' \
  "questions"

# ── Comprehension ─────────────────────────────────────────────────────────────
section "Comprehension Tracker"

run_test "POST /comprehension/record" POST /comprehension/record \
  '{"student_id":"test_student_1","book_id":"lit_romeo","section_index":0,"section_title":"Act 1","time_spent_seconds":120,"scroll_completion":0.9}' \
  ""

run_test "GET /comprehension/summary" GET \
  "/comprehension/summary?student_id=test_student_1&book_id=lit_romeo" \
  ""

# ── Simplification ────────────────────────────────────────────────────────────
section "Text Simplification"

run_test "POST /simplify" POST /simplify \
  '{"text":"The protagonist, overwhelmed by the tumultuous circumstances of his existence, endeavoured to reconcile his conflicting obligations.","disability_type":"dyslexia","action":2}' \
  ""

# ── RL Predict ────────────────────────────────────────────────────────────────
section "RL Agent — Predict Action"

run_test "POST /rl/predict" POST /rl/predict \
  '{"state":[0.3,0.6,0.7,0.5,0.4,0.5,0.8,0.3,0.5],"student_id":"test_student_1","disability_type":"dyslexia"}' \
  ""

# =============================================================================
# CHARLOTTE'S WEB — FULL PIPELINE TEST WITH REAL PDF
# =============================================================================

section "Charlotte's Web — PDF Upload & Full Analysis"

PDF_PATH="/Users/ivanshema/Documents/IncludEd-2.0/Charlotte_s_Web_.pdf"

if [ ! -f "$PDF_PATH" ]; then
  echo -e "  ${YELLOW}⚠ PDF not found at $PDF_PATH — skipping PDF tests${RESET}"
else
  echo -e "  ${YELLOW}▶ Uploading Charlotte's Web PDF to /analyze (this may take 30–60s)…${RESET}"
  ANALYZE_RESPONSE=$(curl -s -X POST "$BASE_URL/analyze" \
    -F "file=@$PDF_PATH" \
    -F "generate_quiz=true" \
    -F "language=english" \
    --max-time 120 2>&1)

  if echo "$ANALYZE_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); assert 'sections' in d or 'contentType' in d or 'content' in d" 2>/dev/null; then
    echo -e "  ${GREEN}✓ PDF uploaded and analyzed${RESET}"
    ((PASS++))
    # Save section 0 content for later tests
    CW_TEXT=$(echo "$ANALYZE_RESPONSE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
secs = d.get('sections', [])
text = secs[0].get('content','') if secs else d.get('content','')[:800]
print(text[:600])
" 2>/dev/null)
    echo -e "    ${YELLOW}→ First section preview: ${CW_TEXT:0:100}…${RESET}"
  else
    echo -e "  ${RED}✗ PDF analysis failed${RESET}"
    echo -e "    ${YELLOW}→ $(echo "$ANALYZE_RESPONSE" | head -c 200)${RESET}"
    ((FAIL++))
    # Use hardcoded Charlotte's Web text as fallback
    CW_TEXT="Charlotte was a large grey spider who lived in the doorway of a barn. Her web glistened in the morning dew. Wilbur the pig was her dearest friend, and she had promised to save his life."
  fi
fi

# Use hardcoded fallback if PDF upload was skipped
CW_TEXT="${CW_TEXT:-Charlotte was a large grey spider who lived in the doorway of a barn. Her web glistened in the morning dew. Wilbur the pig was her dearest friend, and she had promised to save his life.}"

echo ""
section "Charlotte's Web — Vocab Helper"

run_test "Explain 'glistened' in context" POST /vocab/explain \
  "{\"word\":\"glistened\",\"context\":\"Her web glistened in the morning dew.\",\"literature_id\":\"charlotte\"}" \
  "modern_meaning"

run_test "Explain 'radiant' in context" POST /vocab/explain \
  "{\"word\":\"radiant\",\"context\":\"Charlotte wrote the word RADIANT in her web to describe Wilbur.\",\"literature_id\":\"charlotte\"}" \
  "analogy"

run_test "Explain 'humble' in context" POST /vocab/explain \
  "{\"word\":\"humble\",\"context\":\"Wilbur was described as humble in Charlotte's web.\",\"literature_id\":\"charlotte\"}" \
  "modern_meaning"

print_response "Full vocab explain — 'terrific'" POST /vocab/explain \
  '{"word":"terrific","context":"Charlotte wrote TERRIFIC in her web. Everyone was amazed at Wilbur.","literature_id":"charlotte"}'

run_test "Batch vocab — Charlotte chapters" POST /vocab/batch-analyze \
  '{"sections":["Charlotte was a grey spider. Her web was luminous and intricate. Wilbur the pig was despondent until Charlotte promised to save him.","The word TERRIFIC appeared in Charlotte'\''s web. The farmer was astonished. Wilbur felt exuberant and strutted around the barnyard with pride."],"section_titles":["Chapter 1","Chapter 2"]}' \
  "vocabulary"

section "Charlotte's Web — NER Character Map"

CW_SECTIONS='["Charlotte the spider lived in the barn doorway. Wilbur the pig was her friend. Templeton the rat was selfish but helpful.","Charlotte wrote SOME PIG in her web. Farmer Zuckerman was amazed. Fern the little girl visited every day to see Wilbur.","Charlotte felt tired. She told Wilbur she was dying. Wilbur wept. Templeton reluctantly helped carry Charlotte'\''s egg sac back to the barn."]'

run_test "NER extract — Charlotte's Web characters" POST /ner/extract \
  "{\"sections\":$CW_SECTIONS,\"title\":\"Charlotte's Web\"}" \
  "characters"

print_response "Full character graph — Charlotte's Web" POST /ner/extract \
  "{\"sections\":$CW_SECTIONS,\"title\":\"Charlotte's Web\"}"

run_test "NER section-view — spoiler safe (section 0 only)" POST /ner/section-view \
  '{"characters":[{"name":"Charlotte","importance":"major","first_seen_index":0},{"name":"Wilbur","importance":"major","first_seen_index":0},{"name":"Templeton","importance":"minor","first_seen_index":0},{"name":"Fern","importance":"minor","first_seen_index":1}],"relationships":[],"locations":[],"up_to_section":0}' \
  "characters"

section "Charlotte's Web — TTS with Word Sync"

run_test "TTS — Charlotte opening line (dyslexia: slower rate)" POST /tts/synthesize \
  '{"text":"Where is Papa going with that axe?","disability_type":"dyslexia","language":"english"}' \
  "audio_base64"

run_test "TTS — Charlotte quote (ADHD: clear voice)" POST /tts/synthesize \
  '{"text":"Wilbur never forgot Charlotte. She was in a class by herself.","disability_type":"adhd","language":"english"}' \
  "timestamps"

echo -e "\n${YELLOW}▶ TTS word-sync detail — famous Charlotte line${RESET}"
curl -s -X POST "$BASE_URL/tts/synthesize" \
  -H "Content-Type: application/json" \
  -d '{"text":"It is not often that someone comes along who is a true friend and a good writer.","disability_type":"dyslexia","language":"english"}' \
  | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'  voice:      {d.get(\"voice\")}')
print(f'  rate:       {d.get(\"rate\")}')
print(f'  duration:   {d.get(\"duration_ms\")} ms')
print(f'  word_count: {d.get(\"word_count\")}')
stamps = d.get('timestamps', [])
print(f'  timestamps ({len(stamps)} words):')
for t in stamps[:5]:
    print(f'    {t[\"word\"]:15s} {t[\"start_ms\"]:5}ms → {t[\"end_ms\"]:5}ms')
if len(stamps) > 5:
    print(f'    ... and {len(stamps)-5} more')
" 2>/dev/null || echo "  (parse error — is service running?)"

section "Charlotte's Web — Adaptive Quiz Difficulty"

run_test "First quiz — no history (dyslexia student)" POST /quiz/recommend-difficulty \
  '{"student_id":"fern_student","literature_id":"charlottes_web","disability_type":"dyslexia"}' \
  "difficulty"

# Simulate a student reading Charlotte's Web chapter by chapter
echo -e "\n  ${YELLOW}Simulating Fern's reading journey through Charlotte's Web…${RESET}"

curl -s -X POST "$BASE_URL/quiz/record-attempt" \
  -H "Content-Type: application/json" \
  -d '{"student_id":"fern_student","literature_id":"charlottes_web","chapter_index":0,"score":0.55,"difficulty":"easy","disability_type":"dyslexia"}' > /dev/null
echo -e "    Ch1: score 55% (easy)  → recorded"

curl -s -X POST "$BASE_URL/quiz/record-attempt" \
  -H "Content-Type: application/json" \
  -d '{"student_id":"fern_student","literature_id":"charlottes_web","chapter_index":1,"score":0.70,"difficulty":"easy","disability_type":"dyslexia"}' > /dev/null
echo -e "    Ch2: score 70% (easy)  → recorded"

curl -s -X POST "$BASE_URL/quiz/record-attempt" \
  -H "Content-Type: application/json" \
  -d '{"student_id":"fern_student","literature_id":"charlottes_web","chapter_index":2,"score":0.85,"difficulty":"medium","disability_type":"dyslexia"}' > /dev/null
echo -e "    Ch3: score 85% (medium)→ recorded"

run_test "Recommended difficulty after 3 chapters" POST /quiz/recommend-difficulty \
  '{"student_id":"fern_student","literature_id":"charlottes_web","disability_type":"dyslexia"}' \
  "difficulty"

echo -e "\n${YELLOW}▶ Full adaptive state after Fern's journey${RESET}"
curl -s "$BASE_URL/quiz/student-state?student_id=fern_student&literature_id=charlottes_web" \
  | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'  ability (theta):    {d.get(\"theta\", \"?\")}')
print(f'  attempts:           {d.get(\"total_attempts\", \"?\")}')
print(f'  avg score:          {d.get(\"avg_score\", \"?\")}')
print(f'  next difficulty:    {d.get(\"next_difficulty\", \"?\")}')
print(f'  trajectory:         {d.get(\"trajectory\", \"?\")}')
hist = d.get('history', [])
if hist:
    print(f'  chapter history:')
    for h in hist:
        print(f'    Ch{h[\"chapter_index\"]}: {int(h[\"score\"]*100)}% ({h[\"difficulty\"]})')
" 2>/dev/null || echo "  (parse error)"

section "Charlotte's Web — Quiz Generation"

run_test "Generate 3 questions from Ch1 text" POST /quiz/generate \
  '{"content":"Charlotte was a spider who lived in a barn. She was brilliant at writing words in her web. Her first message was SOME PIG, which amazed everyone on the farm. Wilbur the pig was overwhelmed with gratitude and began to believe in himself.","doc_type":"novel","count":3,"language":"english"}' \
  "questions"

print_response "Full quiz output — Charlotte Ch1" POST /quiz/generate \
  '{"content":"Charlotte was a spider who lived in a barn. She was brilliant at writing words in her web. Her first message was SOME PIG, which amazed everyone on the farm. Wilbur the pig was overwhelmed with gratitude and began to believe in himself.","doc_type":"novel","count":3,"language":"english"}'

# =============================================================================
# SUMMARY
# =============================================================================

TOTAL=$((PASS + FAIL))
echo ""
echo -e "${CYAN}══════════════════════════════════════${RESET}"
echo -e "${CYAN}  Results: $PASS/$TOTAL passed${RESET}"
if [ $FAIL -gt 0 ]; then
  echo -e "  ${RED}$FAIL failed${RESET}"
fi
echo -e "${CYAN}══════════════════════════════════════${RESET}"

[ $FAIL -eq 0 ] && exit 0 || exit 1
