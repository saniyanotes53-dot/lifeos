import React from 'react';
import AuthScreen from './AuthScreen';
import BrandLogo from './BrandLogo';
export default function AuthExperience({t,scheme,setScheme}) {
 return <main className="auth-experience" data-scheme={scheme} style={{'--auth-accent':t.a1,'--auth-light':t.a2,'--auth-deep':t.a3,'--focus-color':t.a2}}>
  <div className="cinema-wallpaper" aria-hidden="true"><div className="cinema-orbit orbit-one"/><div className="cinema-orbit orbit-two"/><div className="cinema-orbit orbit-three"/></div>
  <header className="auth-masthead"><BrandLogo scheme={scheme}/><div className="auth-palette" role="group" aria-label="Colour theme">{['blue','brown','peach'].map(c=><button key={c} aria-label={`${c} theme`} aria-pressed={scheme===c} onClick={()=>setScheme(c)} style={{'--swatch':{blue:'#7eb9ff',brown:'#bb854b',peach:'#ffb092'}[c]}}><span/>{c}</button>)}</div></header>
  <div className="auth-stage"><section className="auth-story"><span className="cinema-kicker">YOUR PERSONAL OPERATING SYSTEM</span><h1>A little order.<br/><em>A lot more life.</em></h1><p>A calm place for your plans, your money,<br className="desktop-break"/> and the person you’re becoming.</p><div className="auth-story-chips"><span>Plan with purpose</span><span>Make space for you</span></div><div className="auth-orb-caption"><span/>Clarity, beautifully connected.</div></section>
  <section className="auth-glass-panel" aria-label="Your Life OS account"><AuthScreen t={t} onLogin={()=>{}}/></section></div>
  <footer className="auth-footer">LIFE OS <span>Designed by Buraq Studios</span></footer>
 </main>;
}
