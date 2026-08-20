import { json } from './_db.js';
import { requireUser } from './_auth.js';
export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed.' });
  try { const user = await requireUser(req,res); if (!user) return; return json(res,200,{user}); }
  catch(e){ console.error(e); return json(res,500,{error:e.message||'Could not load user.'}); }
}
