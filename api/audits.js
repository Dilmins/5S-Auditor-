import { db, json, readBody } from './_db.js';
import { requireUser, canAccessSite } from './_auth.js';

export default async function handler(req, res) {
  try {
    const user = await requireUser(req,res); if (!user) return;
    const sql = db();

    if (req.method === 'GET') {
      const site = req.query?.site || '';
      if (site && !canAccessSite(user, site)) return json(res,403,{error:'You are not authorised to view this site.'});
      const rows = site
        ? await sql`SELECT id, organisation, site, department, audit_month, auditor, auditor_type, overall_total, saved_at, updated_at FROM five_s_audits WHERE site=${site} ORDER BY audit_month DESC, updated_at DESC`
        : user.role === 'external' || user.role === 'admin'
          ? await sql`SELECT id, organisation, site, department, audit_month, auditor, auditor_type, overall_total, saved_at, updated_at FROM five_s_audits ORDER BY audit_month DESC, updated_at DESC`
          : await sql`SELECT id, organisation, site, department, audit_month, auditor, auditor_type, overall_total, saved_at, updated_at FROM five_s_audits WHERE site = ANY(${user.sites}) ORDER BY audit_month DESC, updated_at DESC`;
      return json(res,200,{audits:rows});
    }

    if (req.method === 'POST') {
      const body = await readBody(req);
      const { site, audit_month, audit } = body;
      if (!site || !audit_month || !audit) return json(res,400,{error:'site, audit_month and audit are required.'});
      if (!canAccessSite(user, site)) return json(res,403,{error:'You are not authorised to save an audit for this site.'});
      const auditorType = user.role === 'external' ? 'External Auditor' : 'Internal Auditor';
      const auditor = user.full_name;
      const overallTotal = Number(body.overall_total || 0);
      const rows = await sql`
        INSERT INTO five_s_audits
          (organisation, site, department, audit_month, auditor, auditor_type, scores, section_notes, q14, special_note, signature, overall_total, saved_at, updated_at, created_by)
        VALUES
          ('Vidullanka PLC', ${site}, ${audit.meta?.dept || null}, ${audit_month}, ${auditor}, ${auditorType},
           ${JSON.stringify(audit.scores || {})}::jsonb, ${JSON.stringify(audit.sectionNotes || {})}::jsonb,
           ${JSON.stringify(audit.q14 || {text:{},score:{}})}::jsonb, ${audit.specialNote || ''},
           ${JSON.stringify(audit.signature || {dataUrl:'',signedAt:null})}::jsonb, ${overallTotal}, NOW(), NOW(), ${user.id})
        ON CONFLICT (site, audit_month)
        DO UPDATE SET
          department=EXCLUDED.department, auditor=EXCLUDED.auditor, auditor_type=EXCLUDED.auditor_type,
          scores=EXCLUDED.scores, section_notes=EXCLUDED.section_notes, q14=EXCLUDED.q14,
          special_note=EXCLUDED.special_note, signature=EXCLUDED.signature, overall_total=EXCLUDED.overall_total,
          updated_at=NOW(), created_by=EXCLUDED.created_by
        WHERE five_s_audits.site = EXCLUDED.site
          AND five_s_audits.audit_month = EXCLUDED.audit_month
        RETURNING id, site, audit_month, overall_total, saved_at, updated_at
      `;
      return json(res,200,{audit:rows[0]});
    }

    if (req.method === 'DELETE') {
      const site = req.query?.site || '';
      const month = req.query?.month || '';
      if (!site || !month) return json(res,400,{error:'site and month are required.'});
      if (!canAccessSite(user,site)) return json(res,403,{error:'You are not authorised to delete this site audit.'});
      await sql`DELETE FROM five_s_audits WHERE site=${site} AND audit_month=${month}`;
      return json(res,200,{ok:true});
    }
    return json(res,405,{error:'Method not allowed.'});
  } catch(e) { console.error(e); return json(res,500,{error:e.message||'Audit request failed.'}); }
}
