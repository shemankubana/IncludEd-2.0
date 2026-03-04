/**
 * detectContentType(text)
 *
 * Heuristically determines if text is a 'play', 'novel', or 'generic'.
 */
function detectContentType(text) {
    const sample = text.slice(0, 12000);
    const upper = sample.toUpperCase();
    const lines = sample.split('\n').map(l => l.trim()).filter(Boolean);

    let playScore = 0;
    let novelScore = 0;

    // ── Play indicators ──────────────────────────────────────────────────────
    // ACT or SCENE headings (handles 'ACT I', 'Act 1', 'ACT ONE', 'SCENE II.' etc.)
    if (/\bACT\s+(I{1,3}V?|VI{0,3}|\d{1,2}|ONE|TWO|THREE|FOUR|FIVE)\b/i.test(sample)) playScore += 5;
    if (/\bSCENE\s+(I{1,3}V?|VI{0,3}|\d{1,2}|ONE|TWO|THREE|FOUR|FIVE)\b/i.test(sample)) playScore += 4;

    // Stage directions: [Aside], (Enter Macbeth), etc.
    if (/\[(Enter|Exit|Exeunt|Aside|Re-enter|Flourish)/i.test(sample)) playScore += 4;
    if (/\(\s*(Enter|Exit|Exeunt|Aside|Flourish)/i.test(sample)) playScore += 3;

    // Character cue lines: 'MACBETH.' or 'LADY MACBETH.' at start of line
    const speakerCueCount = lines.filter(l =>
        /^[A-Z][A-Z\s\-']{1,28}\.$/.test(l) && l.length < 35
    ).length;
    if (speakerCueCount >= 3) playScore += 6;
    else if (speakerCueCount >= 1) playScore += 3;

    // ALL-CAPS standalone lines (character names without period)
    const allCapsLines = lines.filter(l =>
        /^[A-Z][A-Z\s]{1,25}$/.test(l) && l.length > 2 && l.length < 30
    ).length;
    if (allCapsLines >= 5) playScore += 3;
    else if (allCapsLines >= 2) playScore += 1;

    // Known drama keywords
    if (/\b(dramatis personae|tragedy|comedy|prologue|epilogue)\b/i.test(sample)) playScore += 3;

    // ── Novel indicators ─────────────────────────────────────────────────────
    // Line-start chapter headings (standard format)
    if (/^CHAPTER\s+(I{1,3}V?|VI{0,3}|\d+|ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN)/im.test(sample)) novelScore += 5;
    if (/^PART\s+(I{1,3}V?|VI{0,3}|\d+|ONE|TWO|THREE)/im.test(sample)) novelScore += 3;
    // Inline chapter headings (Planet eBook / some scan formats: "Chapter 1 ...")
    const inlineChapters = (sample.match(/\bChapter\s+\d+\b/gi) || []).length;
    if (inlineChapters >= 2) novelScore += 4;
    else if (inlineChapters >= 1) novelScore += 2;

    // Long paragraphs (3+ sentences) are more likely novels
    const longParagraphs = sample.split('\n\n').filter(p => (p.match(/\./g) || []).length >= 3).length;
    if (longParagraphs >= 5) novelScore += 2;

    console.log(`🔍 Detection scores — Play: ${playScore}, Novel: ${novelScore}`);

    if (playScore >= 5) return 'play';
    if (novelScore >= 5) return 'novel';
    if (playScore >= 3) return 'play';
    if (novelScore >= 3) return 'novel';
    return 'generic';
}

/**
 * parsePlayDialogue(content)
 *
 * Parses a play section into structured dialogue objects:
 * [
 *   { type: 'stage_direction', text: '...' },
 *   { type: 'speaker', name: 'JULIET', lines: ['line1', 'line2'] },
 *   { type: 'narrative', text: '...' }
 * ]
 */
function parsePlayDialogue(content) {
    const lines = content.split('\n');
    const parsed = [];
    let i = 0;

    // Character cue: ALL CAPS name with optional trailing period
    // Handles: 'MACBETH.', 'LADY MACBETH.', 'MACBETH', 'FIRST WITCH.'
    const speakerPattern = /^([A-Z][A-Z\s\-']{0,33}?)\.?\s*(?:\[.*?\])?\s*$/;
    function isSpeaker(line) {
        if (line.length > 36 || line.length < 2) return false;
        if (line.includes(',') || line.includes(';') || line.includes('?') || line.includes('!')) return false;
        return speakerPattern.test(line) && /^[A-Z]/.test(line);
    }
    // Stage directions
    const stagePattern = /^\[.*\]$|^\(.*\)$|^(ENTER|EXIT|EXEUNT|RE-ENTER|ASIDE|FLOURISH|ALARUM|SENNET)\b/i;

    while (i < lines.length) {
        const line = lines[i].trim();
        if (!line) { i++; continue; }

        if (stagePattern.test(line)) {
            parsed.push({ type: 'stage_direction', text: line });
            i++;
            continue;
        }

        if (isSpeaker(line) && i + 1 < lines.length) {
            const speakerName = line.replace(/\.$/, '').replace(/\s*\[.*?\]/, '').trim();
            const dialogueLines = [];
            i++;
            while (
                i < lines.length &&
                lines[i].trim() &&
                !isSpeaker(lines[i].trim()) &&
                !stagePattern.test(lines[i].trim())
            ) {
                dialogueLines.push(lines[i].trim());
                i++;
            }
            if (dialogueLines.length > 0) {
                parsed.push({ type: 'speaker', name: speakerName, lines: dialogueLines });
            }
            continue;
        }

        parsed.push({ type: 'narrative', text: line });
        i++;
    }

    return parsed;
}

/**
 * splitPlay(text)
 * Splits a play by Act/Scene headings, parses dialogue per section.
 */
function splitPlay(text) {
    const actScenePattern = /^(ACT\s+[IVXLCDM\d]+|SCENE\s+[IVXLCDM\d]+|PROLOGUE|EPILOGUE)[.,:]?\s*(.*)?$/im;
    const lines = text.split('\n');
    const sections = [];
    let currentTitle = 'Opening';
    let currentLines = [];

    for (const line of lines) {
        if (actScenePattern.test(line.trim())) {
            const prevContent = currentLines.join('\n').trim();
            if (prevContent.length > 30) {
                sections.push({
                    title: currentTitle,
                    content: prevContent,
                    dialogue: parsePlayDialogue(prevContent)
                });
            }
            currentTitle = line.trim();
            currentLines = [];
        } else {
            currentLines.push(line);
        }
    }

    const last = currentLines.join('\n').trim();
    if (last.length > 30) {
        sections.push({ title: currentTitle, content: last, dialogue: parsePlayDialogue(last) });
    }

    return sections.length > 0 ? sections : splitByWordCount(text, 600, 'play');
}

/**
 * splitNovel(text)
 * Splits a novel by CHAPTER/PART headings.
 */
function splitNovel(text) {
    // Handles both line-start ("CHAPTER 1") and inline ("Chapter 1 Text starts here...")
    const chapterPattern = /^(CHAPTER|PART|BOOK|VOLUME)\s+([IVXLCDM\d]+|ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE)[.:]?\s*(.*)?$/im;
    const inlineChapterPattern = /\b(Chapter\s+\d+)\b/i;
    const namedHeadingPattern = /^([A-Z][A-Z '.]{3,50})$/m;
    const lines = text.split('\n');
    const sections = [];
    let currentTitle = 'Prologue';
    let currentLines = [];

    for (const line of lines) {
        const trimmed = line.trim();
        const isChapterHeading = chapterPattern.test(trimmed);
        const isNamedHeading = namedHeadingPattern.test(trimmed) && trimmed.length < 60 && trimmed.length > 3;
        // Detect inline chapter: "Chapter 1 Some content..." — split and keep content
        const inlineMatch = !isChapterHeading && inlineChapterPattern.exec(trimmed);
        const isInlineChapter = inlineMatch && trimmed.indexOf(inlineMatch[0]) < 20;

        if (isChapterHeading || isNamedHeading || isInlineChapter) {
            const prevContent = currentLines.join('\n').trim();
            if (prevContent.length > 100) {
                sections.push({ title: currentTitle, content: prevContent });
            }
            if (isInlineChapter && inlineMatch) {
                // "Chapter 3 The party began..." → title="Chapter 3", first line = rest of text
                currentTitle = inlineMatch[0];
                const rest = trimmed.slice(trimmed.indexOf(inlineMatch[0]) + inlineMatch[0].length).trim();
                currentLines = rest ? [rest] : [];
            } else {
                currentTitle = trimmed;
                currentLines = [];
            }
        } else {
            currentLines.push(line);
        }
    }

    const last = currentLines.join('\n').trim();
    if (last.length > 100) {
        sections.push({ title: currentTitle, content: last });
    }

    return sections.length > 1 ? sections : splitByWordCount(text, 600, 'novel');
}

/**
 * Fallback: split by every N words
 */
function splitByWordCount(text, wordsPerPage = 600, type = 'generic') {
    const words = text.split(/\s+/);
    const sections = [];
    const totalPages = Math.ceil(words.length / wordsPerPage);

    for (let i = 0; i < totalPages; i++) {
        const pageWords = words.slice(i * wordsPerPage, (i + 1) * wordsPerPage);
        const content = pageWords.join(' ');
        sections.push({
            title: `Page ${i + 1}`,
            content,
            ...(type === 'play' ? { dialogue: parsePlayDialogue(content) } : {})
        });
    }

    return sections;
}

/**
 * splitIntoChapters(text)
 *
 * Main export. Detects content type and returns:
 * {
 *   contentType: 'play' | 'novel' | 'generic',
 *   sections: Array<{ title: string, content: string, dialogue?: DialogueLine[] }>
 * }
 */
export async function splitIntoChapters(text) {
    const contentType = detectContentType(text);
    console.log(`📖 Content type detected: ${contentType.toUpperCase()}`);

    // Deterministic regex-based splitting
    let sections;
    if (contentType === 'play') {
        sections = splitPlay(text);
    } else if (contentType === 'novel') {
        sections = splitNovel(text);
    } else {
        sections = splitByWordCount(text, 600, 'generic');
    }

    return { contentType, sections };
}
