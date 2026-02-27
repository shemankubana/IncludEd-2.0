import express from 'express';
import { upload } from '../config/upload.js';
import { authenticateToken } from '../middleware/auth.js';
import axios from 'axios';
import fs from 'fs';
import FormData from 'form-data';

const router = express.Router();

// POST /api/video/transcribe
router.post('/transcribe', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No video file provided' });
        }

        console.log(`🎬 Transcribing video: ${req.file.originalname}`);

        const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8082';

        // Prepare formData for the AI service
        const formData = new FormData();
        formData.append('file', fs.createReadStream(req.file.path), {
            filename: req.file.originalname,
            contentType: req.file.mimetype,
        });

        const response = await axios.post(`${aiServiceUrl}/video/transcribe`, formData, {
            headers: {
                ...formData.getHeaders(),
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            timeout: 600000, // 10 minutes for large videos
        });

        // Clean up
        fs.unlinkSync(req.file.path);

        res.json(response.data);
    } catch (error) {
        console.error('❌ Transcription error:', error.message);
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: 'Transcription failed. Whisper model might be loading or file too large.' });
    }
});

export default router;
