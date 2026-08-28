import bcrypt from 'bcryptjs';
import { db, json, readBody } from '../lib/_db.js';
import { requireUser, requireAdmin } from '../lib/_auth.js';
export default async function handler(req, res) {
  try {
    const admin = await requireUser(req, res); if (!admin) return; if (!requireAdmin(admin, res)) return;
    const sql = db();
    if (req.method === 'GET') {
      const rows = await sql`
        SELECT u.id, u.username, u.full_name, u.role, u.is_active, u.last_login_at,
               u.organisation_id, o.name AS organisation,
               COALESCE(array_agg(usa.site ORDER BY usa.site) FILTER (WHERE usa.site IS NOT NULL), '{}') sites
        FROM five_s_users u
        LEFT JOIN five_s_organisations o ON o.id = u.organisation_id
        LEFT JOIN five_s_user_sites usa ON usa.user_id = u.id
        GROUP BY u.id, o.name
        ORDER BY u.full_name
      `;
      return json(res, 200, { users: rows });
    }
    if (req.method === 'POST') {
      const b = await readBody(req);
      if (!b.username || !b.full_name || !b.password || !['internal', 'external', 'admin'].includes(b.role))
        return json(res, 400, { error: 'username, full_name, password and role are required.' });
      // organisation_id is optional at creation time now: internal auditors
      // can be registered first and assigned to an organisation afterwards
      // from the Assign tab. If one is provided up front, validate it.
      let organisationId = null;
      if (b.role === 'internal' && b.organisation_id) {
        organisationId = Number(b.organisation_id);
        const orgExists = await sql`SELECT id FROM five_s_organisations WHERE id=${organisationId} LIMIT 1`;
        if (!orgExists.length) return json(res, 400, { error: 'Unknown organisation.' });
      }
      // external/admin: no organisation_id — externals pick org per-audit, admins aren't org-scoped.
      const hash = await bcrypt.hash(b.password, 12);
      const rows = await sql`
        INSERT INTO five_s_users(username, full_name, password_hash, role, is_active, organisation_id)
        VALUES(${String(b.username).trim().toLowerCase()}, ${b.full_name}, ${hash}, ${b.role}, TRUE, ${organisationId})
        RETURNING id, username, full_name, role
      `;
      const sites = Array.isArray(b.sites) ? b.sites : [];
      for (const site of sites) await sql`INSERT INTO five_s_user_sites(user_id, site) VALUES(${rows[0].id}, ${site}) ON CONFLICT DO NOTHING`;
      return json(res, 201, { user: rows[0] });
    }
    return json(res, 405, { error: 'Method not allowed.' });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: e.message || 'User request failed.' });
  }
}
