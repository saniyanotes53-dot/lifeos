import QRCode from 'qrcode';
import {readPayment,upiUri} from './upi.js';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Robots-Tag','noindex, nofollow');res.setHeader('Content-Security-Policy',"default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'");
 if(req.method!=='GET')return res.status(405).send('Method not allowed');
 const p=readPayment(req.query?.pay,process.env.CRON_SECRET);
 if(!p)return res.status(400).send('This payment link is invalid or expired. Ask the lender for a new reminder.');
 try{const uri=upiUri(p),qr=await QRCode.toDataURL(uri,{width:280,margin:2,errorCorrectionLevel:'M'});
 res.setHeader('Content-Type','text/html; charset=utf-8');return res.send(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Repay · Life OS</title><style>body{margin:0;background:#101521;color:#f8f5f0;font:17px system-ui;display:grid;place-items:center;min-height:100dvh}main{max-width:440px;padding:32px;text-align:center}img{max-width:100%;border-radius:20px}a{display:block;margin:20px 0;padding:16px;border-radius:16px;background:#3478f6;color:white;text-decoration:none}p{line-height:1.6;overflow-wrap:anywhere}small{color:#c3cad6}</style><main><small>LIFE OS · REPAYMENT</small><h1>₹${p.amount.toFixed(2)}</h1><p>Pay <strong>${esc(p.name)}</strong><br>${esc(p.upi)}</p><img src="${qr}" alt="UPI payment QR for ${esc(p.name)}"><a href="${esc(uri)}">Pay Now · Open UPI app</a><p>On a computer, scan this QR with Google Pay or another UPI app. On mobile, use Pay Now.</p><small>Confirm the recipient in your payment app before paying. This link reflects the reminder when sent; check the balance with your lender if you have already paid. Life OS does not process the payment or mark it settled automatically.</small></main></html>`);
 }catch{return res.status(500).send('Could not display the QR. Please try again.');}
}
