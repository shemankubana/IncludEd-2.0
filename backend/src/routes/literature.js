import express from 'express';
import { upload } from '../config/upload.js';
import { Literature } from '../models/Literature.js';
import { processPDF } from '../services/pdfProcessor.js';
import { generateQuestions } from '../services/questionGenerator.js';
import { splitIntoChapters } from '../services/chapterSplitter.js';
import { authenticateToken } from '../middleware/auth.js';
import axios from 'axios';

const router = express.Router();
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8082';

// Upload PDF endpoint
// Upload PDF and Image endpoint
router.post('/upload', authenticateToken, upload.fields([
  { name: 'file', maxCount: 1 },
  { name: 'image', maxCount: 1 }
]), async (req, res) => {
  try {
    const { title, author, language, subject, content, simplifyText, generateAudio, difficulty } = req.body;
    const files = req.files;
    const pdfFile = files?.file?.[0];
    const imageFile = files?.image?.[0];

    const isSimplifyEnabled = simplifyText === 'true';
    const isAudioEnabled = generateAudio === 'true';

    let originalContent, adaptedContent, wordCount;
    let finalContentType = 'generic';
    let finalSections = [];
    let aiDetectedLanguage = language || 'english'; // form value fallback

    if (pdfFile) {
      console.log(`📄 Processing PDF: ${pdfFile.originalname}`);

      // Step 1: Extract text (unlinking the file on completion)
      const processed = await processPDF(pdfFile.path, { simplifyText: isSimplifyEnabled });
      originalContent = processed.originalContent;
      adaptedContent = processed.adaptedContent;
      wordCount = processed.wordCount;

      // Step 2: Fast regex-based chapter detection for immediate response
      const basicSplit = await splitIntoChapters(originalContent);
      finalContentType = basicSplit.contentType;
      finalSections = basicSplit.sections;
      console.log(`📐 Basic split: ${finalContentType} (${finalSections.length} sections)`);

    } else if (content) {
      console.log(`✍️ Processing raw text input`);
      originalContent = content;
      adaptedContent = content;
      wordCount = content.split(/\s+/).length;

      // Basic split for raw text
      const split = await splitIntoChapters(originalContent);
      finalContentType = split.contentType;
      finalSections = split.sections;
    } else {
      return res.status(400).json({ error: 'No file or content provided' });
    }

    const user = await import('../models/User.js').then(m => m.User.findByPk(req.user.userId));

    const literature = await Literature.create({
      title: title || (pdfFile ? pdfFile.originalname.replace('.pdf', '') : 'New Lesson'),
      author: author || 'Unknown',
      language: aiDetectedLanguage,
      subject: subject || 'General',
      imageUrl: imageFile ? `/uploads/${imageFile.filename}` : null,
      originalContent,
      adaptedContent,
      wordCount,
      sections: finalSections,
      uploadedBy: req.user.userId,
      schoolId: user?.schoolId || null,
      status: 'ready',
      questionsGenerated: 0,
      generateAudio: isAudioEnabled,
      difficulty: difficulty || 'beginner',
      contentType: finalContentType
    });

    console.log(`💾 Saved to database: ${literature.id}`);

    // Background: run full ML analysis (structure + emotion + questions)
    // Uses /reanalyze-text so no PDF file needed
    setImmediate(async () => {
      try {
        console.log(`🧠 Background ML analysis for: ${literature.title}`);
        const aiResp = await axios.post(`${AI_SERVICE_URL}/reanalyze-text`, {
          text: originalContent,
          filename: `${literature.title}.txt`,
          generate_questions: true,
          question_count: 10,
        }, { timeout: 180000 }); // 3 min — allows cold model start

        if (aiResp.data && aiResp.data.flat_units?.length > 0) {
          const aiContentType = aiResp.data.document_type;
          const langCode = aiResp.data.language || 'en';
          const detectedLang = langCode === 'fr' ? 'french' : 'english';

          // Build a lookup from difficulty_map for per-section enriched metadata
          const difficultyLookup = {};
          for (const d of (aiResp.data.book_brain?.difficulty_map || [])) {
            if (d.section_id) difficultyLookup[d.section_id] = d;
            if (d.section_title) difficultyLookup[d.section_title] = d;
          }

          const aiSections = aiResp.data.flat_units.map(unit => {
            const enrichment = difficultyLookup[unit.id] || difficultyLookup[unit.title] || {};
            return {
              title: unit.title || 'Section',
              content: unit.content || '',
              dialogue: unit.dialogue || unit.blocks || [],
              wordCount: Math.ceil((unit.content || '').split(/\s+/).filter(Boolean).length),
              // Enriched per-section metadata (Phase 1)
              emotion: enrichment.emotion || 'neutral',
              setting: enrichment.setting || '',
              characters_present: enrichment.characters_present || [],
              archaic_phrases: enrichment.archaic_phrases || [],
              literary_devices: enrichment.literary_devices || [],
              faction: enrichment.faction || '',
              difficulty: enrichment.overall_difficulty || 0,
              estimated_read_minutes: enrichment.estimated_read_minutes || 1,
            };
          });

          // Use AI-extracted author if current one is unknown
          const aiAuthor = aiResp.data.author;
          const updatePayload = {
            contentType: aiContentType,
            sections: aiSections,
            language: detectedLang,
            status: 'ready',
          };
          if (aiAuthor && (!literature.author || literature.author === 'Unknown')) {
            updatePayload.author = aiAuthor;
          }

          // Store Book Brain pre-analysis (difficulty map, vocabulary, characters, struggle zones)
          if (aiResp.data.book_brain) {
            const bb = aiResp.data.book_brain;
            updatePayload.bookBrain = {
              vocabulary: (bb.vocabulary || []).slice(0, 80),
              characters: bb.characters || [],
              summary_stats: bb.summary_stats || {},
              struggle_zones: bb.struggle_zones || [],
              difficulty_map: (bb.difficulty_map || []).filter(d => d.overall_difficulty > 0.4),
              cultural_context_bank: bb.cultural_context_bank || [],
            };
          }

          // Per-section simplification — process in small batches to avoid overwhelming AI service
          console.log(`🔤 Simplifying ${aiSections.length} sections for: ${literature.title}`);
          let simplifiedCount = 0;
          for (const section of aiSections) {
            if (!section.content || section.content.trim().length === 0) continue;
            try {
              const sResp = await axios.post(`${AI_SERVICE_URL}/adapt-text`, {
                text: section.content.slice(0, 3000), // cap per-section to avoid slow Ollama calls
                doc_type: aiContentType,
              }, { timeout: 15000 });
              if (sResp.data?.adaptedText && sResp.data.adaptedText !== section.content.slice(0, 3000)) {
                section.simplified_content = sResp.data.adaptedText;
                simplifiedCount++;
              }
            } catch (_) { /* non-critical — section still readable without simplified_content */ }
          }
          console.log(`✅ Simplified ${simplifiedCount}/${aiSections.length} sections`);
          updatePayload.sections = aiSections; // re-assign with simplified_content added

          await literature.update(updatePayload);
          console.log(`✅ ML update: ${literature.title} → ${aiContentType} (${aiSections.length} sections)`);

          // Save AI questions
          const aiQuestions = aiResp.data.questions || [];
          if (aiQuestions.length > 0) {
            const { Quiz } = await import('../models/Quiz.js');
            const diffMap = {
              beginner: 'easy', intermediate: 'medium', advanced: 'hard',
              easy: 'easy', medium: 'medium', hard: 'hard'
            };
            const quizRecords = aiQuestions.map(q => ({
              literatureId: literature.id,
              question: q.question || q.q || 'Question',
              options: q.options || q.choices || [],
              correctAnswer: q.correct_answer ?? q.answer ?? q.correct ?? 0,
              explanation: q.explanation || '',
              difficulty: diffMap[q.difficulty] || 'medium',
            }));
            await Quiz.bulkCreate(quizRecords, { ignoreDuplicates: true });
            await literature.update({ questionsGenerated: quizRecords.length });
            console.log(`✅ Saved ${quizRecords.length} AI questions for: ${literature.title}`);
          }

          // Generate AI introduction — use first body section content, not raw front matter
          const firstBodyContent = aiSections.find(s => s.content?.trim().length > 50)?.content || '';
          try {
            const introResp = await axios.post(`${AI_SERVICE_URL}/introduction/generate`, {
              title: literature.title,
              author: updatePayload.author || literature.author,
              content_summary: firstBodyContent.slice(0, 1000),
              doc_type: aiContentType,
              language: langCode === 'fr' ? 'fr' : 'en'
            }, { timeout: 60000 });

            if (introResp.data?.introduction) {
              await literature.update({ introduction: introResp.data.introduction });
              console.log(`✅ Generated introduction for: ${literature.title}`);
            }
          } catch (err) {
            console.warn(`⚠️ Introduction generation failed: ${err.message}`);
            // Not critical - literature still works without it
          }
        }
      } catch (err) {
        console.warn(`⚠️ Background ML analysis failed for ${literature.title}: ${err.message}`);
        // Literature still usable with basic sections from splitIntoChapters
        // Fallback: generate questions via quiz service
        try {
          const questionCount = await generateQuestions(literature.id, adaptedContent || originalContent);
          await literature.update({ questionsGenerated: questionCount });
        } catch (_) { /* questions optional */ }
      }
    });

    res.json({
      id: literature.id,
      title: literature.title,
      author: literature.author,
      language: literature.language,
      contentType: finalContentType,
      status: 'ready',
      wordCount: literature.wordCount,
      estimatedMinutes: Math.ceil(literature.wordCount / 200),
      difficulty: literature.difficulty,
      questionsGenerated: 0,
      sectionCount: finalSections.length,
    });

  } catch (error) {
    console.error('❌ Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get current/latest literature for student
router.get('/current', authenticateToken, async (req, res) => {
  try {
    let literature = await Literature.findOne({
      where: { status: 'ready' },
      order: [['createdAt', 'DESC']]
    });

    // If no literature exists, create a demo
    if (!literature) {
      console.log('📝 No literature found, creating demo...');

      literature = await Literature.create({
        title: "Romeo and Juliet - Act 2, Scene 2 (Demo)",
        author: "William Shakespeare",
        language: "english",
        originalContent: `JULIET
O Romeo, Romeo! wherefore art thou Romeo?
Deny thy father and refuse thy name;
Or, if thou wilt not, be but sworn my love,
And I'll no longer be a Capulet.

ROMEO
[Aside] Shall I hear more, or shall I speak at this?

JULIET
'Tis but thy name that is my enemy;
Thou art thyself, though not a Montague.
What's Montague? it is nor hand, nor foot,
Nor arm, nor face, nor any other part
Belonging to a man. O, be some other name!
What's in a name? that which we call a rose
By any other name would smell as sweet;`,
        adaptedContent: `JULIET
Oh Romeo, Romeo! Why are you Romeo?
Leave your family and change your name.
Or, if you won't do that, just promise to love me.
And I'll stop being a Capulet.

ROMEO
[To himself] Should I listen more, or should I speak now?

JULIET
It's only your name that is my enemy.
You are yourself, even if you're not a Montague.
What is a Montague? It's not a hand, or foot.
Not an arm, or face, or any other body part.
Oh, choose a different name!
What's in a name? A rose by any other name would smell just as sweet.`,
        wordCount: 150,
        uploadedBy: req.user.userId,
        status: 'ready',
        subject: 'Literature',
        questionsGenerated: 5
      });

      console.log('✅ Demo literature created');
    }

    res.json(literature);

  } catch (error) {
    console.error('❌ Error fetching literature:', error);
    res.status(500).json({ error: error.message });
  }
});

// List only THIS teacher's uploaded content  ← must come BEFORE /:id
router.get('/my-content', authenticateToken, async (req, res) => {
  try {
    console.log(`📚 Fetching content for teacher: ${req.user.userId}`);
    const literature = await Literature.findAll({
      where: { uploadedBy: req.user.userId },
      order: [['createdAt', 'DESC']],
      attributes: ['id', 'title', 'author', 'subject', 'language', 'wordCount', 'questionsGenerated', 'status', 'imageUrl', 'difficulty', 'averageRating', 'ratingCount', 'createdAt']
    });
    console.log(`✅ Found ${literature.length} items`);
    const result = literature.map(l => ({
      ...l.toJSON(),
      estimatedMinutes: Math.ceil(l.wordCount / 200)
    }));
    res.json(result);
  } catch (error) {
    console.error('❌ My content error:', error);
    res.status(500).json({ error: error.message });
  }
});

// List all literature (for student dashboard / library)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const user = await import('../models/User.js').then(m => m.User.findByPk(req.user.userId));
    const schoolId = user?.schoolId;

    const literature = await Literature.findAll({
      where: schoolId ? { schoolId } : {},
      order: [['createdAt', 'DESC']],
      limit: 50
    });
    const result = literature.map(l => ({
      ...l.toJSON(),
      estimatedMinutes: Math.ceil(l.wordCount / 200)
    }));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Re-process existing literature using ML analyzer (front matter removal + re-classification)
router.post('/:id/reprocess', authenticateToken, async (req, res) => {
  try {
    const literature = await Literature.findByPk(req.params.id);
    if (!literature) return res.status(404).json({ error: 'Not found' });

    const textToProcess = literature.originalContent || literature.adaptedContent;
    if (!textToProcess) return res.status(400).json({ error: 'No content to process' });

    let contentType, sections, detectedLanguage;

    // Try ML analyzer first (applies front-matter filtering + French pattern support)
    try {
      const aiResp = await axios.post(`${AI_SERVICE_URL}/reanalyze-text`, {
        text: textToProcess,
        filename: `${literature.title}.txt`,
        generate_questions: false,
      }, { timeout: 15000 });

      if (aiResp.data && aiResp.data.flat_units?.length > 0) {
        contentType = aiResp.data.document_type;
        const langCode = aiResp.data.language || 'en';
        detectedLanguage = langCode === 'fr' ? 'french' : 'english';
        // Build enrichment lookup from book_brain difficulty_map
        const reprocessLookup = {};
        for (const d of (aiResp.data.book_brain?.difficulty_map || [])) {
          if (d.section_id) reprocessLookup[d.section_id] = d;
          if (d.section_title) reprocessLookup[d.section_title] = d;
        }
        sections = aiResp.data.flat_units.map(unit => {
          const enrichment = reprocessLookup[unit.id] || reprocessLookup[unit.title] || {};
          return {
            title: unit.title || 'Section',
            content: unit.content || '',
            dialogue: unit.dialogue || unit.blocks || [],
            wordCount: Math.ceil((unit.content || '').split(/\s+/).filter(Boolean).length),
            emotion: enrichment.emotion || 'neutral',
            setting: enrichment.setting || '',
            characters_present: enrichment.characters_present || [],
            archaic_phrases: enrichment.archaic_phrases || [],
            literary_devices: enrichment.literary_devices || [],
            faction: enrichment.faction || '',
            difficulty: enrichment.overall_difficulty || 0,
            estimated_read_minutes: enrichment.estimated_read_minutes || 1,
          };
        });
        console.log(`🧠 ML re-process: ${literature.title} → ${contentType} (${sections.length} sections, lang=${detectedLanguage})`);
      }
    } catch (err) {
      console.warn('⚠️ ML analyzer unavailable, falling back to basic splitter:', err.message);
    }

    // Fallback to basic splitter if AI service unavailable
    if (!sections) {
      const { splitIntoChapters } = await import('../services/chapterSplitter.js');
      const result = await splitIntoChapters(textToProcess);
      contentType = result.contentType;
      sections = result.sections;
    }

    const updatePayload = { contentType, sections };
    if (detectedLanguage) updatePayload.language = detectedLanguage;
    await literature.update(updatePayload);
    console.log(`♻️  Re-processed: ${literature.title} → ${contentType} (${sections.length} sections)`);

    res.json({
      success: true,
      contentType,
      sectionCount: sections.length,
      sections: sections.map(s => ({ title: s.title, hasDialogue: !!(s.dialogue?.length) })),
    });
  } catch (error) {
    console.error('❌ Reprocess error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Backfill per-section simplified_content for already-uploaded literature
router.post('/:id/simplify-sections', authenticateToken, async (req, res) => {
  try {
    const literature = await Literature.findByPk(req.params.id);
    if (!literature) return res.status(404).json({ error: 'Not found' });

    const sections = literature.sections;
    if (!sections || sections.length === 0) {
      return res.status(400).json({ error: 'No sections to simplify' });
    }

    const contentType = literature.contentType || 'generic';
    let simplifiedCount = 0;
    const updatedSections = [...sections];

    for (const section of updatedSections) {
      if (!section.content || section.content.trim().length === 0) continue;
      try {
        const sResp = await axios.post(`${AI_SERVICE_URL}/adapt-text`, {
          text: section.content.slice(0, 3000),
          doc_type: contentType,
        }, { timeout: 15000 });
        if (sResp.data?.adaptedText) {
          section.simplified_content = sResp.data.adaptedText;
          simplifiedCount++;
        }
      } catch (_) { /* skip failed section */ }
    }

    await literature.update({ sections: updatedSections });
    console.log(`✅ Backfilled ${simplifiedCount}/${updatedSections.length} sections for: ${literature.title}`);

    res.json({ success: true, simplifiedCount, totalSections: updatedSections.length });
  } catch (error) {
    console.error('❌ Simplify sections error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get specific literature by ID  ← dynamic route LAST
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const literature = await Literature.findByPk(req.params.id);

    if (!literature) {
      return res.status(404).json({ error: 'Literature not found' });
    }

    res.json({
      ...literature.toJSON(),
      estimatedMinutes: Math.ceil(literature.wordCount / 200)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a literature entry (only the uploader can delete)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const literature = await Literature.findByPk(req.params.id);

    if (!literature) {
      return res.status(404).json({ error: 'Literature not found' });
    }

    if (literature.uploadedBy !== req.user.userId) {
      return res.status(403).json({ error: 'You do not have permission to delete this content' });
    }

    // Delete associated records first to avoid foreign key constraints
    const { Quiz } = await import('../models/Quiz.js');
    const { LessonProgress } = await import('../models/LessonProgress.js');
    const { Session } = await import('../models/Session.js');
    const { RLTrainingData } = await import('../models/RLTrainingData.js');

    // 1. Delete Quizzes
    await Quiz.destroy({ where: { literatureId: req.params.id } });

    // 2. Delete Lesson Progress
    await LessonProgress.destroy({ where: { literatureId: req.params.id } });

    // 3. Delete Session-related data (RLTrainingData depends on Session)
    const sessionIds = (await Session.findAll({
      where: { literatureId: req.params.id },
      attributes: ['id']
    })).map(s => s.id);

    if (sessionIds.length > 0) {
      await RLTrainingData.destroy({ where: { sessionId: sessionIds } });
      await Session.destroy({ where: { id: sessionIds } });
    }

    await literature.destroy();
    console.log(`🗑️  Deleted: ${literature.title}`);

    res.json({ success: true, message: 'Content deleted successfully' });
  } catch (error) {
    console.error('❌ Delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;