import {scanStatementPage} from '../assistant/api.js';

// Loaded only after a PDF is selected; ordinary pages never download PDF.js.
export async function readPdfStatement(file,user,onProgress){
  const pdfjs=await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc=(await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  const loading=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false});
  let pdf;
  try {pdf=await loading.promise;}
  catch(error){await loading.destroy();throw new Error(error.name==='PasswordException'?'This PDF is password protected. Unlock it on your device, then upload the unlocked copy.':'This PDF could not be opened. Please download a fresh copy.');}
  const rows=[],warnings=[];
  try{
    if(pdf.numPages>30)throw new Error('Choose a PDF with 30 pages or fewer. Split longer statements into smaller files.');
    for(let number=1;number<=pdf.numPages;number++){
      onProgress(`Scanning page ${number} of ${pdf.numPages}…`);
      const page=await pdf.getPage(number),content=await page.getTextContent();
      let lastY=null;
      const text=content.items.filter(item=>'str' in item).map(item=>{
        const y=Math.round(item.transform[5]);
        const separator=lastY!==null&&Math.abs(y-lastY)>3?'\n':'\t';lastY=y;
        return separator+item.str+(item.hasEOL?'\n':'');
      }).join('');
      let input;
      if(text.trim().length>80){
        if(text.length>40000)throw new Error(`Page ${number} is too dense to scan. Use the CSV export instead.`);
        input={text};
      }else{
        const base=page.getViewport({scale:1}),viewport=page.getViewport({scale:Math.min(2,1800/Math.max(base.width,base.height))});
        const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
        try{await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;input={imageBase64:canvas.toDataURL('image/jpeg',0.8).split(',')[1]};}
        finally{canvas.width=0;canvas.height=0;}
        if(input.imageBase64.length>2200000)throw new Error(`Page ${number} is too large to scan. Use a smaller PDF or CSV.`);
      }
      const result=await scanStatementPage(user,input);
      rows.push(...result.rows.map(row=>({...row,sourcePage:number})));
      warnings.push(...result.warnings.map(w=>`Page ${number}: ${w}`));
      page.cleanup();
      if(rows.length>3000)throw new Error('This PDF contains more than 3,000 transactions. Split it into smaller files.');
    }
  }finally{await pdf.destroy();}
  if(!rows.length)throw new Error('No completed transactions could be read. Try a clearer statement or a CSV export.');
  return {rows,warnings};
}
