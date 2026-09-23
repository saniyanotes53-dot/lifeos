import React from 'react';
import {motion,useDragControls,useReducedMotion} from 'motion/react';

// Layered material adapted to Life OS: only the backdrop is blurred;
// content and controls stay sharp and independently interactive.
export function LiquidGlassCard({children,className='',draggable=false,borderRadius='28px',blurIntensity='sm',glowIntensity='sm',shadowIntensity='sm',style,...props}) {
 const controls=useDragControls(),reduce=useReducedMotion();
 const blur={sm:8,md:12,lg:18,xl:24}[blurIntensity]??8;
 const edge={none:0,xs:1,sm:2,md:3,lg:4,xl:6,'2xl':8}[shadowIntensity]??2;
 const glow={none:0,xs:12,sm:20,md:28,lg:36,xl:44,'2xl':52}[glowIntensity]??20;
 return <motion.aside {...props} className={`liquid-glass-material ${className}`} drag={draggable&&!reduce} dragControls={controls} dragListener={false} dragConstraints={{left:0,right:0,top:0,bottom:0}} dragElastic={.12} dragTransition={{bounceStiffness:420,bounceDamping:30}} whileDrag={{scale:1.008}} style={{borderRadius,'--material-blur':`${blur}px`,'--material-edge':`${edge}px`,'--material-glow':`${glow}px`,...style}}>
  <span className="material-bend" aria-hidden="true"/><span className="material-face" aria-hidden="true"/><span className="material-edge" aria-hidden="true"/>
  {draggable&&<div className="glass-drag-handle" aria-hidden="true" title="Drag the sidebar" onPointerDown={e=>{if(!reduce&&e.pointerType==='mouse')controls.start(e);}}><span/></div>}
  {children}
 </motion.aside>;
}
