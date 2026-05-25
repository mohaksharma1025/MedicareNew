const crypto = require('crypto');

const ADMIN_COOKIE_NAME = 'medicare_admin';
const ADMIN_COOKIE_MAX_AGE = 1000 * 60 * 60 * 8;

function getSecret() {
  return process.env.SESSION_SECRET || 'medicare-secret-key';
}

function getCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: Boolean(process.env.VERCEL || process.env.NODE_ENV === 'production'),
    maxAge: ADMIN_COOKIE_MAX_AGE
  };
}

function parseCookies(cookieHeader) {
  return String(cookieHeader || '')
    .split(';')
    .map((cookie) => cookie.trim())
    .filter(Boolean)
    .reduce((cookies, cookie) => {
      const separatorIndex = cookie.indexOf('=');
      if (separatorIndex === -1) return cookies;
      const name = cookie.slice(0, separatorIndex);
      const value = cookie.slice(separatorIndex + 1);
      cookies[name] = decodeURIComponent(value);
      return cookies;
    }, {});
}

function sign(payload) {
  return crypto
    .createHmac('sha256', getSecret())
    .update(payload)
    .digest('base64url');
}

function createAdminToken() {
  const payload = Buffer.from(JSON.stringify({
    role: 'admin',
    exp: Date.now() + ADMIN_COOKIE_MAX_AGE
  })).toString('base64url');

  return `${payload}.${sign(payload)}`;
}

function verifyAdminToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return false;

  const [payload, signature] = token.split('.');
  const expectedSignature = sign(payload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (signatureBuffer.length !== expectedBuffer.length) return false;
  if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) return false;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return data.role === 'admin' && Number(data.exp) > Date.now();
  } catch (error) {
    return false;
  }
}

function isAdminRequest(req) {
  if (req.session && req.session.isAdmin) return true;
  const cookies = parseCookies(req.headers.cookie);
  return verifyAdminToken(cookies[ADMIN_COOKIE_NAME]);
}

function setAdminCookie(res) {
  res.cookie(ADMIN_COOKIE_NAME, createAdminToken(), getCookieOptions());
}

function clearAdminCookie(res) {
  res.clearCookie(ADMIN_COOKIE_NAME, getCookieOptions());
}

module.exports = {
  isAdminRequest,
  setAdminCookie,
  clearAdminCookie
};
