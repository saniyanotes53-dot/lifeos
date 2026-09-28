export function validScreenshot(value){
 if(typeof value!=='string'||value.length>2200000||value.length%4!==0||!/^[A-Za-z0-9+/]+={0,2}$/.test(value))return false;
 const bytes=Buffer.from(value,'base64');
 return bytes.length>=4&&bytes.length<=1650000&&bytes.toString('base64')===value&&bytes[0]===255&&bytes[1]===216&&bytes[bytes.length-2]===255&&bytes[bytes.length-1]===217;
}
