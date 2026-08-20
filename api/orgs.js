import { db, json, readBody } from '../lib/_db.js';
import { requireUser, requireAdmin } from '../lib/_auth.js';

export default async function handler(req, res) {
  const sql = db();
  const resource = req.query?.resource || 'organisations';

  try {
    if (resource === 'organisations') {
      if (req.method === 'GET') {
        // Public on purpose: the signup form needs this list before a session
        // exists, and the metabar org selector needs it too.
        const rows = await sql`SELECT id, name FROM five_s_organisations ORDER BY name`;
        return json(res, 200, { organisations: rows });
      }
      if (req.method === 'POST') {
        const user = await requireUser(req, res); if (!user) return;
        if (!requireAdmin(user, res)) return;
        const b = await readBody(req);
        const name = String(b.name || '').trim();
        if (!name) return json(res, 400, { error: 'Organisation name is required.' });
        const existing = await sql`SELECT id FROM five_s_organisations WHERE lower(name)=lower(${name}) LIMIT 1`;
        if (existing.length) return json(res, 409, { error: 'That organisation already exists.' });
        const rows = await sql`INSERT INTO five_s_organisations(name) VALUES(${name}) RETURNING id, name`;
        return json(res, 201, { organisation: rows[0] });
      }
      return json(res, 405, { error: 'Method not allowed.' });
    }

    if (resource === 'sites') {
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
    }

    return json(res, 400, { error: 'Unknown resource. Use ?resource=organisations or ?resource=sites.' });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: e.message || 'Request failed.' });
  }
}
