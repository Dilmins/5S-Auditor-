import bcrypt from 'bcryptjs';
import { db, json, readBody } from '../lib/_db.js';
import { requireUser, requireAdmin } from '../lib/_auth.js';
export default async function handler(req, res) {
  try {
    const admin = await requireUser(req, res); if (!admin) return; if (!requireAdmin(admin, res)) return;
    const id = Number(req.query?.id); if (!id) return json(res, 400, { error: 'User id is required.' });
    const sql = db();
    if (req.method === 'PATCH') {
      const b = await readBody(req);
      if (b.password) { const hash = await bcrypt.hash(b.password, 12); await sql`UPDATE five_s_users SET password_hash=${hash} WHERE id=${id}`; }
      if (b.full_name) await sql`UPDATE five_s_users SET full_name=${b.full_name} WHERE id=${id}`;
      if (b.role && ['internal', 'external', 'admin'].includes(b.role)) await sql`UPDATE five_s_users SET role=${b.role} WHERE id=${id}`;
      if (typeof b.is_active === 'boolean') await sql`UPDATE five_s_users SET is_active=${b.is_active} WHERE id=${id}`;
      // Auditors can now be assigned to more than one organisation. The Assign
      // tab adds/removes one organisation at a time rather than replacing the
      // whole set, so these are additive/subtractive rather than a full PATCH.
      if ('add_organisation_id' in b) {
        const organisationId = Number(b.add_organisation_id);
        const orgExists = await sql`SELECT id FROM five_s_organisations WHERE id=${organisationId} LIMIT 1`;
        if (!orgExists.length) return json(res, 400, { error: 'Unknown organisation.' });
        await sql`INSERT INTO five_s_user_organisations(user_id, organisation_id) VALUES(${id}, ${organisationId}) ON CONFLICT DO NOTHING`;
        // No sites are auto-granted here — the admin picks which of the
        // organisation's sites this auditor actually needs from the Assign
        // tab's site dropdown, one at a time.
      }
      // Per-site toggles for the Assign tab's site dropdown. organisation_id
      // is required and every row is (user, organisation, site)-scoped, so
      // these never touch — or get confused with — a same-named site under
      // a different organisation.
      if ('add_site' in b) {
        const organisationId = Number(b.organisation_id);
        const site = String(b.add_site || '').trim();
        if (!organisationId || !site) return json(res, 400, { error: 'organisation_id and add_site are required.' });
        await sql`INSERT INTO five_s_user_sites(user_id, organisation_id, site) VALUES(${id}, ${organisationId}, ${site}) ON CONFLICT DO NOTHING`;
      }
      if ('remove_site' in b) {
        const organisationId = Number(b.organisation_id);
        const site = String(b.remove_site || '').trim();
        if (!organisationId || !site) return json(res, 400, { error: 'organisation_id and remove_site are required.' });
        await sql`DELETE FROM five_s_user_sites WHERE user_id=${id} AND organisation_id=${organisationId} AND site=${site}`;
      }
      if ('remove_organisation_id' in b) {
        const organisationId = Number(b.remove_organisation_id);
        await sql`DELETE FROM five_s_user_organisations WHERE user_id=${id} AND organisation_id=${organisationId}`;
        // organisation_id is now on every row, so dropping this org's sites
        // is an exact match — no risk of touching another org's same-named site.
        await sql`DELETE FROM five_s_user_sites WHERE user_id=${id} AND organisation_id=${organisationId}`;
      }
      if (Array.isArray(b.sites)) {
        const organisationId = Number(b.organisation_id);
        if (!organisationId) return json(res, 400, { error: 'organisation_id is required when replacing sites.' });
        await sql`DELETE FROM five_s_user_sites WHERE user_id=${id} AND organisation_id=${organisationId}`;
        for (const site of b.sites) await sql`INSERT INTO five_s_user_sites(user_id, organisation_id, site) VALUES(${id}, ${organisationId}, ${site}) ON CONFLICT DO NOTHING`;
      }
      return json(res, 200, { ok: true });
    }
    if (req.method === 'DELETE') { await sql`DELETE FROM five_s_users WHERE id=${id}`; return json(res, 200, { ok: true }); }
    return json(res, 405, { error: 'Method not allowed.' });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: e.message || 'User update failed.' });
  }
}
