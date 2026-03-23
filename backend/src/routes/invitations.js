import express from 'express';
import crypto from 'crypto';
import { Invitation } from '../models/Invitation.js';
import { User } from '../models/User.js';
import { School } from '../models/School.js';
import { StudentStats } from '../models/StudentStats.js';
import { authenticateToken } from '../middleware/auth.js';
import { sendInviteEmail } from '../services/emailService.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/invitations/send
// Admin sends teacher invite; Teacher sends student invite.
// Body: { email, role }   role ∈ { "teacher", "student" }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/send', authenticateToken, async (req, res) => {
  try {
    const { email, role } = req.body;
    if (!email || !role) return res.status(400).json({ error: 'email and role are required' });
    if (!['teacher', 'student'].includes(role)) return res.status(400).json({ error: 'role must be teacher or student' });

    const inviter = await User.findOne({ where: { id: req.user.uid } });
    if (!inviter) return res.status(404).json({ error: 'Inviter not found' });

    // Access control
    if (role === 'teacher' && inviter.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can invite teachers' });
    }
    if (role === 'student' && !['admin', 'teacher'].includes(inviter.role)) {
      return res.status(403).json({ error: 'Only admins or teachers can invite students' });
    }

    const school = await School.findByPk(inviter.schoolId);
    if (!school) return res.status(404).json({ error: 'School not found' });

    // Expire any old pending invite for this email+school+role
    await Invitation.update(
      { status: 'expired' },
      { where: { email, schoolId: school.id, role, status: 'pending' } }
    );

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await Invitation.create({
      email,
      role,
      token,
      schoolId: school.id,
      inviterId: inviter.id,
      status: 'pending',
      expiresAt,
    });

    await sendInviteEmail({
      toEmail: email,
      role,
      inviterName: `${inviter.firstName} ${inviter.lastName}`,
      schoolName: school.name,
      token,
    });

    res.json({ message: `Invitation sent to ${email}` });
  } catch (err) {
    console.error('Send invite error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/invitations/validate/:token
// Public — frontend calls this when user opens the magic link.
// Returns { email, role, schoolName } or 404/410.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/validate/:token', async (req, res) => {
  try {
    const invite = await Invitation.findOne({
      where: { token: req.params.token, status: 'pending' },
      include: [{ model: School, attributes: ['name', 'code'] }],
    });

    if (!invite) return res.status(404).json({ error: 'Invitation not found or already used' });
    if (new Date() > invite.expiresAt) {
      await invite.update({ status: 'expired' });
      return res.status(410).json({ error: 'This invitation has expired' });
    }

    res.json({
      email: invite.email,
      role: invite.role,
      schoolName: invite.School.name,
      schoolCode: invite.School.code,
    });
  } catch (err) {
    console.error('Validate invite error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/invitations/accept/:token
// Called after Firebase account creation.
// Body: { firstName, lastName, classLevel?, term? } + Firebase Bearer token
// ─────────────────────────────────────────────────────────────────────────────
router.post('/accept/:token', authenticateToken, async (req, res) => {
  try {
    const invite = await Invitation.findOne({
      where: { token: req.params.token, status: 'pending' },
      include: [{ model: School }],
    });

    if (!invite) return res.status(404).json({ error: 'Invitation not found or already used' });
    if (new Date() > invite.expiresAt) {
      await invite.update({ status: 'expired' });
      return res.status(410).json({ error: 'This invitation has expired' });
    }

    const { firstName, lastName, classLevel, term } = req.body;
    const firebaseUid = req.user.uid;
    const email = invite.email;

    // Verify the authenticated Firebase user matches the invited email
    if (req.user.email && req.user.email !== email) {
      return res.status(403).json({ error: 'Authenticated email does not match invitation email' });
    }

    const status = invite.role === 'teacher' ? 'pending_approval' : 'active';

    let user = await User.findOne({ where: { email } });
    if (user) {
      await user.update({ firstName, lastName, role: invite.role, schoolId: invite.schoolId, status });
    } else {
      user = await User.create({
        id: firebaseUid,
        email,
        firstName: firstName || '',
        lastName: lastName || '',
        role: invite.role,
        schoolId: invite.schoolId,
        status,
        classLevel: invite.role === 'student' ? (classLevel || null) : null,
        term: invite.role === 'student' ? (term || null) : null,
        yearEnrolled: new Date().getFullYear(),
      });
    }

    if (invite.role === 'student') {
      await StudentStats.findOrCreate({
        where: { userId: firebaseUid },
        defaults: { schoolId: invite.schoolId, xp: 0, level: 1, streak: 0 },
      });
    }

    await invite.update({ status: 'accepted' });

    res.json({
      message: 'Account set up successfully',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
        schoolId: user.schoolId,
      },
    });
  } catch (err) {
    console.error('Accept invite error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/invitations  (admin/teacher — list sent invitations for their school)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', authenticateToken, async (req, res) => {
  try {
    const inviter = await User.findOne({ where: { id: req.user.uid } });
    if (!inviter || !['admin', 'teacher'].includes(inviter.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const invites = await Invitation.findAll({
      where: { schoolId: inviter.schoolId },
      order: [['createdAt', 'DESC']],
      attributes: ['id', 'email', 'role', 'status', 'expiresAt', 'createdAt'],
    });

    res.json(invites);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
