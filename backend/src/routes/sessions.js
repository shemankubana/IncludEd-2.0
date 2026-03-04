import express from 'express';
import { Session } from '../models/Session.js';
import { RLTrainingData } from '../models/RLTrainingData.js';
import { StudentProfile } from '../models/StudentProfile.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * POST /api/sessions
 * Create a new reading session record.
 */
router.post('/', authenticateToken, async (req, res) => {
    try {
        const {
            literatureId,
            aiSessionId,
            disabilityType = 'none',
            textDifficulty = 0.5,
        } = req.body;

        const session = await Session.create({
            studentId: req.user.userId,
            literatureId,
            aiSessionId,
            disabilityType,
            textDifficulty,
            startedAt: new Date(),
            status: 'active',
        });

        res.status(201).json({ sessionId: session.id, aiSessionId });
    } catch (error) {
        console.error('❌ Session create error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * PATCH /api/sessions/:id
 * Update session with attention score, quiz score, and RL actions.
 * Call this when the AI service session ends.
 */
router.patch('/:id', authenticateToken, async (req, res) => {
    try {
        const session = await Session.findByPk(req.params.id);
        if (!session) return res.status(404).json({ error: 'Session not found' });
        if (session.studentId !== req.user.userId && req.user.role !== 'teacher' && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const {
            avgAttentionScore,
            avgSessionFatigue,
            completionRate,
            quizScore,
            quizAttempts,
            finalReward,
            rlActionsCount,
            rlActionsSummary,
            status = 'completed',
        } = req.body;

        const endedAt = new Date();
        const durationSeconds = Math.round((endedAt - session.startedAt) / 1000);

        await session.update({
            endedAt,
            durationSeconds,
            avgAttentionScore,
            avgSessionFatigue,
            completionRate,
            quizScore,
            quizAttempts,
            finalReward,
            rlActionsCount,
            rlActionsSummary,
            status,
        });

        // Update student profile cumulative stats
        const profile = await StudentProfile.findOne({ where: { userId: session.studentId } });
        if (profile) {
            const newTotal = profile.totalSessions + 1;
            const prevAttn = profile.avgAttentionScore * profile.totalSessions;
            const prevQuiz = profile.avgQuizScore * profile.totalSessions;
            await profile.update({
                totalSessions: newTotal,
                avgAttentionScore: avgAttentionScore != null
                    ? (prevAttn + avgAttentionScore) / newTotal
                    : profile.avgAttentionScore,
                avgQuizScore: quizScore != null
                    ? (prevQuiz + quizScore) / newTotal
                    : profile.avgQuizScore,
            });
        }

        res.json({ message: 'Session updated', session: session.toJSON() });
    } catch (error) {
        console.error('❌ Session update error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/sessions/:id/rl-data
 * Bulk-insert RL state-action-reward records for a session.
 */
router.post('/:id/rl-data', authenticateToken, async (req, res) => {
    try {
        const { records } = req.body; // Array of {stateVector, actionTaken, actionLabel, reward, stepNumber}
        if (!Array.isArray(records)) return res.status(400).json({ error: 'records must be an array' });

        const data = records.map(r => ({
            sessionId: req.params.id,
            studentId: req.user.userId,
            stateVector: r.stateVector,
            actionTaken: r.actionTaken,
            actionLabel: r.actionLabel,
            reward: r.reward,
            stepNumber: r.stepNumber || 1,
            isFinalReward: r.isFinalReward || false,
        }));

        await RLTrainingData.bulkCreate(data);
        res.status(201).json({ message: `${data.length} RL records saved` });
    } catch (error) {
        console.error('❌ RL Data write error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/sessions/student/:userId
 * Fetch all sessions for a specific student (teacher/admin access).
 */
router.get('/student/:userId', authenticateToken, async (req, res) => {
    try {
        const isOwner = req.user.userId === req.params.userId;
        const isAuthorized = req.user.role === 'teacher' || req.user.role === 'admin';
        if (!isOwner && !isAuthorized) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const sessions = await Session.findAll({
            where: { studentId: req.params.userId },
            order: [['startedAt', 'DESC']],
            limit: 50,
        });

        res.json(sessions);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/sessions/my
 * Fetch current user's own sessions.
 */
router.get('/my', authenticateToken, async (req, res) => {
    try {
        const sessions = await Session.findAll({
            where: { studentId: req.user.userId },
            order: [['startedAt', 'DESC']],
            limit: 20,
        });
        res.json(sessions);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/sessions/:id/telemetry
 * Receive a batch of telemetry events from the reader.
 * Events are stored in the session record for RL training.
 *
 * Body: { events: TelemetryEvent[] }
 */
router.post('/:id/telemetry', authenticateToken, async (req, res) => {
    try {
        const { events } = req.body;
        if (!Array.isArray(events)) {
            return res.status(400).json({ error: 'events must be an array' });
        }

        const session = await Session.findByPk(req.params.id);
        if (!session) return res.status(404).json({ error: 'Session not found' });

        // Compute derived attention metrics from events
        const scrollEvents     = events.filter(e => e.type === 'scroll');
        const backtrackEvents  = events.filter(e => e.type === 'backtrack');
        const dwellEvents      = events.filter(e => e.type === 'mouse_pause');
        const lapseEvents      = events.filter(e => e.type === 'attention_lapse');

        const backtrackFreq = scrollEvents.length > 0
            ? backtrackEvents.length / scrollEvents.length
            : 0;

        const avgDwell = dwellEvents.length > 0
            ? dwellEvents.reduce((s, e) => s + (e.payload?.dwell_ms || 0), 0) / dwellEvents.length
            : 0;

        const avgScrollSpeed = scrollEvents.length > 0
            ? scrollEvents.reduce((s, e) => s + Math.abs(e.payload?.speed || 0), 0) / scrollEvents.length
            : 0;

        const hesitantScrolls = scrollEvents.filter(e => Math.abs(e.payload?.speed || 0) < 0.5).length;
        const scrollHesitation = scrollEvents.length > 0
            ? hesitantScrolls / scrollEvents.length
            : 0;

        // Persist derived metrics onto session row
        const currentSummary = session.telemetrySummary || {};
        const updatedSummary = {
            ...currentSummary,
            eventCount:       (currentSummary.eventCount || 0) + events.length,
            backtrackCount:   (currentSummary.backtrackCount || 0) + backtrackEvents.length,
            lapseCount:       (currentSummary.lapseCount || 0) + lapseEvents.length,
            avgDwellMs:       avgDwell,
            avgScrollSpeed:   avgScrollSpeed,
            backtrackFreq:    backtrackFreq,
            scrollHesitation: scrollHesitation,
            lastUpdated:      Date.now(),
        };

        await session.update({ telemetrySummary: updatedSummary });

        res.json({ status: 'ok', processed: events.length });
    } catch (error) {
        console.error('❌ Telemetry error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/sessions/:id/rl-predict
 * Get real-time RL action recommendation given a telemetry state vector.
 * Calls the Python AI service RL endpoint.
 */
router.post('/:id/rl-predict', authenticateToken, async (req, res) => {
    try {
        const {
            reading_speed    = 0.5,
            mouse_dwell      = 0.0,
            scroll_hesitation = 0.0,
            backtrack_freq   = 0.0,
            attention_score  = 0.7,
            disability_type  = 0.0,
            text_difficulty  = 0.5,
            session_fatigue  = 0.0,
        } = req.body;

        const AI_URL = process.env.AI_SERVICE_URL || 'http://localhost:8082';

        const response = await fetch(`${AI_URL}/rl/predict`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                state_vector: [
                    reading_speed, mouse_dwell, scroll_hesitation, backtrack_freq,
                    attention_score, disability_type, text_difficulty, session_fatigue,
                ],
            }),
            signal: AbortSignal.timeout(500), // enforce <500ms latency
        });

        if (!response.ok) throw new Error('AI service unavailable');
        const data = await response.json();
        res.json(data);
    } catch (error) {
        // Rule-based fallback when AI service is down
        const { disability_type = 0.0, attention_score = 0.7, session_fatigue = 0.0 } = req.body;
        let actionId = 0;
        let actionLabel = 'Keep Original';

        if (disability_type >= 0.9) {
            actionId = session_fatigue > 0.6 ? 5 : 2;
            actionLabel = session_fatigue > 0.6 ? 'Attention Break' : 'Heavy Simplification';
        } else if (disability_type >= 0.4) {
            actionId = attention_score < 0.4 ? 4 : 3;
            actionLabel = attention_score < 0.4 ? 'Syllable Break' : 'TTS + Highlights';
        } else if (attention_score < 0.3) {
            actionId = 1;
            actionLabel = 'Light Simplification';
        }

        res.json({ action_id: actionId, action_label: actionLabel, fallback: true });
    }
});

export default router;
