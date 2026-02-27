import express from 'express';
import { School } from '../models/School.js';
import { User } from '../models/User.js';
import { authenticateToken } from '../middleware/auth.js';
import { upload } from '../config/upload.js';

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
            updates.logoUrl = `/uploads/${req.file.filename}`;
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
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });

        const user = await User.findByPk(req.user.userId);
        if (!user?.schoolId) return res.status(403).json({ error: 'No school associated with your account' });

        const school = await School.findByPk(user.schoolId);

        // In a real app, send email here
        const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:8080'}/auth?code=${school.code}&role=student`;

        console.log(`✉️ Invitation link for ${email}: ${inviteLink}`);

        res.json({
            message: `Invitation link generated for ${email}`,
            link: inviteLink,
            schoolName: school.name,
            code: school.code
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
