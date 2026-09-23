import React from 'react';
export default function BrandLogo({scheme='blue',large=false}) {
 const colour=['blue','brown','peach'].includes(scheme)?scheme:'blue';
 return <span className={`brand-glass${large?' brand-glass-large':''}`}><img src={`/brand/lifeos-${colour}.jpg`} alt="LIFE OS" width="1536" height="1152" decoding="async"/></span>;
}
