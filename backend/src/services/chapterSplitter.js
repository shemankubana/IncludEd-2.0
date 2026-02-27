import axios from 'axios';

/**
 * splitIntoChapters(text)
 * 
 * Intelligently splits book/play text into named chapters, acts, or scenes.
 * Now uses Ollama via AI Service for "smart" splitting, with regex fallback.
 * 
 * Returns an array of: [{ title: string, content: string }]
 */
export async function splitIntoChapters(text) {
    // Try Smart Splitting via AI Service first
    try {
        const aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:8082';
        console.log(`🧠 Requesting smart structuring from AI Service...`);

        const response = await axios.post(`${aiUrl}/structure-content`, {
            content: text.slice(0, 50000) // Limit to 50k chars for structuring
        }, { timeout: 15000 });

        if (response.data && response.data.units && response.data.units.length > 0) {
            console.log(`✅ Smart structuring successful: ${response.data.units.length} units detected.`);
            return response.data.units.map(unit => ({
                title: unit.title || 'Untitled Section',
                content: unit.content || ''
            }));
        }
    } catch (err) {
        console.log(`⚠️ Smart structuring failed or timed out: ${err.message}. Falling back to Regex.`);
    }

    // Patterns to detect structural headings (case insensitive)
    const headingPatterns = [
        // Shakespeare / plays: ACT I, Act 2, ACT ONE, SCENE 1, SCENE II
        /^(ACT|SCENE|PROLOGUE|EPILOGUE)\s+([IVXLCDM]+|\d+|ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN)[\.\:]?\s*$/im,
        // Books: CHAPTER 1, Chapter One, CHAPTER I, Chapter:
        /^(CHAPTER)\s+([IVXLCDM]+|\d+|ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN)[\.\:]?\s*(.*)$/im,
        // Parts: PART 1, PART ONE
        /^(PART)\s+([IVXLCDM]+|\d+|ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN)[\.\:]?\s*(.*)$/im,
        // Book headings that are entirely uppercase and short (likely section headers)
        /^([A-Z][A-Z\s]{2,40}[\.\!]?)$/m,
    ];

    const lines = text.split('\n');
    const sections = [];
    let currentTitle = 'Introduction';
    let currentContentLines = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Check if the line is a structural heading
        const isHeading = headingPatterns.some(pattern => pattern.test(line));

        if (isHeading && line.length > 0 && line.length < 80) {
            // Save previous section if it has content
            const prevContent = currentContentLines.join('\n').trim();
            if (prevContent.length > 50) { // Only save sections with meaningful content
                sections.push({
                    title: currentTitle,
                    content: prevContent
                });
            }
            currentTitle = line;
            currentContentLines = [];
        } else {
            currentContentLines.push(lines[i]);
        }
    }

    // Save final section
    const lastContent = currentContentLines.join('\n').trim();
    if (lastContent.length > 50) {
        sections.push({
            title: currentTitle,
            content: lastContent
        });
    }

    // If we couldn't detect any structural headings, fall back to word-count chunks
    if (sections.length <= 1) {
        return splitByWordCount(text, 500);
    }

    return sections;
}

/**
 * Fallback: split by every N words
 */
function splitByWordCount(text, wordsPerPage = 500) {
    const words = text.split(/\s+/);
    const sections = [];
    const totalPages = Math.ceil(words.length / wordsPerPage);

    for (let i = 0; i < totalPages; i++) {
        const pageWords = words.slice(i * wordsPerPage, (i + 1) * wordsPerPage);
        sections.push({
            title: `Page ${i + 1}`,
            content: pageWords.join(' ')
        });
    }

    return sections;
}
