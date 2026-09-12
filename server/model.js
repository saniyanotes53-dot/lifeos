export function geminiModel(value=process.env.GEMINI_MODEL){
  return (value||'gemini-3.1-flash-lite').trim().replace(/\.+$/, '');
}
