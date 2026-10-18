import {createHmac,timingSafeEqual} from 'node:crypto';
export function validPayment(p){return p&&typeof p.upi==='string'&&/^[A-Za-z0-9._-]{2,128}@[A-Za-z0-9.-]{2,64}$/.test(p.upi)&&typeof p.name==='string'&&p.name.trim().length>0&&p.name.length<=80&&!/[\x00-\x1f]/.test(p.name)&&Number.isFinite(p.amount)&&p.amount>0&&p.amount<=10000000;}
export function paymentToken(payment,secret,now=Date.now()){
 if(!secret||!validPayment(payment))return null;
 const data=Buffer.from(JSON.stringify({upi:payment.upi,name:payment.name,amount:Math.round(payment.amount*100)/100,expires:now+30*86400000})).toString('base64url');
 return `${data}.${createHmac('sha256',secret).update(data).digest('hex')}`;
}
export function readPayment(token,secret,now=Date.now()){
 if(!secret||typeof token!=='string'||token.length>1500)return null;
 const [data,signature,...rest]=token.split('.');if(rest.length||!signature||!/^[a-f0-9]{64}$/.test(signature))return null;
 const expected=createHmac('sha256',secret).update(data).digest();if(!timingSafeEqual(Buffer.from(signature,'hex'),expected))return null;
 try{const p=JSON.parse(Buffer.from(data,'base64url').toString());return validPayment(p)&&Number.isFinite(p.expires)&&p.expires>now?p:null;}catch{return null;}
}
export const upiUri=p=>`upi://pay?${new URLSearchParams({pa:p.upi,pn:p.name,am:p.amount.toFixed(2),cu:'INR',tn:'Life OS repayment'})}`;
