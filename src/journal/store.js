import {collection,doc,onSnapshot,query,where,setDoc,deleteDoc,runTransaction,serverTimestamp} from 'firebase/firestore';
import {db} from '../firebase';
import {namazTaskId,validateHifz} from './model';
import {parseLocalDate} from '../utils/dates';
export function watchJournal(uid,name,callback,onError,range){
 const ref=collection(db,'users',uid,name);
 return onSnapshot(range?query(ref,where('date','>=',range.start),where('date','<=',range.end)):ref,s=>callback(s.docs.map(d=>({...d.data(),id:d.id}))),()=>onError('Could not load your journal. Please check your connection and try again.'));
}
export const watchPhotos=(uid,date,callback,onError)=>onSnapshot(doc(db,'users',uid,'journalPhotos',date),s=>callback(s.data()||{}),()=>onError('Could not load photos.'));
export async function saveJournal(uid,date,data){
 if(!parseLocalDate(date))throw Error('Choose a valid date.');
 await setDoc(doc(db,'users',uid,'journalEntries',date),{date,title:data.title.slice(0,160),body:data.body.slice(0,20000),dayType:data.dayType.slice(0,80),updatedAt:serverTimestamp()});
}
export async function saveOption(uid,id,data){await setDoc(doc(db,'users',uid,'journalOptions',id),{kind:data.kind,label:data.label.trim().slice(0,80),text:data.text.slice(0,10000),behavior:data.behavior,hidden:!!data.hidden});}
export async function saveTracker(uid,data){
 if(!parseLocalDate(data.date))throw Error('Choose a valid date.');
 if(data.type==='hifz')validateHifz(data);
 const ref=data.type==='namaz'?doc(db,'users',uid,'dailyTrackers',namazTaskId(data.date,data.category)):data.type==='attendance'?doc(db,'users',uid,'dailyTrackers',`attendance_${data.date}_${encodeURIComponent(data.category)}`):doc(collection(db,'users',uid,'dailyTrackers'));
 if(data.type!=='namaz'){await setDoc(ref,{...data,updatedAt:serverTimestamp()});return;}
 const taskRef=doc(db,'users',uid,'tasks',ref.id),ownerRef=doc(db,'users',uid);
 await runTransaction(db,async tx=>{
  const old=await tx.get(ref),task=await tx.get(taskRef),owner=await tx.get(ownerRef);
  tx.set(ref,{...data,updatedAt:serverTimestamp()});
  if(data.behavior==='missed')tx.set(taskRef,{title:`Make up ${data.category} — ${data.date}`,date:data.date,priority:'High',category:'Namaz',done:false,source:'namaz',sourceId:ref.id},{merge:true});
  else if(task.exists()&&['complete','made-up'].includes(data.behavior))tx.update(taskRef,{done:true});
  tx.set(ownerRef,{assistantRevision:(owner.data()?.assistantRevision||0)+1},{merge:true});
 });
}
export const removeTracker=(uid,id)=>deleteDoc(doc(db,'users',uid,'dailyTrackers',id));
export async function compressPhoto(file){
 if(!/^image\/(jpeg|png|webp)$/.test(file.type)||file.size>10000000)throw Error('Choose a JPG, PNG or WebP under 10 MB.');
 const bitmap=await createImageBitmap(file);
 try{
 const canvas=document.createElement('canvas'),scale=Math.min(1,900/Math.max(bitmap.width,bitmap.height));canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
 let result;for(let quality=.8;quality>=.2;quality-=.15){result=canvas.toDataURL('image/jpeg',quality);if(result.length<=120000)return result;}
 throw Error('This photo is too detailed. Please crop it and try again.');
 }finally{bitmap.close();}
}
export const savePhotos=(uid,date,photos)=>setDoc(doc(db,'users',uid,'journalPhotos',date),{date,photo0:photos[0]||'',photo1:photos[1]||'',photo2:photos[2]||''});
