import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      ok: false,
      success: false,
      message: 'Access denied: Missing or invalid Authorization Bearer header',
      data: null,
      error: 'Unauthorized'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({
      ok: false,
      success: false,
      message: 'Forbidden: Invalid or expired JWT token',
      data: null,
      error: 'TokenExpiredOrInvalid'
    });
  }
};

export const requireRole = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        ok: false,
        success: false,
        message: 'Unauthorized: User authentication required',
        data: null,
        error: 'Unauthorized'
      });
    }

    const userRole = req.user.role || 'trader';

    if (allowedRoles.length > 0 && !allowedRoles.includes(userRole) && userRole !== 'super_admin') {
      return res.status(403).json({
        ok: false,
        success: false,
        message: `Forbidden: Role '${userRole}' does not have sufficient permissions to access this endpoint`,
        data: null,
        error: 'InsufficientPermissions'
      });
    }

    next();
  };
};
