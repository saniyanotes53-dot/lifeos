// Downscale locally, remove image metadata, and send only a bounded JPEG.
export async function screenshotPayload(file) {
 if(!file || !['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('Choose a PNG, JPEG or WebP screenshot.');
 if(file.size>10*1024*1024)throw Error('Choose a screenshot smaller than 10 MB.');
 const url=URL.createObjectURL(file);
 try {
  const img=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('This screenshot could not be opened.'));image.src=url;});
  if(!img.width||!img.height||img.width*img.height>60000000)throw Error('Crop this screenshot to the transaction area first.');
  const scale=Math.min(1,2000/Math.max(img.width,img.height));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));
  const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
  const imageBase64=canvas.toDataURL('image/jpeg',.86).split(',')[1];
  if(imageBase64.length>2200000)throw Error('Crop this screenshot or use a smaller image.');
  return {imageBase64};
 } finally {URL.revokeObjectURL(url);}
}
