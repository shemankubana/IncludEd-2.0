import express from 'express';
import { User } from '../models/User.js';
import { LessonProgress } from '../models/LessonProgress.js';
import { StudentStats } from '../models/StudentStats.js';
import { authenticateToken } from '../middleware/auth.js';
import { sendTeacherInvite } from '../services/emailService.js';

const router = express.Router();

// ── Helper: require admin role ────────────────────────────────────────────────
const requireAdmin = async (req, res, next) => {
    const user = await User.findByPk(req.user.userId);
    if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required.' });
    }
    next();
};

// GET /api/admin/users — list all users in the admin's school
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const admin = await User.findByPk(req.user.userId);
        const { role, status, search } = req.query;

        const where = { schoolId: admin.schoolId };
        if (role) where.role = role;
        if (status) where.status = status;

        let users = await User.findAll({
            where,
            attributes: ['id', 'email', 'firstName', 'lastName', 'role', 'status', 'classLevel', 'term', 'createdAt', 'profilePicture'],
            order: [['createdAt', 'DESC']]
        });

        // Client-side search filter
        if (search) {
            const q = search.toLowerCase();
            users = users.filter(u =>
                u.firstName.toLowerCase().includes(q) ||
                u.lastName.toLowerCase().includes(q) ||
                u.email.toLowerCase().includes(q)
            );
        }

        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/admin/pending-teachers — get teachers waiting for approval
router.get('/pending-teachers', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const admin = await User.findByPk(req.user.userId);
        const teachers = await User.findAll({
            where: { schoolId: admin.schoolId, role: 'teacher', status: 'pending_approval' },
            attributes: ['id', 'email', 'firstName', 'lastName', 'createdAt'],
            order: [['createdAt', 'ASC']]
        });
        res.json(teachers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PATCH /api/admin/users/:id/approve — approve a pending teacher
router.patch('/users/:id/approve', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found.' });

        await user.update({ status: 'active' });
        res.json({ success: true, message: `${user.firstName} is now approved.` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PATCH /api/admin/users/:id/suspend — suspend a user
router.patch('/users/:id/suspend', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found.' });

        await user.update({ status: 'suspended' });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PATCH /api/admin/users/:id/role — change a user's role
router.patch('/users/:id/role', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { role } = req.body;
        const user = await User.findByPk(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found.' });

        await user.update({ role });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/admin/users/:id — remove a user
router.delete('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found.' });

        await LessonProgress.destroy({ where: { userId: req.params.id } });
        await StudentStats.destroy({ where: { userId: req.params.id } });
        await user.destroy();

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/admin/stats — school-wide overview stats
router.get('/stats', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const admin = await User.findByPk(req.user.userId);
        const schoolId = admin.schoolId;

        const [totalStudents, totalTeachers, pendingTeachers] = await Promise.all([
            User.count({ where: { schoolId, role: 'student', status: 'active' } }),
            User.count({ where: { schoolId, role: 'teacher', status: 'active' } }),
            User.count({ where: { schoolId, role: 'teacher', status: 'pending_approval' } }),
        ]);

        res.json({ totalStudents, totalTeachers, pendingTeachers });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// POST /api/admin/invite-teacher — invite someone to create a teacher account
router.post('/invite-teacher', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });

        const admin = await User.findByPk(req.user.userId);
        const { School } = await import('../models/School.js');
        const school = admin.schoolId ? await School.findByPk(admin.schoolId) : null;
        if (!school) return res.status(400).json({ error: 'No school associated with your admin account' });

        const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:8080'}/auth?code=${school.code}&role=teacher`;

        try {
            await sendTeacherInvite({
                toEmail: email,
                adminName: `${admin.firstName} ${admin.lastName}`,
                schoolName: school.name,
                schoolCode: school.code,
            });
            console.log(`✉️ Teacher invite sent to ${email}`);
        } catch (emailErr) {
            console.warn(`⚠️ Teacher invite email failed: ${emailErr.message}`);
        }

        res.json({ message: `Teacher invitation sent to ${email}`, link: inviteLink });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
