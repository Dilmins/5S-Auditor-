import { db, json, readBody } from './_db.js';
import { requireUser, requireAdmin } from './_auth.js';

export default async function handler(req, res) {
  const sql = db();
  try {
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
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: e.message || 'Organisation request failed.' });
  }
}
