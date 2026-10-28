import {request as nodeHttpsRequest} from 'node:https';
import {isIP} from 'node:net';

const ORIGIN='https://api.yookassa.ru',MAX_BODY=1024*1024;
export class ProviderUnavailableError extends Error {
 constructor(){super('Проверка платежа временно недоступна. Повтори позже.');this.name='ProviderUnavailableError';}
}
export function yookassaLocalAddress(value){
 if(value===undefined||value==='')return undefined;
 if(typeof value!=='string'||!isIP(value)||value.includes('%'))throw new Error('Invalid YooKassa local address');
 return value;
}

// The optional binding affects only YooKassa REST sockets. No proxy, retry or route fallback.
export function createYooKassaRequest({localAddress,request=fetch,httpsRequest=nodeHttpsRequest}={}){
 const address=yookassaLocalAddress(localAddress);
 // Explicit injected senders remain the caller's transport, including offline tests.
 if(!address||request!==fetch)return request;
 return async(input,options={})=>{
  let target,method,body,headers,signal;
  try{
   target=new URL(input);method=options.method||'GET';
   if(target.origin!==ORIGIN||target.username||target.password||target.hash||!target.pathname.startsWith('/v3/')||!['GET','POST'].includes(method)||options.redirect&&options.redirect!=='error')throw new Error();
   if(options.body!==undefined&&typeof options.body!=='string'&&!(options.body instanceof Uint8Array))throw new Error();
   body=options.body===undefined?undefined:Buffer.from(options.body);
   if(body&&body.length>MAX_BODY)throw new Error();
   const values=new Headers(options.headers);values.set('Host','api.yookassa.ru');values.set('Accept-Encoding','identity');if(body)values.set('Content-Length',String(body.length));headers=Object.fromEntries(values);
   signal=AbortSignal.any([AbortSignal.timeout(15000),...(options.signal?[options.signal]:[])]);
   if(signal.aborted)throw new Error();
  }catch{throw new ProviderUnavailableError();}
  return new Promise((resolve,reject)=>{
   let req,settled=false;
   const fail=()=>{if(settled)return;settled=true;reject(new ProviderUnavailableError());req?.destroy();};
   try{
    req=httpsRequest(target,{method,headers,localAddress:address,family:isIP(address),agent:false,servername:'api.yookassa.ru',rejectUnauthorized:true,signal,maxHeaderSize:16384},response=>{
     response.on('error',fail);response.on('aborted',fail);
     const status=response.statusCode;
     if(!Number.isInteger(status)||status<200||status>=300&&status<400||status>599){fail();response.destroy();return;}
     const length=Number(response.headers['content-length']);if(Number.isFinite(length)&&length>MAX_BODY){fail();response.destroy();return;}
     let bytes=0;const chunks=[];
     response.on('data',chunk=>{if(settled)return;bytes+=chunk.length;if(bytes>MAX_BODY){fail();response.destroy();return;}chunks.push(Buffer.from(chunk));});
     response.on('end',()=>{
      if(settled)return;if(response.complete===false){fail();return;}
      try{
       const result=new Response([204,205].includes(status)?null:Buffer.concat(chunks),{status,headers:response.headers});
       const json=result.json.bind(result);result.json=async()=>{try{return await json();}catch{throw new ProviderUnavailableError();}};
       settled=true;resolve(result);
      }catch{fail();}
     });
    });
    req.on('error',fail);req.end(body);
   }catch{fail();}
  });
 };
}
