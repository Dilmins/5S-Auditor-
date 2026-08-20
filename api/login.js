import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { db, json, readBody, cookie } from './_db.js';
import { hashToken } from './_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });
  try {
    const { username, password } = await readBody(req);
    if (!username || !password) return json(res, 400, { error: 'Username and password are required.' });
    const sql = db();
    const rows = await sql`SELECT * FROM five_s_users WHERE lower(username)=lower(${String(username).trim()}) AND is_active=TRUE LIMIT 1`;
    if (!rows.length || !(await bcrypt.compare(password, rows[0].password_hash))) return json(res, 401, { error: 'Invalid username or password.' });

    const token = crypto.randomBytes(32).toString('hex');
    await sql`INSERT INTO five_s_sessions (user_id, token_hash, expires_at) VALUES (${rows[0].id}, ${hashToken(token)}, NOW() + INTERVAL '12 hours')`;
    await sql`UPDATE five_s_users SET last_login_at=NOW() WHERE id=${rows[0].id}`;
    res.setHeader('Set-Cookie', cookie('vll_5s_session', token, 60*60*12));
    return json(res, 200, { ok: true });
  } catch (e) {
    console.error(e); return json(res, 500, { error: e.message || 'Login failed.' });
  }
}
