// Gemini SSE chunks carry fragments of one structured JSON response.
export async function readGeminiStream(body,onReply){
 const reader=body.getReader(),decoder=new TextDecoder();let buffer='',output='',last='';
 function line(value){
  if(!value.startsWith('data:'))return;const data=value.slice(5).trim();if(!data||data==='[DONE]')return;
  const chunk=JSON.parse(data);if(chunk.error)throw new Error('Gemini interrupted the reply. Please try again.');
  for(const p of chunk.candidates?.[0]?.content?.parts||[])if(!p.thought)output+=p.text||'';
  const match=/"reply"\s*:\s*"((?:\\.|[^"\\])*)/.exec(output);
  if(match){try{const text=JSON.parse('"'+match[1]+'"');if(text!==last){last=text;onReply(text.slice(0,12000));}}catch{}}
 }
 while(true){const {value,done}=await reader.read();buffer+=decoder.decode(value,{stream:!done});const lines=buffer.split('\n');buffer=lines.pop();for(const item of lines)line(item.trim());if(done){if(buffer.trim())line(buffer.trim());break;}}
 return output;
}
