import { prisma } from '../lib/prisma.js';
import { verifyAccessToken } from '../utils/tokens.js';
import { unauthorized, forbidden } from '../utils/AppError.js';

// Requires a valid access token; attaches req.user.
export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw unauthorized();

    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) throw unauthorized('Account inactive or not found');

    req.user = { id: user.id, role: user.role, name: user.name, email: user.email };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return next(unauthorized('Token expired'));
    if (err.name === 'JsonWebTokenError') return next(unauthorized('Invalid token'));
    next(err);
  }
}

// Restrict a route to one or more roles.
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) return next(forbidden('Insufficient role'));
    next();
  };
}
