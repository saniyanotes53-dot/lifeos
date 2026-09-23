import React,{useId} from 'react';
export default function BrandLogo({scheme='blue',large=false}) {
 const colour=['blue','brown','peach'].includes(scheme)?scheme:'blue';
 const id='logo-'+useId().replace(/:/g,'');
 return <span className={`brand-glass${large?' brand-glass-large':''}`}>
  <svg width="0" height="0" aria-hidden="true" style={{position:'absolute'}}><defs><filter id={id} colorInterpolationFilters="sRGB"><feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  1 1 1 0 0"/></filter></defs></svg>
  <img src={`/brand/lifeos-${colour}.jpg`} alt="LIFE OS" width="1536" height="1152" decoding="async" style={{filter:`url(#${id}) drop-shadow(0 2px 2px #0009)`}}/>
 </span>;
}
