import test from 'node:test';
import assert from 'node:assert/strict';
import {scryptSync} from 'node:crypto';
import {checkPassword,createSession,validSession,createProductHandler} from '../server/product-admin.js';
import {validateCatalog,matchingProducts,relatedCategory} from '../src/catalog/rules.js';
import {products} from '../src/catalog/products.js';
const key='test-session-secret';
const headers={origin:'https://lifeos53.vercel.app','x-lifeos-admin':'1','content-type':'application/json'};
function response(){return {code:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};}
test('admin password verifier rejects incorrect input; cookies resist tampering and expiry',async()=>{
 const salt='0123456789abcdef0123456789abcdef';
 const encoded=salt+':'+scryptSync('test-only-password',salt,64).toString('hex');
 assert.equal(await checkPassword('test-only-password',encoded),true);
 assert.equal(await checkPassword('incorrect',encoded),false);
 assert.equal(await checkPassword({}),false);
 const session=createSession(key,1000000);
 assert.equal(validSession(session,key,1001000),true);
 assert.equal(validSession(session+'a',key,1001000),false);
 assert.equal(validSession(session,key+'x',1001000),false);
 assert.equal(validSession(session,key,4600000),false);
});
test('public catalog excludes hidden items; admin saves require signed cookie and same origin',async()=>{
 let writes=0;
 const handler=createProductHandler({secret:()=>key,readCatalog:async()=>({products:[products[0],{...products[1],enabled:false}],revision:'r1'}),saveCatalog:async(items,revision)=>{writes++;assert.equal(revision,'r1');return {products:validateCatalog(items),revision:'r2'};}});
 let res=response();await handler({method:'GET',query:{action:'products'},headers:{}},res);assert.equal(res.body.products.length,1);
 res=response();await handler({method:'PUT',query:{action:'admin-products'},headers,body:{products,revision:'r1'}},res);assert.equal(res.code,401);assert.equal(writes,0);
 const cookie='__Host-lifeos_admin='+createSession(key);
 res=response();await handler({method:'PUT',query:{action:'admin-products'},headers:{...headers,cookie,origin:'https://evil.example'},body:{products,revision:'r1'}},res);assert.equal(res.code,403);assert.equal(writes,0);
 res=response();await handler({method:'PUT',query:{action:'admin-products'},headers:{...headers,cookie},body:{products,revision:'r1'}},res);assert.equal(res.code,200);assert.equal(writes,1);assert.equal(res.body.revision,'r2');
});
test('login is rate-limited before password verification and issues a protected cookie',async()=>{
 let checks=0;
 const handler=createProductHandler({secret:()=>key,consumeAttempt:async()=>{},checkPassword:async p=>{checks++;return p==='test';}});
 let res=response();await handler({method:'POST',query:{action:'admin-login'},headers,body:{password:'wrong'}},res);assert.equal(res.code,401);assert.equal(res.headers['Set-Cookie'],undefined);
 res=response();await handler({method:'POST',query:{action:'admin-login'},headers,body:{password:'test'}},res);assert.equal(res.code,200);assert.match(res.headers['Set-Cookie'],/HttpOnly; Secure; SameSite=Strict/);
 const limited=createProductHandler({secret:()=>key,consumeAttempt:async()=>{throw Object.assign(Error('limited'),{status:429});},checkPassword:async()=>{checks++;return true;}});
 res=response();await limited({method:'POST',query:{action:'admin-login'},headers,body:{password:'test'}},res);assert.equal(res.code,429);assert.equal(checks,2);
});
test('catalog enforces safe links, supported tabs and category matching',()=>{
 assert.equal(validateCatalog(products).length,11);
 assert.throws(()=>validateCatalog([{...products[0],url:'javascript:alert(1)'}]));
 assert.throws(()=>validateCatalog([{...products[0],imageUrl:'data:text/html,test'}]));
 assert.throws(()=>validateCatalog([{...products[0],tabs:['Admin']}]));
 assert.throws(()=>validateCatalog([products[0],products[0]]));
 assert.equal(relatedCategory('General','Study for exams'),'Study');
 assert.equal(matchingProducts(products,'Tasks','Study').length,5);
 assert.equal(matchingProducts(products,'Tasks','Travel').length,0);
 assert.equal(matchingProducts(products,'Health').length,0);
});
