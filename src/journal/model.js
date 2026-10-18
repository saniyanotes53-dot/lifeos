import {parseLocalDate} from '../utils/dates.js';
export const NAMAZ = ['Fajr','Zohar–Asar','Maghrib–Ishaa'];
export const DEFAULT_OPTIONS = [
 ...['Weekday','Weekend','Jamea Day','Holiday','Miqaat'].map((label,i)=>({id:`day-${i}`,kind:'day',label})),
 ...['Assembly','Dua'].map((label,i)=>({id:`category-${i}`,kind:'attendance-category',label})),
 ...['Attended','Late','Not Attended'].map((label,i)=>({id:`attendance-${i}`,kind:'attendance-status',label})),
 ...['Scanned / Attended','Prayed in Room','Not Prayed','Made up'].map((label,i)=>({id:`namaz-${i}`,kind:'namaz-status',label,behavior:i===2?'missed':i===3?'made-up':'complete'})),
 ...['Practising','Completed','Needs revision'].map((label,i)=>({id:`hifz-${i}`,kind:'hifz-status',label})),
 {id:'reflection',kind:'template',label:'Daily reflection',text:'Today I am grateful for…\n\nWhat I learned…\n\nWhat I want to improve tomorrow…'},
 ...['attendance','namaz','hifz'].map(label=>({id:`plugin-${label}`,kind:'plugin',label,text:'enabled'}))
].map(x=>({text:'',behavior:'none',hidden:false,...x}));
export function mergedOptions(saved){return [...new Map([...DEFAULT_OPTIONS,...saved].map(x=>[x.id,x])).values()];}
export function namazTaskId(date,slot){if(!parseLocalDate(date)||!NAMAZ.includes(slot))throw Error('Invalid prayer date or timing.');return `namaz_${date}_${NAMAZ.indexOf(slot)}`;}
export function validateHifz({surah,fromAyah,toAyah,juz}){
 const counts=[7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6];
 if(![surah,fromAyah,toAyah,juz].every(Number.isInteger)||surah<1||surah>114||juz<1||juz>30||fromAyah<1||toAyah<fromAyah||toAyah>counts[surah-1])throw Error('Enter a valid surah (1–114), ayah range and juz (1–30).');
 return true;
}
