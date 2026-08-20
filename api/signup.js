import bcrypt from 'bcryptjs';
import { db, json, readBody } from './_db.js';

const PREDEFINED = {
  Ruwan: 'internal', Shanuka: 'internal', Arunoda: 'internal', Chanaka: 'internal',
  Roshan: 'external', Mahela: 'external', Damitha: 'external'
};
const SITES = ['BBO','BKN','BTO','EME','GNT','HRN','LKM','MGT','MVB','ORIC','RDP','UDW','VBL','WMB'];

export default async function handler(req,res){
  if(req.method!=='POST') return json(res,405,{error:'Method not allowed.'});
  try{
    const b=await readBody(req);
    const fullName=String(b.full_name||'').trim();
    const username=String(b.username||'').trim().toLowerCase();
    const password=String(b.password||'');
    if(!fullName||!username||!password) return json(res,400,{error:'Full name, username and password are required.'});
    if(password.length<8) return json(res,400,{error:'Password must contain at least 8 characters.'});
    const role=PREDEFINED[fullName] || (['internal','external'].includes(b.role)?b.role:null);
    if(!role) return json(res,400,{error:'Please select Internal Auditor or External Auditor.'});
    const sites=role==='internal' ? (Array.isArray(b.sites)?b.sites.filter(s=>SITES.includes(s)):[]) : SITES;
    if(role==='internal' && !sites.length) return json(res,400,{error:'Internal auditors must select at least one assigned site.'});
    const sql=db();
    const exists=await sql`SELECT id FROM five_s_users WHERE lower(username)=lower(${username}) LIMIT 1`;
    if(exists.length) return json(res,409,{error:'That username is already registered.'});
    const hash=await bcrypt.hash(password,12);
    const rows=await sql`INSERT INTO five_s_users(username,full_name,password_hash,role,is_active) VALUES(${username},${fullName},${hash},${role},TRUE) RETURNING id,username,full_name,role`;
    for(const site of sites) await sql`INSERT INTO five_s_user_sites(user_id,site) VALUES(${rows[0].id},${site}) ON CONFLICT DO NOTHING`;
    return json(res,201,{user:rows[0]});
  }catch(e){console.error(e);return json(res,500,{error:e.message||'Sign up failed.'});}
}
