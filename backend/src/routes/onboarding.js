import express from 'express';
import { StudentProfile } from '../models/StudentProfile.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Save onboarding questionnaire results
router.post('/submit', authenticateToken, async (req, res) => {
    try {
        const { dyslexiaScore, adhdScore, disabilityType, preferences } = req.body;
        const userId = req.user.uid;

        // Ensure user record exists in the User table (auto-sync if missing)
        const { User } = await import('../models/User.js');
        const [dbUser] = await User.findOrCreate({
            where: { id: userId },
            defaults: {
                email: req.user.email || 'student@included.com',
                firstName: req.user.name?.split(' ')[0] || 'Student',
                lastName: req.user.name?.split(' ').slice(1).join(' ') || '',
                role: 'student',
                status: 'active'
            }
        });

        // Map disability type to encoded float for RL (must match ai-service/services/rl_agent_service.py)
        const encodedMap = {
            'none': 0.0,
            'dyslexia': 0.5,
            'adhd': 1.0,
            'both': 1.5 // Aligned with Python service
        };

        const disabilityTypeEncoded = encodedMap[disabilityType] || 0.0;

        let profile = await StudentProfile.findOne({ where: { userId } });

        if (profile) {
            await profile.update({
                dyslexiaScore,
                adhdScore,
                disabilityType,
                disabilityTypeEncoded,
                ...preferences
            });
        } else {
            profile = await StudentProfile.create({
                userId,
                dyslexiaScore,
                adhdScore,
                disabilityType,
                disabilityTypeEncoded,
                ...preferences
            });
        }

        res.status(200).json({ message: 'Onboarding completed', profile });
    } catch (error) {
        console.error('❌ Onboarding error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

export default router;
