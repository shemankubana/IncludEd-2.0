import express from 'express';
import { upload } from '../config/upload.js';  // ✅ FIXED IMPORT
import { Literature } from '../models/Literature.js';
import { processPDF } from '../services/pdfProcessor.js';
import { generateQuestions } from '../services/questionGenerator.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Upload PDF endpoint
// Upload PDF and Image endpoint
router.post('/upload', authenticateToken, upload.fields([
  { name: 'file', maxCount: 1 },
  { name: 'image', maxCount: 1 }
]), async (req, res) => {
  try {
    const { title, author, language, subject, content } = req.body;
    const files = req.files;
    const pdfFile = files?.file?.[0];
    const imageFile = files?.image?.[0];

    let originalContent, adaptedContent, wordCount;

    if (pdfFile) {
      console.log(`📄 Processing PDF: ${pdfFile.originalname}`);
      const processed = await processPDF(pdfFile.path);
      originalContent = processed.originalContent;
      adaptedContent = processed.adaptedContent;
      wordCount = processed.wordCount;
    } else if (content) {
      console.log(`✍️ Processing raw text input`);
      originalContent = content;
      adaptedContent = content;
      wordCount = content.split(/\s+/).length;
    } else {
      return res.status(400).json({ error: 'No file or content provided' });
    }

    // Create literature record
    const literature = await Literature.create({
      title: title || (pdfFile ? pdfFile.originalname.replace('.pdf', '') : 'New Lesson'),
      author: author || 'Unknown',
      language: language || 'english',
      subject: subject || 'General',
      imageUrl: imageFile ? `/uploads/${imageFile.filename}` : null,
      originalContent,
      adaptedContent,
      wordCount,
      uploadedBy: req.user.userId,
      status: 'ready',
      questionsGenerated: 0
    });

    console.log(`💾 Saved to database: ${literature.id}`);

    // Generate questions in background (don't wait)
    setImmediate(async () => {
      try {
        console.log(`❓ Generating questions for: ${literature.title}`);
        const questionCount = await generateQuestions(literature.id, adaptedContent);
        await literature.update({ questionsGenerated: questionCount });
        console.log(`✅ Generated ${questionCount} questions`);
      } catch (err) {
        console.error('❌ Question generation failed:', err.message);
      }
    });

    res.json({
      id: literature.id,
      title: literature.title,
      author: literature.author,
      language: literature.language,
      status: 'ready',
      wordCount: literature.wordCount,
      questionsGenerated: 0
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

// Get specific literature by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const literature = await Literature.findByPk(req.params.id);

    if (!literature) {
      return res.status(404).json({ error: 'Literature not found' });
    }

    res.json(literature);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List all literature (for teacher dashboard)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const literature = await Literature.findAll({
      order: [['createdAt', 'DESC']],
      limit: 50
    });

    res.json(literature);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;