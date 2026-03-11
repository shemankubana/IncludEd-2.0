import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { upload } from '../config/multer.js';
import { Literature } from '../models/Literature.js';
import { processPDF } from '../services/pdfProcessor.js';
import { splitIntoChapters } from '../services/chapterSplitter.js';
import { generateQuestions } from '../services/questionGenerator.js';
import { sequelize } from '../config/database.js';

const router = express.Router();

// Upload PDF and Image endpoint
router.post('/upload', authenticateToken, upload.fields([
  { name: 'file', maxCount: 1 },
  { name: 'image', maxCount: 1 }
]), async (req, res) => {
  try {
    const { title, author, language, subject, content, simplifyText, generateAudio, difficulty, curriculumOutcomeCode, gradeLevel } = req.body;
    const files = req.files;
    const pdfFile = files?.file?.[0];
    const imageFile = files?.image?.[0];

    const isSimplifyEnabled = simplifyText === 'true';
    const isAudioEnabled = generateAudio === 'true';

    let originalContent, adaptedContent, wordCount;
    let finalContentType = 'generic';
    let finalSections = [];
    const _rawLang = language || 'en';
    let aiDetectedLanguage = (_rawLang === 'fr' || _rawLang === 'french') ? 'french' : 'english';

    if (pdfFile) {
      console.log(`📄 Processing PDF: ${pdfFile.originalname}`);

      // Extract text locally
      const processed = await processPDF(pdfFile.path, { simplifyText: isSimplifyEnabled });
      originalContent = processed.originalContent;
      adaptedContent = processed.adaptedContent;
      wordCount = processed.wordCount;

      // Regex-based chapter detection
      const basicSplit = await splitIntoChapters(originalContent);
      finalContentType = basicSplit.contentType;
      finalSections = basicSplit.sections;

    } else if (content) {
      console.log(`✍️ Processing raw text input`);
      originalContent = content;
      adaptedContent = content;
      wordCount = content.split(/\s+/).length;

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
      bookBrain: null,
      uploadedBy: req.user.userId,
      schoolId: user?.schoolId || null,
      status: 'ready',
      questionsGenerated: 0,
      generateAudio: isAudioEnabled,
      difficulty: difficulty || 'beginner',
      contentType: finalContentType,
      curriculumOutcomeCode: curriculumOutcomeCode || null,
      gradeLevel: gradeLevel || null
    });

    console.log(`💾 Saved to database: ${literature.id}`);

    // Background: generate quizzes via local question generator
    setImmediate(async () => {
      try {
        console.log(`🧩 Background periodic quiz generation for: ${literature.title}`);
        let totalCount = 0;
        const chunkSize = 3;
        
        // Group sections into chunks of 3
        for (let i = 0; i < finalSections.length; i += chunkSize) {
          const chunk = finalSections.slice(i, i + chunkSize);
          const chunkContent = chunk.map(s => s.content).join('\n\n');
          const quizNumber = Math.floor(i / chunkSize) + 1;
          const rangeLabel = `Chapters ${i + 1}-${Math.min(i + chunkSize, finalSections.length)}`;
          const chapterTitle = `Quiz ${quizNumber}: ${rangeLabel}`;

          console.log(`   - Generating ${chapterTitle}`);
          
          const count = await generateQuestions(literature.id, chunkContent, {
            count: 5, // 5 questions per chunk
            docType: finalContentType,
            language: aiDetectedLanguage === 'french' ? 'fr' : 'en',
            chunkIndex: quizNumber,
            chapterTitle: chapterTitle
          });
          totalCount += count;
        }

        await literature.update({ questionsGenerated: totalCount });
        console.log(`✅ Periodic quiz generation done: ${totalCount} questions across ${Math.ceil(finalSections.length / chunkSize)} chunks`);
      } catch (err) {
        console.warn(`⚠️ Background periodic quiz generation failed: ${err.message}`);
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
      curriculumOutcomeCode: literature.curriculumOutcomeCode,
      gradeLevel: literature.gradeLevel
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
        questionsGenerated: 5,
        gradeLevel: 'P6',
        curriculumOutcomeCode: 'P6-LIT-DEMO'
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
      attributes: ['id', 'title', 'author', 'subject', 'language', 'wordCount', 'questionsGenerated', 'status', 'imageUrl', 'difficulty', 'averageRating', 'ratingCount', 'createdAt', 'curriculumOutcomeCode', 'gradeLevel']
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

// Re-process existing literature using local chapter splitter
router.post('/:id/reprocess', authenticateToken, async (req, res) => {
  try {
    const literature = await Literature.findByPk(req.params.id);
    if (!literature) return res.status(404).json({ error: 'Not found' });

    const textToProcess = literature.originalContent || literature.adaptedContent;
    if (!textToProcess) return res.status(400).json({ error: 'No content to process' });

    const { splitIntoChapters } = await import('../services/chapterSplitter.js');
    const result = await splitIntoChapters(textToProcess);
    const contentType = result.contentType;
    const sections = result.sections;

    await literature.update({ contentType, sections });
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
  const transaction = await sequelize.transaction();
  try {
    const literature = await Literature.findByPk(req.params.id);

    if (!literature) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Literature not found' });
    }

    if (literature.uploadedBy !== req.user.userId && req.user.role !== 'admin') {
      await transaction.rollback();
      return res.status(403).json({ error: 'You do not have permission to delete this content' });
    }

    const { Quiz } = await import('../models/Quiz.js');
    const { LessonProgress } = await import('../models/LessonProgress.js');
    const { Session } = await import('../models/Session.js');
    const { RLTrainingData } = await import('../models/RLTrainingData.js');

    console.log(`🗑️  Starting cleanup for literature: ${req.params.id}`);

    // 1. Delete associated data in correct order (children first)
    // a. RL Training Data (depends on Session)
    const sessionIds = (await Session.findAll({
      where: { literatureId: req.params.id },
      attributes: ['id']
    })).map(s => s.id);

    if (sessionIds.length > 0) {
      console.log(`   - Deleting ${sessionIds.length} sessions and related RL data`);
      await RLTrainingData.destroy({ where: { sessionId: sessionIds }, transaction });
      await Session.destroy({ where: { id: sessionIds }, transaction });
    }

    // b. Quizzes
    const quizCount = await Quiz.destroy({ where: { literatureId: req.params.id }, transaction });
    console.log(`   - Deleted ${quizCount} quizzes`);

    // c. Lesson Progress
    const progressCount = await LessonProgress.destroy({ where: { literatureId: req.params.id }, transaction });
    console.log(`   - Deleted ${progressCount} progress records`);

    // 2. Finally delete the literature entry
    await literature.destroy({ transaction });

    await transaction.commit();
    console.log(`✅ Fully deleted: ${literature.title}`);

    res.json({ success: true, message: 'Content and associated data deleted successfully' });
  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error('❌ Delete error:', error);
    res.status(500).json({ error: `Delete failed: ${error.message}` });
  }
});

export default router;
