import { db, getCookie, json, cookie } from '../lib/_db.js';
import { hashToken } from '../lib/_auth.js';
export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });
  try {
    const token = getCookie(req, 'vll_5s_session');
    if (token) await db()`DELETE FROM five_s_sessions WHERE token_hash=${hashToken(token)}`;
    res.setHeader('Set-Cookie', cookie('vll_5s_session', '', 0));
    return json(res, 200, { ok: true });
  } catch (e) { return json(res, 500, { error: e.message || 'Logout failed.' }); }
}
