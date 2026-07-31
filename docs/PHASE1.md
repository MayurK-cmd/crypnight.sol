# CrypNight.sol — Phase 1: Security Hardening

> Hand this file to Claude Code. Work through each section in order. Do not move to the next section until the current one is complete and tested.

---

## Context

The backend is a Node.js + Express app in `/backend/src/`. Supabase handles auth and the database. The frontend is React + Vite in `/frontend/src/`. Several security packages are already installed but not wired up — the goal of this phase is to close those gaps before any new features are built.

---

## Section 1 — Rate Limiting

`express-rate-limit` is already in `package.json`. It just needs to be configured and applied.

### 1.1 Create the rate limiter config

Create `/backend/src/middleware/rateLimiter.js`:

```js
const rateLimit = require('express-rate-limit');

// Tight limit for auth endpoints — brute force protection
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again in 15 minutes.' },
});

// General API limit — prevents scraping and DoS
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit exceeded. Slow down.' },
});

// Wallet linking — sensitive, keep very tight
const walletLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many wallet link attempts. Try again in an hour.' },
});

module.exports = { authLimiter, apiLimiter, walletLimiter };
```

### 1.2 Apply limiters in the main server file

In `/backend/src/server.js` (or `app.js`), add:

```js
const { authLimiter, apiLimiter, walletLimiter } = require('./middleware/rateLimiter');

// Apply general limit to all /api routes
app.use('/api', apiLimiter);

// Apply tight limit to auth routes
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/signup', authLimiter);

// Apply wallet limit to wallet linking route
app.use('/api/user/link-wallet', walletLimiter);
```

### 1.3 Verify

Run the server and hit `/api/auth/login` 11 times in quick succession. The 11th request should return a 429 with the error message above.

---

## Section 2 — Security Headers (helmet.js)

### 2.1 Install

```bash
cd backend && npm install helmet
```

### 2.2 Apply in server.js

Add near the top, before any route definitions:

```js
const helmet = require('helmet');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));
```

### 2.3 Tighten CORS

Replace the existing CORS config with environment-aware origins:

```js
const cors = require('cors');

const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [process.env.FRONTEND_URL] // e.g. https://crypnight.vercel.app
  : ['http://localhost:5173', 'http://localhost:3000'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: ${origin}`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
```

Add `FRONTEND_URL` to `/backend/.env`:

```
FRONTEND_URL=https://your-frontend-domain.vercel.app
```

### 2.4 Verify

Start the server and inspect response headers with `curl -I http://localhost:5000/api`. You should see `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`, and `Content-Security-Policy` headers present.

---

## Section 3 — Input Validation

### 3.1 Install Joi

```bash
cd backend && npm install joi
```

### 3.2 Create validation schemas

Create `/backend/src/middleware/validate.js`:

```js
const Joi = require('joi');

// Reusable validator middleware factory
const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({
      error: 'Validation failed',
      details: error.details.map(d => d.message),
    });
  }
  next();
};

// Auth schemas
const signupSchema = Joi.object({
  email: Joi.string().email().max(254).required(),
  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(/[A-Z]/, 'uppercase')
    .pattern(/[a-z]/, 'lowercase')
    .pattern(/[0-9]/, 'number')
    .pattern(/[^A-Za-z0-9]/, 'special character')
    .required()
    .messages({
      'string.pattern.name': 'Password must contain at least one {#name}',
      'string.min': 'Password must be at least 8 characters',
    }),
});

const loginSchema = Joi.object({
  email: Joi.string().email().max(254).required(),
  password: Joi.string().max(128).required(),
});

// Wallet schema — Solana base58 public key, 32–44 chars
const walletLinkSchema = Joi.object({
  walletAddress: Joi.string()
    .pattern(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/)
    .required()
    .messages({ 'string.pattern.base': 'Invalid Solana wallet address' }),
  signature: Joi.string().max(512).required(),
  message: Joi.string().max(256).required(),
});

// Tier selection
const tierSchema = Joi.object({
  tier: Joi.string()
    .valid('beginner', 'intermediate', 'pro', 'gm')
    .required(),
});

// Puzzle move submission
const moveSchema = Joi.object({
  sessionId: Joi.string().uuid().required(),
  move: Joi.string()
    .pattern(/^[a-h][1-8][a-h][1-8][qrbn]?$/)
    .required()
    .messages({ 'string.pattern.base': 'Invalid move format. Use UCI notation (e.g. e2e4)' }),
});

module.exports = {
  validate,
  schemas: { signupSchema, loginSchema, walletLinkSchema, tierSchema, moveSchema },
};
```

### 3.3 Apply validation to routes

In each route file, import and apply:

```js
const { validate, schemas } = require('../middleware/validate');

// Auth routes
router.post('/signup', validate(schemas.signupSchema), signupHandler);
router.post('/login', validate(schemas.loginSchema), loginHandler);

// Wallet route
router.post('/link-wallet', authMiddleware, validate(schemas.walletLinkSchema), linkWalletHandler);

// Tier route
router.post('/select-tier', authMiddleware, validate(schemas.tierSchema), selectTierHandler);

// Game move route
router.post('/move', authMiddleware, validate(schemas.moveSchema), submitMoveHandler);
```

### 3.4 Add request size limit

In `server.js`, replace or update `express.json()`:

```js
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
```

### 3.5 Verify

Send a signup request with a short password (e.g. `"pass"`). Should get 400 with validation details. Send a move with `"e2e9"` (invalid square). Should get 400.

---

## Section 4 — JWT Token Security

### 4.1 The problem

JWTs stored in `localStorage` are accessible to any JavaScript on the page — an XSS vulnerability can steal them. Move to `httpOnly` cookies.

### 4.2 Backend: set cookie on login/signup

In your auth handlers (login and signup success response), replace `return res.json({ token })` with:

```js
res.cookie('auth_token', token, {
  httpOnly: true,       // not accessible via JS
  secure: process.env.NODE_ENV === 'production',  // HTTPS only in prod
  sameSite: 'strict',  // CSRF protection
  maxAge: 24 * 60 * 60 * 1000,  // 24 hours
  path: '/',
});

return res.json({ success: true, user: { id, email, tier } });
// Do NOT send the token in the JSON body anymore
```

### 4.3 Backend: update auth middleware to read from cookie

In `/backend/src/middleware/auth.js`, update token extraction:

```js
const verifyAuth = (req, res, next) => {
  // Check cookie first, then fall back to Authorization header (for API clients)
  const token = req.cookies?.auth_token
    || req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
```

### 4.4 Install cookie-parser

```bash
cd backend && npm install cookie-parser
```

In `server.js`:

```js
const cookieParser = require('cookie-parser');
app.use(cookieParser());
```

### 4.5 Backend: logout endpoint clears the cookie

Add a logout route:

```js
router.post('/logout', (req, res) => {
  res.clearCookie('auth_token', { path: '/' });
  res.json({ success: true });
});
```

### 4.6 Frontend: remove localStorage token usage

Search the frontend for `localStorage.setItem` and `localStorage.getItem` calls related to the JWT token and remove them. The browser handles the cookie automatically.

Update Axios config so it sends cookies with every request:

In `/frontend/src/lib/axios.js` (or wherever Axios is configured):

```js
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,  // <-- this sends the cookie
});

export default api;
```

### 4.7 Update auth context

In `/frontend/src/context/AuthContext.jsx`, update login to read the user from the response body (no token extraction needed — cookie is handled by the browser):

```js
const login = async (email, password) => {
  const res = await api.post('/auth/login', { email, password });
  setUser(res.data.user);  // user object comes back, not token
};

const logout = async () => {
  await api.post('/auth/logout');
  setUser(null);
};
```

### 4.8 Verify

Log in, open DevTools → Application → Cookies. You should see `auth_token` with `HttpOnly` checked. The cookie should NOT appear in `document.cookie` in the console.

---

## Section 5 — Password Policy

### 5.1 Backend

The Joi schema in Section 3 already enforces: min 8 chars, uppercase, lowercase, number, special character. That is sufficient for now.

### 5.2 Frontend: password strength indicator

In the Signup component, add a simple visual strength meter:

```jsx
const getPasswordStrength = (password) => {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return score; // 0–5
};

const strengthLabel = ['', 'Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'];
const strengthColor = ['', '#ef4444', '#f97316', '#eab308', '#22c55e', '#16a34a'];

// In JSX:
{password && (
  <div className="mt-1">
    <div className="flex gap-1">
      {[1,2,3,4,5].map(i => (
        <div
          key={i}
          className="h-1 flex-1 rounded"
          style={{ background: i <= getPasswordStrength(password) ? strengthColor[getPasswordStrength(password)] : '#e5e7eb' }}
        />
      ))}
    </div>
    <p className="text-xs mt-1" style={{ color: strengthColor[getPasswordStrength(password)] }}>
      {strengthLabel[getPasswordStrength(password)]}
    </p>
  </div>
)}
```

---

## Section 6 — Email Verification Enforcement

### 6.1 Block unverified users from protected routes

In `/backend/src/middleware/auth.js`, after verifying the JWT, check email confirmation status via Supabase:

```js
const verifyAuth = async (req, res, next) => {
  const token = req.cookies?.auth_token
    || req.headers.authorization?.replace('Bearer ', '');

  if (!token) return res.status(401).json({ error: 'Authentication required' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if email is confirmed in Supabase
    const { data: { user }, error } = await supabase.auth.admin.getUserById(decoded.sub);

    if (error || !user) {
      return res.status(401).json({ error: 'User not found' });
    }

    if (!user.email_confirmed_at) {
      return res.status(403).json({ error: 'Please verify your email before continuing.' });
    }

    req.user = { ...decoded, supabaseUser: user };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
```

> Note: `supabase.auth.admin.getUserById` uses the service role key and is safe to call server-side only. Never expose the service role key to the frontend.

### 6.2 Frontend: show verification prompt

In `AuthContext`, if the API returns 403 with `"Please verify your email"`, show a banner instead of redirecting to login:

```jsx
// In your Axios response interceptor
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 403 && err.response?.data?.error?.includes('verify your email')) {
      // Set a state flag to show a banner
      showEmailVerificationBanner();
    }
    return Promise.reject(err);
  }
);
```

---

## Section 7 — Audit Logging

### 7.1 Create the audit log table in Supabase

Run this SQL in the Supabase SQL editor:

```sql
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  metadata jsonb default '{}',
  ip_address text,
  created_at timestamptz default now()
);

-- Index for querying by user
create index audit_logs_user_id_idx on audit_logs(user_id);
-- Index for querying by action type
create index audit_logs_action_idx on audit_logs(action);
```

### 7.2 Create the audit logger utility

Create `/backend/src/utils/auditLog.js`:

```js
const { supabase } = require('../config/supabase');

const AuditAction = {
  SIGNUP: 'auth.signup',
  LOGIN: 'auth.login',
  LOGIN_FAILED: 'auth.login_failed',
  LOGOUT: 'auth.logout',
  WALLET_LINKED: 'wallet.linked',
  WALLET_LINK_FAILED: 'wallet.link_failed',
  TIER_SELECTED: 'user.tier_selected',
  PUZZLE_SOLVED: 'game.puzzle_solved',
  PUZZLE_FAILED: 'game.puzzle_failed',
};

const logAction = async ({ userId, action, metadata = {}, ipAddress }) => {
  try {
    await supabase.from('audit_logs').insert({
      user_id: userId || null,
      action,
      metadata,
      ip_address: ipAddress || null,
    });
  } catch (err) {
    // Never let audit logging crash the app
    console.error('[audit_log] Failed to write:', err.message);
  }
};

const getClientIp = (req) =>
  req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;

module.exports = { logAction, getClientIp, AuditAction };
```

### 7.3 Add audit logging to key operations

In your auth handlers:

```js
const { logAction, getClientIp, AuditAction } = require('../utils/auditLog');

// On successful login
await logAction({
  userId: user.id,
  action: AuditAction.LOGIN,
  metadata: { email: user.email },
  ipAddress: getClientIp(req),
});

// On failed login
await logAction({
  action: AuditAction.LOGIN_FAILED,
  metadata: { email: req.body.email },
  ipAddress: getClientIp(req),
});

// On wallet link
await logAction({
  userId: req.user.id,
  action: AuditAction.WALLET_LINKED,
  metadata: { walletAddress },
  ipAddress: getClientIp(req),
});
```

---

## Section 8 — Final Checklist

Before closing Phase 1, verify every item:

- [ ] Hit `/api/auth/login` 11 times rapidly — get 429 on attempt 11
- [ ] Hit `/api/user/link-wallet` 6 times in an hour — get 429 on attempt 6
- [ ] `curl -I http://localhost:5000` shows `X-Frame-Options`, `X-Content-Type-Options`, `Content-Security-Policy`
- [ ] Signup with password `"short"` returns 400 with validation message
- [ ] Signup with valid email + strong password succeeds
- [ ] After login, `auth_token` cookie is present in browser DevTools with HttpOnly checked
- [ ] `document.cookie` in browser console does NOT show the token
- [ ] Logout clears the cookie
- [ ] Frontend API calls work with `withCredentials: true`
- [ ] Unverified email gets 403 on protected routes
- [ ] Audit logs appear in Supabase `audit_logs` table after login, wallet link, and tier selection
- [ ] CORS blocks requests from `http://evil.com` in production mode

---

## Environment Variables Checklist

Ensure these are set in `/backend/.env` and NOT committed to git:

```
PORT=5000
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
JWT_SECRET=                    # min 32 random chars
FRONTEND_URL=                  # your Vercel URL in production
NODE_ENV=development           # change to production on deploy
```

Ensure `.env` is in `/backend/.gitignore`. Double-check with `git status` before any commit.