import { db, json, readBody } from './_db.js';
import { requireUser, requireAdmin } from './_auth.js';

export default async function handler(req, res) {
  const sql = db();
  try {
    if (req.method === 'GET') {
      // Public on purpose: needed by the signup site-picker (for an existing
      // org) and by the metabar Plant Site dropdown, which reloads per org.
      const organisationId = Number(req.query?.organisation_id);
      if (!organisationId) return json(res, 400, { error: 'organisation_id is required.' });
      const rows = await sql`SELECT site FROM five_s_org_sites WHERE organisation_id=${organisationId} ORDER BY site`;
      return json(res, 200, { sites: rows.map(r => r.site) });
    }

    if (req.method === 'POST') {
      const user = await requireUser(req, res); if (!user) return;
      if (!requireAdmin(user, res)) return;
      const b = await readBody(req);
      const organisationId = Number(b.organisation_id);
      const site = String(b.site || '').trim();
      if (!organisationId || !site) return json(res, 400, { error: 'organisation_id and site are required.' });
      await sql`INSERT INTO five_s_org_sites(organisation_id, site) VALUES(${organisationId}, ${site}) ON CONFLICT DO NOTHING`;
      return json(res, 201, { ok: true });
    }

    if (req.method === 'DELETE') {
      const user = await requireUser(req, res); if (!user) return;
      if (!requireAdmin(user, res)) return;
      const organisationId = Number(req.query?.organisation_id);
      const site = req.query?.site || '';
      if (!organisationId || !site) return json(res, 400, { error: 'organisation_id and site are required.' });

      const existingAudits = await sql`SELECT id FROM five_s_audits WHERE organisation_id=${organisationId} AND site=${site} LIMIT 1`;
      if (existingAudits.length) return json(res, 409, { error: 'This site has saved audit history and cannot be removed. Deactivate the auditors assigned to it instead if it is no longer in use.' });

      await sql`DELETE FROM five_s_org_sites WHERE organisation_id=${organisationId} AND site=${site}`;
      return json(res, 200, { ok: true });
    }

    return json(res, 405, { error: 'Method not allowed.' });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: e.message || 'Site request failed.' });
  }
}
