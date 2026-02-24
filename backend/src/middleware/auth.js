import admin from '../config/firebase-admin.js';

export const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    // You can attach the decoded token or fetch a more detailed user profile from db

    // NOTE: attaching decodedToken.uid as userId for compatibility with existing routes
    req.user = {
      ...decodedToken,
      userId: decodedToken.uid
    };
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};