import React from 'react';
import {motion,useReducedMotion} from 'motion/react';
const spring={type:'spring',stiffness:390,damping:34,mass:.75};
export function GlassSelection({group}) {
 const reduce=useReducedMotion();
 return <motion.span aria-hidden="true" className="glass-selection" layoutId={reduce?undefined:`glass-selection-${group}`} transition={reduce?{duration:0}:spring}/>;
}
export function GlassPage({children}) {
 const reduce=useReducedMotion();
 return <motion.div className="glass-page" initial={reduce?false:{opacity:0,y:14}} animate={{opacity:1,y:0}} transition={reduce?{duration:0}:{duration:.32,ease:[.22,1,.36,1]}}>{children}</motion.div>;
}
