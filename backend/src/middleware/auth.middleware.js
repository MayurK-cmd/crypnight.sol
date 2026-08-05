import { supabase } from '../config/supabase.js';
import jwt from 'jsonwebtoken';

// PHASE 1 §4 — Read the auth token from the httpOnly cookie first; fall back to
// Authorization: Bearer for compatibility (e.g. server-to-server tools).
const extractToken = (req) => {
  if (req.cookies?.auth_token) return req.cookies.auth_token;
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.slice(7);
  return null;
};

export const verifyUser = async (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized, token missing' });
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    return res.status(401).json({ message: 'Unauthorized, invalid token' });
  }

  req.user = data.user;
  req.authToken = token;
  next();
};

// PHASE 1 §6 — Enforce that the user has confirmed their email.
// Run AFTER verifyUser (so req.user is populated).
export const requireVerified = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!req.user.email_confirmed_at) {
    return res.status(403).json({
      error: 'Please verify your email before continuing.',
    });
  }

  next();
};

// PHASE 4 — Socket.io auth — reads token from auth object or falls back to cookie
export const verifySocketAuth = async (socket, next) => {
  try {
    let token = socket.handshake.auth?.token;

    if (!token) {
      const cookieHeader = socket.handshake.headers.cookie || '';
      token = parseCookie(cookieHeader, 'auth_token');
    }

    if (!token) return next(new Error('Authentication required'));

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return next(new Error('Invalid token'));

    const user = data.user;
    if (!user.email_confirmed_at) return next(new Error('Email not verified'));

    const { data: profile } = await supabase
      .from('users')
      .select('wallet_address, tier, rating, username')
      .eq('id', user.id)
      .single();

    socket.user = {
      id: user.id,
      email: user.email,
      ...profile,
    };

    next();
  } catch (err) {
    next(new Error('Invalid token'));
  }
};

function parseCookie(cookieStr, name) {
  const match = cookieStr.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}
