import { db, json } from './_db.js';
export default async function handler(req,res){ try { await db()`SELECT 1`; return json(res,200,{ok:true,database:'Neon PostgreSQL'}); } catch(e){ return json(res,500,{ok:false,error:e.message}); } }
