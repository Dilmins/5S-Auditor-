import { db, json } from './_db.js';
import { requireUser } from './_auth.js';

export default async function handler(req, res) {
  try {
    const user = await requireUser(req, res); if (!user) return;
    if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed.' });
    const sql = db();

    // Externals/admins aren't tied to one org, so they keep cross-org visibility.
    // Internal auditors see their own org's internal peers, plus all external
    // auditors (externals can audit any org, so internals still need to recognise them).
    const rows = (user.role === 'external' || user.role === 'admin')
      ? await sql`SELECT full_name, role FROM five_s_users WHERE is_active=TRUE AND role IN ('internal','external') ORDER BY full_name`
      : await sql`
          SELECT full_name, role FROM five_s_users
          WHERE is_active = TRUE AND (
            role = 'external' OR (role = 'internal' AND organisation_id = ${user.organisation_id})
          )
          ORDER BY full_name
        `;
    return json(res, 200, { auditors: rows });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: e.message || 'Could not load auditors.' });
  }
}
