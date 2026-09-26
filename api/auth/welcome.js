import resetData from '../../server/reset-data.js';
import { welcomeEmailHandler } from '../../server/welcome-mail.js';

export default async function handler(req, res) {
  if(req.query?.action === 'reset-data')return resetData(req,res);
  return welcomeEmailHandler(req, res);
}
