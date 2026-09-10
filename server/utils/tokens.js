import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const REFRESH_TOKEN_TTL_DAYS = 30;
const ACCESS_TOKEN_TTL = '15m';

export const REFRESH_TOKEN_TTL_MS = REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

export const generateAccessToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL,
  });

// Raw refresh token sent to the client via the httpOnly cookie.
// Only its hash is ever stored server-side.
export const generateRefreshToken = () => crypto.randomBytes(64).toString('hex');

export const hashToken = (raw) => crypto.createHash('sha256').update(raw).digest('hex');

export const getRefreshTokenExpiry = () => new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
