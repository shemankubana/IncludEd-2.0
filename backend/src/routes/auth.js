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
    } else {
      // If no school code provided (e.g., manual test signups), assign a default school
      const existingSchool = await School.findOne({ where: { name: 'My School' } });
      if (existingSchool) {
        schoolId = existingSchool.id;
      } else {
        const newSchool = await School.create({
          name: 'My School',
          code: Math.random().toString(36).substring(2, 8).toUpperCase(),
          isActive: true
        });
        schoolId = newSchool.id;
      }
    }

    // ── Determine status ─────────────────────────────────────────────
    // Teachers start as pending_approval; students and admins start as active
    const status = role === 'teacher' ? 'pending_approval' : 'active';

    // ── Create or update user ────────────────────────────────────────
    let user = await User.findOne({ where: { email } });

    if (user) {
      const updates = {};
      if (firstName) updates.firstName = firstName;
      if (lastName) updates.lastName = lastName;
      if (classLevel) updates.classLevel = classLevel;
      if (term) updates.term = term;
      if (yearEnrolled) updates.yearEnrolled = yearEnrolled;

      // Only update role if explicitly provided in this payload
      if (role) updates.role = role;

      // If they provided a specific schoolCode, update their schoolId.
      // Or, if they currently have NO schoolId at all, assign the resolved (fallback) one.
      if (schoolId && (req.body.schoolCode || !user.schoolId)) {
        updates.schoolId = schoolId;
      }

      await user.update(updates);
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

    // ── Fetch student stats ───────────────────────────────────────────
    let stats = null;
    if (user.role === 'student') {
      stats = await StudentStats.findOne({ where: { userId: user.id } });
    }

    res.json({ ...user.toJSON(), school, stats });
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

// POST /api/auth/admin-setup — new school registration by an admin
// Body: { firstName, lastName, schoolName, country, city }
router.post('/admin-setup', authenticateToken, async (req, res) => {
  try {
    const { firstName, lastName, schoolName, country, city } = req.body;
    const firebaseUid = req.user.uid;
    const email = req.user.email;

    if (!schoolName) return res.status(400).json({ error: 'schoolName is required' });

    // Create school
    const code = (schoolName.replace(/\s+/g, '').toUpperCase().slice(0, 5) +
      Math.random().toString(36).substring(2, 5).toUpperCase());

    const school = await School.create({
      name: schoolName,
      code,
      country: country || 'Rwanda',
      city: city || null,
      isActive: true,
    });

    // Create admin user
    let user = await User.findOne({ where: { email } });
    if (user) {
      await user.update({ firstName, lastName, role: 'admin', schoolId: school.id, status: 'active' });
    } else {
      user = await User.create({
        id: firebaseUid,
        email,
        firstName: firstName || '',
        lastName: lastName || '',
        role: 'admin',
        schoolId: school.id,
        status: 'active',
      });
    }

    res.json({
      message: 'School and admin account created',
      school: { id: school.id, name: school.name, code: school.code },
      user: { id: user.id, email: user.email, role: user.role },
    });
  } catch (error) {
    console.error('Admin setup error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;