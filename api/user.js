import bcrypt from 'bcryptjs';
import { db, json, readBody } from './_db.js';
import { requireUser, requireAdmin } from './_auth.js';

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

      if ('organisation_id' in b) {
        // null clears it (e.g. converting internal -> external); a number reassigns the org.
        const organisationId = b.organisation_id === null ? null : Number(b.organisation_id);
        if (organisationId !== null) {
          const orgExists = await sql`SELECT id FROM five_s_organisations WHERE id=${organisationId} LIMIT 1`;
          if (!orgExists.length) return json(res, 400, { error: 'Unknown organisation.' });
        }
        await sql`UPDATE five_s_users SET organisation_id=${organisationId} WHERE id=${id}`;
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
