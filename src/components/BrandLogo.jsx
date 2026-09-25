import React,{useId} from 'react';
export default function BrandLogo({scheme='blue',large=false,white=false}) {
 const colour=(white||scheme==='blackhat')?'white':(['blue','brown','peach'].includes(scheme)?scheme:'blue');
 const id='logo-'+useId().replace(/:/g,'');
 return <span className={`brand-glass new-wordmark${large?' brand-glass-large':''}`} data-logo={colour}>
  <svg width="0" height="0" aria-hidden="true" style={{position:'absolute'}}><defs><filter id={id} colorInterpolationFilters="sRGB"><feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  4 4 4 0 0"/></filter></defs></svg>
  <img src={`/brand/lifeos-wordmark-${colour}.jpg`} alt="LIFE OS — Built to Keep You Ahead." width="1536" height="512" decoding="async" fetchpriority={large?'high':'auto'} style={{filter:`url(#${id}) brightness(var(--logo-light,1)) drop-shadow(0 -1px 1px #ffffff75) drop-shadow(0 3px 3px #0006)`}}/>
 </span>;
}
