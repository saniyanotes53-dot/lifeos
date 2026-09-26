import {adminToken} from './reminder-mail.js';
import {projectId} from './firebase.js';
import {products} from '../src/catalog/products.js';
import {validateCatalog} from '../src/catalog/rules.js';
const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
export async function readDocument(path, token) {
 const r = await fetch(`${base}/${path}`, {headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(8000)});
 if (r.status === 404) return null;
 if (!r.ok) throw Object.assign(Error('Product settings are temporarily unavailable.'),{status:503});
 return r.json();
}
export async function writeDocument(path, fields, revision, token) {
 const r = await fetch(`${base}:commit`, {method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(8000),body:JSON.stringify({writes:[{update:{name:`projects/${projectId}/databases/(default)/documents/${path}`,fields},currentDocument:revision?{updateTime:revision}:{exists:false}}]})});
 if (r.status === 409 || r.status === 400 || r.status === 404) throw Object.assign(Error('Settings changed in another session. Reload before saving.'),{status:409});
 if (!r.ok) throw Object.assign(Error('Could not save product settings. Try again.'),{status:503});
 return (await r.json()).writeResults[0].updateTime;
}
export async function readCatalog() {
 const token = await adminToken();
 const doc = await readDocument('appConfig/productCatalog',token);
 return {products:doc?validateCatalog(JSON.parse(doc.fields.json.stringValue)):products,revision:doc?.updateTime || ''};
}
export async function saveCatalog(items, revision) {
 const cleaned = validateCatalog(items);
 const token = await adminToken();
 const nextRevision = await writeDocument('appConfig/productCatalog',{json:{stringValue:JSON.stringify(cleaned)}},revision,token);
 return {products:cleaned,revision:nextRevision};
}
