import { db, json } from './_db.js';
import { requireUser } from './_auth.js';
export default async function handler(req,res){
  try{
    const user=await requireUser(req,res); if(!user)return;
    if(req.method!=='GET') return json(res,405,{error:'Method not allowed.'});
    const sql=db();
    const rows=await sql`SELECT full_name, role FROM five_s_users WHERE is_active=TRUE AND role IN ('internal','external') ORDER BY full_name`;
    return json(res,200,{auditors:rows});
  }catch(e){console.error(e);return json(res,500,{error:e.message||'Could not load auditors.'});}
}
