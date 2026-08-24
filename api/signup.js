import { json } from '../lib/_db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });
  return json(res, 403, { error: 'Sign-up is disabled. Contact an administrator to create your account.' });
}
