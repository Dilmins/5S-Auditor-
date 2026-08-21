import bcrypt from 'bcryptjs';
import { db, json, readBody } from '../lib/_db.js';
const PREDEFINED = {
  Ruwan: 'internal', Shanuka: 'internal', Arunoda: 'internal', Chanaka: 'internal',
  Roshan: 'external', Mahela: 'external', Damitha: 'external'
};
export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });
  try {
    const b = await readBody(req);
    const fullName = String(b.full_name || '').trim();
    const username = String(b.username || '').trim().toLowerCase();
    const password = String(b.password || '');
    if (!fullName || !username || !password) return json(res, 400, { error: 'Full name, username and password are required.' });
    if (password.length < 8) return json(res, 400, { error: 'Password must contain at least 8 characters.' });
    const role = PREDEFINED[fullName] || (['internal', 'external'].includes(b.role) ? b.role : null);
    if (!role) return json(res, 400, { error: 'Please select Auditor or Senior Auditor.' });
    const sql = db();
    const exists = await sql`SELECT id FROM five_s_users WHERE lower(username)=lower(${username}) LIMIT 1`;
    if (exists.length) return json(res, 409, { error: 'That username is already registered.' });
    let organisationId = null;
    let sites = [];
    if (role === 'internal') {
      // Internal auditors are locked to one organisation at signup, plus site(s) within it.
      const orgName = String(b.organisation || '').trim();
      if (!orgName) return json(res, 400, { error: 'Organisation is required for internal auditors.' });
      const existingOrg = await sql`SELECT id FROM five_s_organisations WHERE lower(name)=lower(${orgName}) LIMIT 1`;
      if (existingOrg.length) {
        organisationId = existingOrg[0].id;
        const orgSites = await sql`SELECT site FROM five_s_org_sites WHERE organisation_id=${organisationId}`;
        const validSites = new Set(orgSites.map(r => r.site));
        sites = Array.isArray(b.sites) ? b.sites.filter(s => validSites.has(s)) : [];
      } else {
        // Brand-new organisation: no site list exists yet, so this signup defines
        // the starting set. (Admin can add/edit sites afterwards — see admin.html work.)
        const created = await sql`INSERT INTO five_s_organisations(name) VALUES(${orgName}) RETURNING id`;
        organisationId = created[0].id;
        sites = Array.isArray(b.sites) ? [...new Set(b.sites.map(s => String(s).trim()).filter(Boolean))] : [];
        for (const site of sites) {
          await sql`INSERT INTO five_s_org_sites(organisation_id, site) VALUES(${organisationId}, ${site}) ON CONFLICT DO NOTHING`;
        }
      }
      if (!sites.length) return json(res, 400, { error: 'Internal auditors must select at least one assigned site.' });
    }
    // External auditors: organisation_id always stays null (they aren't locked
    // to one org — canAccessOrg()/canAccessSite() bypass checks for them, and
    // they pick an organisation per-audit instead, see audits.js). But they
    // may optionally create a brand-new organisation (+ starting sites) here,
    // the same ability the "+ Add organisation" control gives them post-login.
    let newOrgForExternal = null;
    if (role === 'external' && String(b.organisation || '').trim()) {
      const orgName = String(b.organisation).trim();
      const existingOrg = await sql`SELECT id, name FROM five_s_organisations WHERE lower(name)=lower(${orgName}) LIMIT 1`;
      if (existingOrg.length) {
        return json(res, 409, { error: 'That organisation already exists — you can select it after signing in.' });
      }
      const created = await sql`INSERT INTO five_s_organisations(name) VALUES(${orgName}) RETURNING id, name`;
      newOrgForExternal = created[0];
      const newSites = Array.isArray(b.sites) ? [...new Set(b.sites.map(s => String(s).trim()).filter(Boolean))] : [];
      for (const site of newSites) {
        await sql`INSERT INTO five_s_org_sites(organisation_id, site) VALUES(${newOrgForExternal.id}, ${site}) ON CONFLICT DO NOTHING`;
      }
    }
    const hash = await bcrypt.hash(password, 12);
    const rows = await sql`
      INSERT INTO five_s_users(username, full_name, password_hash, role, is_active, organisation_id)
      VALUES(${username}, ${fullName}, ${hash}, ${role}, TRUE, ${organisationId})
      RETURNING id, username, full_name, role
    `;
    for (const site of sites) {
      await sql`INSERT INTO five_s_user_sites(user_id, site) VALUES(${rows[0].id}, ${site}) ON CONFLICT DO NOTHING`;
    }
    return json(res, 201, { user: rows[0], organisation: newOrgForExternal });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: e.message || 'Sign up failed.' });
  }
}
