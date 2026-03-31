import admin from '../config/firebase-admin.js';

export const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Development Bypass
  if (token === 'dev-admin' && process.env.NODE_ENV !== 'production') {
    req.user = {
      uid: 'dev-admin-id',
      userId: 'dev-admin-id',
      email: 'dev@included.com',
      role: 'admin'
    };
    return next();
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    // You can attach the decoded token or fetch a more detailed user profile from db

    // Use dynamic import for User to avoid circular dependencies in server startup
    const { User } = await import('../models/User.js');
    const dbUser = await User.findByPk(decodedToken.uid);

    if (!dbUser && req.path !== '/sync' && req.path !== '/me' && req.path !== '/submit' && req.path !== '/admin-setup' && req.originalUrl !== '/api/onboarding/submit') {
        // If user is not in DB and not trying to sync or check profile/onboarding, block with 404
        return res.status(404).json({ 
            error: 'User profile not found in database. Please sync your account.',
            code: 'USER_NOT_FOUND'
        });
    }

    // NOTE: attaching decodedToken.uid as userId for compatibility with existing routes
    req.user = {
      ...decodedToken,
      userId: decodedToken.uid,
      role: dbUser?.role || 'student', // Fallback to student if not found
      schoolId: dbUser?.schoolId
    };
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};