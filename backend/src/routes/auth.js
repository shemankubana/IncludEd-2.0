import express from 'express';
import { User } from '../models/User.js';
import { School } from '../models/School.js';
import { StudentStats } from '../models/StudentStats.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// POST /api/auth/sync — called after Firebase signup to create/update backend user record
router.post('/sync', authenticateToken, async (req, res) => {
  try {
    const { email, firstName, lastName, role, schoolCode, classLevel, term, yearEnrolled } = req.body;
    const firebaseUid = req.user.uid;

    // ── Resolve school from code ─────────────────────────────────────
    let schoolId = null;
    if (schoolCode) {
      const school = await School.findOne({ where: { code: schoolCode.toUpperCase(), isActive: true } });
      if (!school) {
        return res.status(400).json({ error: 'Invalid school code. Please check with your school administrator.' });
      }
      schoolId = school.id;
    }

    // ── Determine status ─────────────────────────────────────────────
    // Teachers start as pending_approval; students and admins start as active
    const status = role === 'teacher' ? 'pending_approval' : 'active';

    // ── Create or update user ────────────────────────────────────────
    let user = await User.findOne({ where: { email } });

    if (user) {
      await user.update({ firstName, lastName, role, schoolId, classLevel, term, yearEnrolled });
    } else {
      user = await User.create({
        id: firebaseUid,
        email,
        firstName,
        lastName,
        role: role || 'student',
        schoolId,
        status,
        classLevel: classLevel || null,
        term: term || null,
        yearEnrolled: yearEnrolled || new Date().getFullYear()
      });
    }

    // ── Init student stats on first signup ───────────────────────────
    if (role === 'student') {
      await StudentStats.findOrCreate({
        where: { userId: firebaseUid },
        defaults: { schoolId, xp: 0, level: 1, streak: 0 }
      });
    }

    res.status(200).json({
      message: 'User synchronized',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
        schoolId: user.schoolId
      }
    });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/auth/me — get current user profile with school info
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.uid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // ── Role-mismatch check (optional query param) ────────────────────
    // Frontend can pass ?expectedRole=teacher to validate on login
    // ALLOW teachers to pass as students for Preview Mode support
    const { expectedRole } = req.query;
    if (expectedRole && user.role !== expectedRole) {
      const isTeacherPreviewing = (user.role === 'teacher' && expectedRole === 'student');

      if (!isTeacherPreviewing) {
        return res.status(403).json({
          error: `This account is registered as a ${user.role}, not a ${expectedRole}.`,
          actualRole: user.role,
          code: 'ROLE_MISMATCH'
        });
      }
    }

    // ── Teacher suspension check ─────────────────────────────────────
    if (user.status === 'pending_approval') {
      return res.status(403).json({
        error: 'Your teacher account is pending admin approval. Please wait for your school administrator to approve your account.',
        code: 'PENDING_APPROVAL'
      });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({
        error: 'Your account has been suspended. Contact your school administrator.',
        code: 'SUSPENDED'
      });
    }

    // ── Fetch school name ─────────────────────────────────────────────
    let school = null;
    if (user.schoolId) {
      school = await School.findByPk(user.schoolId, {
        attributes: ['id', 'name', 'city', 'code', 'logoUrl']
      });
    }

    res.json({ ...user.toJSON(), school });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/auth/profile — update own profile (name, phone, picture)
router.patch('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.uid);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { firstName, lastName, phoneNumber, profilePicture, classLevel, term } = req.body;
    await user.update({ firstName, lastName, phoneNumber, profilePicture, classLevel, term });

    res.json({ success: true, user: user.toJSON() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;