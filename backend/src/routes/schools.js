import { sendStudentInvite } from '../services/emailService.js';
import express from 'express';
import { School } from '../models/School.js';
import { User } from '../models/User.js';
import { authenticateToken } from '../middleware/auth.js';
import { upload } from '../config/upload.js';
import { uploadLocalFileToStorage } from '../services/storageService.js';

const router = express.Router();

// GET /api/schools/by-code/:code — resolve a school from its join code
router.get('/by-code/:code', async (req, res) => {
    try {
        const school = await School.findOne({
            where: { code: req.params.code.toUpperCase(), isActive: true },
            attributes: ['id', 'name', 'city', 'country', 'logoUrl']
        });

        if (!school) {
            return res.status(404).json({ error: 'School not found. Check your school code.' });
        }

        res.json(school);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/schools — list all schools (admin only)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const schools = await School.findAll({ order: [['name', 'ASC']] });
        res.json(schools);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/schools/mine — get the authenticated user's school
router.get('/mine', authenticateToken, async (req, res) => {
    try {
        const user = await User.findByPk(req.user.userId);
        if (!user?.schoolId) {
            return res.status(404).json({ error: 'No school associated with this account.' });
        }
        const school = await School.findByPk(user.schoolId, {
            attributes: ['id', 'name', 'city', 'country', 'code', 'logoUrl']
        });
        res.json(school);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/schools/mine — update school details (admin only)
router.put('/mine', authenticateToken, upload.single('logo'), async (req, res) => {
    try {
        const user = await User.findByPk(req.user.userId);
        if (user.role !== 'admin') {
            return res.status(403).json({ error: 'Only admins can update school details' });
        }

        const school = await School.findByPk(user.schoolId);
        if (!school) {
            return res.status(404).json({ error: 'School not found' });
        }

        const { name, city, country, emailDomain } = req.body;

        const updates = { name, city, country, emailDomain };
        if (req.file) {
            try {
                updates.logoUrl = await uploadLocalFileToStorage(req.file.path, req.file.originalname, req.file.mimetype, 'logos');
            } catch (storageErr) {
                console.warn(`⚠️  Firebase Storage upload failed, falling back to local path: ${storageErr.message}`);
                updates.logoUrl = `/uploads/${req.file.filename}`;
            }
        }

        await school.update(updates);
        res.json(school);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/schools/invite — "Send" an invitation (returns the link for now)
router.post('/invite', authenticateToken, async (req, res) => {
    try {
        const { email, role = 'student' } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });

        const user = await User.findByPk(req.user.userId);
        if (!user?.schoolId) return res.status(403).json({ error: 'No school associated with your account' });

        // Only admins can invite teachers
        if (role === 'teacher' && user.role !== 'admin') {
            return res.status(403).json({ error: 'Only admins can invite teachers' });
        }

        const school = await School.findByPk(user.schoolId);

        const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:8080'}/auth?code=${school.code}&role=${role}`;

        try {
            await sendStudentInvite({
                toEmail: email,
                teacherName: `${user.firstName} ${user.lastName}`,
                schoolName: school.name,
                schoolCode: school.code,
                role: role // Pass role to email service if supported
            });
            console.log(`✉️ ${role} invite sent to ${email}`);
        } catch (emailErr) {
            console.warn(`⚠️ Email failed (link still valid): ${emailErr.message}`);
        }

        res.json({
            message: `Invitation for ${role} sent to ${email}`,
            link: inviteLink,
            schoolName: school.name,
            code: school.code,
            role
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
