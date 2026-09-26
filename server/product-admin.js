import {createHmac,randomBytes,scrypt as scryptCallback,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {passwordVerifier} from './admin-verifier.js';
import {readCatalog,saveCatalog,readDocument,writeDocument} from './product-store.js';
import {adminToken} from './reminder-mail.js';
import {fail} from './firebase.js';
const scrypt = promisify(scryptCallback);
const COOKIE = '__Host-lifeos_admin';
const ttl = 3600;
function secret() {
 if (!process.env.CRON_SECRET) throw Object.assign(Error('Admin authentication is not configured.'),{status:503});
 return createHmac('sha256',process.env.CRON_SECRET).update('lifeos-product-admin-v1:'+verifier()).digest();
}
const verifier = () => process.env.LIFEOS_ADMIN_PASSWORD_HASH || passwordVerifier;
const equal = (a,b) => a.length === b.length && timingSafeEqual(a,b);
export async function checkPassword(password, encoded = verifier()) {
 if (typeof password !== 'string' || password.length > 256) return false;
 const [salt,hash] = encoded.split(':');
 if (!/^[a-f0-9]{32}$/.test(salt || '') || !/^[a-f0-9]{128}$/.test(hash || '')) throw Error('Invalid admin verifier configuration.');
 return equal(await scrypt(password,salt,64),Buffer.from(hash,'hex'));
}
export function createSession(key, now = Date.now()) {
 const body = Buffer.from(JSON.stringify({exp:Math.floor(now/1000)+ttl,nonce:randomBytes(16).toString('hex')})).toString('base64url');
 return `${body}.${createHmac('sha256',key).update(body).digest('base64url')}`;
}
export function validSession(value, key, now = Date.now()) {
 try {
  if (typeof value !== 'string' || value.length > 512) return false;
  const [body,sig,...extra] = value.split('.');
  if (extra.length || !sig) return false;
  const expected = createHmac('sha256',key).update(body).digest();
  if (!equal(Buffer.from(sig,'base64url'),expected)) return false;
  const {exp} = JSON.parse(Buffer.from(body,'base64url').toString());
  return Number.isInteger(exp) && exp > Math.floor(now/1000) && exp <= Math.floor(now/1000)+ttl;
 } catch { return false; }
}
export function assertSameOrigin(req) {
 const allowed = ['https://lifeos53.vercel.app',process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`].filter(Boolean);
 if (!allowed.includes(req.headers.origin) || req.headers['x-lifeos-admin'] !== '1' || !String(req.headers['content-type']).startsWith('application/json')) throw Object.assign(Error('Open the admin page on LIFE OS to continue.'),{status:403});
}
async function consumeAttempt(req, key) {
 // Vercel overwrites x-vercel-forwarded-for; never trust a client-supplied identity.
 const ip = String(req.headers['x-vercel-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
 const path = `adminSecurity/${createHmac('sha256',key).update(ip).digest('hex')}`;
 const token = await adminToken();
 const doc = await readDocument(path,token);
 const now = Date.now();
 const windowStart = Number(doc?.fields.start.integerValue || 0);
 const active = now - windowStart < 900000;
 const count = active ? Number(doc?.fields.count.integerValue || 0) : 0;
 if (count >= 5) throw Object.assign(Error('Too many sign-in attempts. Try again in 15 minutes.'),{status:429});
 // Compare-and-set prevents parallel attempts bypassing the limit.
 await writeDocument(path,{start:{integerValue:String(active?windowStart:now)},count:{integerValue:String(count+1)}},doc?.updateTime || '',token);
}
export function createProductHandler(deps = {}) {
 const d = {readCatalog,saveCatalog,consumeAttempt,checkPassword,secret,...deps};
 return async function productHandler(req,res) {
  res.setHeader('Cache-Control','no-store');
  try {
   const action = req.query?.action;
   if (req.method === 'GET' && action === 'products') {
    const catalog = await d.readCatalog();
    return res.json({products:catalog.products.filter(p=>p.enabled)});
   }
   const key = d.secret();
   const cookie = String(req.headers.cookie || '').split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
   if (action === 'admin-login' && req.method === 'POST') {
    assertSameOrigin(req);
    await d.consumeAttempt(req,key);
    if (!await d.checkPassword(req.body?.password)) throw Object.assign(Error('Incorrect admin password.'),{status:401});
    res.setHeader('Set-Cookie',`${COOKIE}=${createSession(key)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${ttl}`);
    return res.json({ok:true});
   }
   if (!validSession(cookie,key)) throw Object.assign(Error('Sign in to the admin page.'),{status:401});
   if (action === 'admin-products' && req.method === 'GET') return res.json(await d.readCatalog());
   if (action === 'admin-products' && req.method === 'PUT') {
    assertSameOrigin(req);
    if (typeof req.body?.revision !== 'string' || req.body.revision.length > 100) throw Object.assign(Error('Reload the catalog before saving.'),{status:400});
    let result;
    try {result=await d.saveCatalog(req.body.products,req.body.revision);} catch(e) {if(!e.status && /product|categor|HTTPS|tab|visible|ID/i.test(e.message)) e.status=400;throw e;}
    return res.json(result);
   }
   if (action === 'admin-logout' && req.method === 'POST') {
    assertSameOrigin(req);
    res.setHeader('Set-Cookie',`${COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`);
    return res.json({ok:true});
   }
   return res.status(405).json({error:'Method not supported.'});
  } catch(e) {return fail(res,e);}
 };
}
export default createProductHandler();
