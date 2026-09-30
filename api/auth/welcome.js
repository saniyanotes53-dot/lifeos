import productHandler from '../../server/product-admin.js';
import resetData from '../../server/reset-data.js';
import { welcomeEmailHandler } from '../../server/welcome-mail.js';

export default async function handler(req, res) {
  if(req.query?.action==='ai-connections')return res.status(410).json({error:'AI Connections has been removed. Life OS uses Gemini only.'});
  if(['products','admin-login','admin-products','admin-logout'].includes(req.query?.action))return productHandler(req,res);
  if(req.query?.action === 'reset-data')return resetData(req,res);
  return welcomeEmailHandler(req, res);
}
