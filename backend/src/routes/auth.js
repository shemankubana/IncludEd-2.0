import express from 'express';
import { User } from '../models/User.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Synchronize Firebase user with local database after signup
router.post('/sync', authenticateToken, async (req, res) => {
  try {
    const { email, firstName, lastName, role } = req.body;
    const firebaseUid = req.user.uid;

    // Check if user already exists
    let user = await User.findOne({ where: { email } });

    if (user) {
      // Update existing user with new info if necessary
      await user.update({ firstName, lastName, role });
    } else {
      // Create new user record
      user = await User.create({
        id: firebaseUid, // Use Firebase UID as the primary key
        email,
        firstName,
        lastName,
        role: role || 'student'
      });
    }

    res.status(200).json({ message: 'User synchronized', user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get current user profile
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.uid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;