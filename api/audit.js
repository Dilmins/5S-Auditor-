import { db, json } from '../lib/_db.js';
import { requireUser, canAccessSite } from '../lib/_auth.js';
export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed.' });
  try {
    const user = await requireUser(req, res); if (!user) return;
    const site = req.query?.site || '', month = req.query?.month || '';
    if (!site || !month) return json(res, 400, { error: 'site and month are required.' });
    if (!canAccessSite(user, site)) return json(res, 403, { error: 'You are not authorised to view this site.' });
    const sql = db();
    // Internal auditors can only ever pull a record from their own org — even
    // if another org happens to reuse the same site code + month.
    const rows = user.role === 'internal'
      ? await sql`SELECT * FROM five_s_audits WHERE site=${site} AND audit_month=${month} AND organisation_id = ANY(${user.organisation_ids}) LIMIT 1`
      : await sql`SELECT * FROM five_s_audits WHERE site=${site} AND audit_month=${month} LIMIT 1`;
    if (!rows.length) return json(res, 404, { error: 'No saved audit found for this site/month.' });
    return json(res, 200, { audit: rows[0] });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: e.message || 'Could not load audit.' });
  }
}
