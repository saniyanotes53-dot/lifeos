import { confirmPasswordResetHandler } from '../../../server/password-reset.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  if (typeof req.body === 'string') {
    try {
      req.body = JSON.parse(req.body || '{}');
    } catch {
      req.body = {};
    }
  }
  return confirmPasswordResetHandler(req, res);
}
