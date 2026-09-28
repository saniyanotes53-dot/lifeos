import React from 'react';
import {Field} from '../primitives';
import {inputStyle} from '../../theme';
export const nutrients=[['cal','Energy','kcal'],['protein','Protein','g'],['carbs','Carbs','g'],['fat','Fat','g'],['fiber','Fibre','g'],['calcium','Calcium','mg'],['iron','Iron','mg'],['potassium','Potassium','mg']];
export const grid={display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,220px),1fr))',gap:14};
export function NumberField({t,label,value,onChange,min=0,max=10000,step='any',required=false}){return <Field t={t} label={label}><input style={inputStyle(t)} type="number" value={value??''} onChange={e=>onChange(e.target.value)} min={min} max={max} step={step} required={required}/></Field>;}
export function validNumber(v){return v!==''&&v!=null&&Number.isFinite(Number(v))&&Number(v)>=0;}
export function NutrientLine({values}){return <p style={{fontSize:13,lineHeight:1.8,margin:'8px 0'}}>{nutrients.map(([k,label,u])=>`${label}: ${validNumber(values?.[k])?Math.round(Number(values[k])*10)/10:'—'} ${u}`).join(' · ')}</p>;}
