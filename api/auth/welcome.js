import { welcomeEmailHandler } from '../../server/welcome-mail.js';

export default async function handler(req, res) {
  return welcomeEmailHandler(req, res);
}
