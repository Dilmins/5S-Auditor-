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
        // Grant access to that organisation's current site list too (a single
        // tap in the Assign tab covers both org and site access). Existing
        // site access from other organisations is left untouched.
        if (!Array.isArray(b.sites)) {
          const orgSites = await sql`SELECT site FROM five_s_org_sites WHERE organisation_id=${organisationId}`;
          for (const r of orgSites) await sql`INSERT INTO five_s_user_sites(user_id, site) VALUES(${id}, ${r.site}) ON CONFLICT DO NOTHING`;
        }
      }
      // Per-site toggles for the Assign tab's site pills. Scoped to a single
      // site so they never touch a user's sites in other organisations
      // (unlike the bulk `sites` array below, which replaces the whole set).
      if ('add_site' in b) {
        const site = String(b.add_site || '').trim();
        if (site) await sql`INSERT INTO five_s_user_sites(user_id, site) VALUES(${id}, ${site}) ON CONFLICT DO NOTHING`;
      }
      if ('remove_site' in b) {
        const site = String(b.remove_site || '').trim();
        if (site) await sql`DELETE FROM five_s_user_sites WHERE user_id=${id} AND site=${site}`;
      }
      if ('remove_organisation_id' in b) {
        const organisationId = Number(b.remove_organisation_id);
        await sql`DELETE FROM five_s_user_organisations WHERE user_id=${id} AND organisation_id=${organisationId}`;
        // Drop site access that isn't covered by any of the user's remaining
        // organisations, so removing an org actually revokes its sites.
        if (!Array.isArray(b.sites)) {
          await sql`
            DELETE FROM five_s_user_sites usa
            WHERE usa.user_id=${id}
              AND NOT EXISTS (
                SELECT 1 FROM five_s_user_organisations uo
                JOIN five_s_org_sites os ON os.organisation_id = uo.organisation_id
                WHERE uo.user_id = ${id} AND os.site = usa.site
              )
          `;
        }
      }
      if (Array.isArray(b.sites)) {
        await sql`DELETE FROM five_s_user_sites WHERE user_id=${id}`;
        for (const site of b.sites) await sql`INSERT INTO five_s_user_sites(user_id, site) VALUES(${id}, ${site}) ON CONFLICT DO NOTHING`;
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
