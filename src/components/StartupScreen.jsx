import React from 'react';
import BrandLogo from './BrandLogo';
export default function StartupScreen({t,scheme,theme,waiting=false}) {
 return <main className="startup-screen" data-mode={theme} style={{'--startup-bg':t.bg,'--startup-accent':t.a1,'--startup-light':t.a2,color:t.text}} aria-label="Starting LIFE OS">
  <div className="startup-content">
   <BrandLogo scheme={scheme} white={theme==='dark'&&scheme==='blue'} large/>
   <div className="startup-track" role="progressbar" aria-label="Opening LIFE OS"><span/></div>
   <p role="status">{waiting?'Connecting to your account…':'A little clarity. A fresh start.'}</p>
  </div>
 </main>;
}
