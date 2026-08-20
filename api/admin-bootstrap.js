import bcrypt from 'bcryptjs';
import { db, json, readBody } from './_db.js';

export default async function handler(req,res){
  if(req.method!=='POST')return json(res,405,{error:'Method not allowed.'});
  try{
    const bootstrap=process.env.ADMIN_BOOTSTRAP_SECRET;
    if(!bootstrap)return json(res,500,{error:'ADMIN_BOOTSTRAP_SECRET is not configured.'});
    const provided=req.headers['x-bootstrap-secret'];
    if(!provided || provided!==bootstrap)return json(res,403,{error:'Invalid bootstrap secret.'});
    const sql=db();
    const count=await sql`SELECT COUNT(*)::int AS n FROM five_s_users`;
    if(Number(count[0].n)>0)return json(res,409,{error:'An account already exists. Use the Admin panel instead.'});
    const b=await readBody(req);
    if(!b.username||!b.full_name||!b.password)return json(res,400,{error:'username, full_name and password are required.'});
    const hash=await bcrypt.hash(b.password,12);
    const rows=await sql`INSERT INTO five_s_users(username,full_name,password_hash,role,is_active) VALUES(${String(b.username).trim().toLowerCase()},${b.full_name},${hash},'admin',TRUE) RETURNING id,username,full_name,role`;
    return json(res,201,{user:rows[0]});
  }catch(e){console.error(e);return json(res,500,{error:e.message||'Bootstrap failed.'});}
}
