import crypto from 'node:crypto';
import { db, getCookie, json } from './_db.js';
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}
export async function requireUser(req, res) {
  const token = getCookie(req, 'vll_5s_session');
  if (!token) { json(res, 401, { error: 'Authentication required.' }); return null; }
  const sql = db();
  const rows = await sql`
    SELECT u.id, u.username, u.full_name, u.role, u.is_active,
           COALESCE(array_agg(DISTINCT uo.organisation_id) FILTER (WHERE uo.organisation_id IS NOT NULL), '{}') AS organisation_ids,
           COALESCE(
             array_agg(DISTINCT jsonb_build_object('id', o.id, 'name', o.name)) FILTER (WHERE o.id IS NOT NULL),
             '{}'
           ) AS organisations,
           COALESCE(array_agg(DISTINCT usa.site) FILTER (WHERE usa.site IS NOT NULL), '{}') AS sites
    FROM five_s_users u
    JOIN five_s_sessions s ON s.user_id = u.id
    LEFT JOIN five_s_user_organisations uo ON uo.user_id = u.id
    LEFT JOIN five_s_organisations o ON o.id = uo.organisation_id
    LEFT JOIN five_s_user_sites usa ON usa.user_id = u.id
    WHERE s.token_hash = ${hashToken(token)}
      AND s.expires_at > NOW()
      AND u.is_active = TRUE
    GROUP BY u.id
  `;
  if (!rows.length) { json(res, 401, { error: 'Session expired. Please sign in again.' }); return null; }
  return rows[0];
}
export function canAccessSite(user, site) {
  return user.role === 'external' || user.role === 'admin' || user.sites.includes(site);
}
// Internal auditors can belong to more than one organisation. External
// auditors and admins pick the org per-audit, so they can access any organisation.
export function canAccessOrg(user, organisationId) {
  if (user.role === 'external' || user.role === 'admin') return true;
  return Array.isArray(user.organisation_ids) && user.organisation_ids.map(Number).includes(Number(organisationId));
}
export function requireAdmin(user, res) {
  if (!user || user.role !== 'admin') { json(res, 403, { error: 'Administrator access required.' }); return false; }
  return true;
}
export { hashToken };
