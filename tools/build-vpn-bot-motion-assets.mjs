// Native Family Spy geometry and local Golos Text. No network or Telegram calls.
// Optional tools: BOT_MEDIA_MODULES=/path/to/node_modules, BOT_MEDIA_FFMPEG=/path/to/ffmpeg.
// BOT_MEDIA_TIMEOUT_MS bounds the encoder (default 60 seconds, maximum 120 seconds).
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {dirname,resolve,join} from 'node:path';
import {writeFileSync,renameSync,mkdtempSync,cpSync,existsSync,mkdirSync,rmSync} from 'node:fs';
import {spawn,spawnSync} from 'node:child_process';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';

const ffmpeg=process.env.BOT_MEDIA_FFMPEG||'ffmpeg';
const timeoutMs=Number(process.env.BOT_MEDIA_TIMEOUT_MS||60_000);
if(!Number.isInteger(timeoutMs)||timeoutMs<100||timeoutMs>120_000)throw Error('BOT_MEDIA_TIMEOUT_MS must be an integer from 100 to 120000');
// Fail before loading fonts, making staging files, or touching the published bundle.
const probe=spawnSync(ffmpeg,['-version'],{stdio:'ignore',timeout:5_000,killSignal:'SIGKILL'});
if(probe.error||probe.status!==0)throw Error(`FFmpeg unavailable: ${probe.error?.message||`version check exited ${probe.status??probe.signal}`}`);
const require=createRequire(import.meta.url);
const {createCanvas,GlobalFonts}=require(process.env.BOT_MEDIA_MODULES?join(process.env.BOT_MEDIA_MODULES,'@napi-rs/canvas'):'@napi-rs/canvas');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),assetDir=join(root,'services/vpn/assets');
for(const file of ['2ddbbcb0584d.woff2','14b6aebb899c.woff2']){
 if(!GlobalFonts.registerFromPath(join(root,'site/vpn/fonts',file),'Golos Text'))throw Error('Local Golos font unavailable');
}
const W=1280,H=640,FPS=24,SECONDS=4;
const color={background:'#081410',green:'#63e6a2',white:'#effbf3',highlight:'#d6ffe6'};
const c=createCanvas(W,H),x=c.getContext('2d');
const circle={cx:250,cy:320,r:142};
const lines=[[250,178,250,462],[127.02,249,372.98,391],[127.02,391,372.98,249]];
const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
function mark(ctx,{cx=circle.cx,cy=circle.cy,r=circle.r,width=11}={}){
 ctx.strokeStyle=color.green;ctx.lineWidth=width;ctx.lineCap='round';
 ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.stroke();
 const s=r/circle.r;
 for(const [ax,ay,bx,by] of lines){ctx.beginPath();ctx.moveTo(cx+(ax-circle.cx)*s,cy+(ay-circle.cy)*s);ctx.lineTo(cx+(bx-circle.cx)*s,cy+(by-circle.cy)*s);ctx.stroke();}
}
function draw(phase){
 x.fillStyle=color.background;x.fillRect(0,0,W,H);mark(x);
 // One light trace completes the already-visible brand circle. The mark and text never spin or disappear.
 const raw=(phase-.12)/.66;
 if(raw>0&&raw<1){
  const t=ease(raw),head=-Math.PI/2+t*Math.PI*2,trail=Math.PI*.43;
  const envelope=Math.pow(Math.sin(Math.PI*raw),.8);
  x.lineCap='round';x.lineWidth=13;x.strokeStyle=color.highlight;
  for(let n=0;n<28;n++){
   const start=head-trail+trail*n/28,end=head-trail+trail*(n+1)/28;
   x.globalAlpha=envelope*Math.pow((n+1)/28,1.8)*.95;
   x.beginPath();x.arc(circle.cx,circle.cy,circle.r,start,end);x.stroke();
  }
  x.globalAlpha=1;
 }
 x.fillStyle=color.white;x.font='600 82px "Golos Text"';x.fillText('Family VPN',465,325);
 x.fillStyle=color.green;x.font='400 32px "Golos Text"';x.fillText('от Family Spy',470,385);
}
async function encode(output){
 const controller=new AbortController();let timedOut=false,errors='';
 const encoder=spawn(ffmpeg,['-hide_banner','-loglevel','error','-y','-f','rawvideo','-pixel_format','rgba','-video_size',`${W}x${H}`,'-framerate',String(FPS),'-i','pipe:0','-an','-c:v','libx264','-profile:v','high','-preset','medium','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',output],{stdio:['pipe','ignore','pipe'],signal:controller.signal,killSignal:'SIGKILL'});
 encoder.stderr.on('data',data=>{errors=(errors+data.toString()).slice(-8_192);});
 const done=new Promise((resolve,reject)=>{
  encoder.once('error',reject);
  encoder.once('close',(code,signal)=>code===0?resolve():reject(Error(`exit ${code??signal}`)));
 });
 const timer=setTimeout(()=>{timedOut=true;controller.abort();},timeoutMs);
 function* frames(){
  for(let frame=0;frame<FPS*SECONDS;frame++){
   draw(frame/(FPS*SECONDS));const pixels=x.getImageData(0,0,W,H).data;
   yield Buffer.from(pixels.buffer,pixels.byteOffset,pixels.byteLength);
  }
 }
 try{
  // Pipeline owns stdin errors (including EPIPE) and respects backpressure.
  await Promise.all([done,pipeline(Readable.from(frames(),{objectMode:false}),encoder.stdin,{signal:controller.signal})]);
 }catch(error){
  controller.abort();
  throw Error(timedOut?`Encoder timed out after ${timeoutMs} ms`:`Encoder failed: ${errors.trim()||error.message}`,{cause:error});
 }finally{
  clearTimeout(timer);encoder.stdin.destroy();
  if(encoder.exitCode===null&&encoder.signalCode===null)encoder.kill('SIGKILL');
 }
}

// Stage the complete directory beside the destination so publication uses same-filesystem renames.
// Copy any unrelated assets forward; the currently published bundle is untouched during encoding.
const staging=mkdtempSync(join(dirname(assetDir),'.bot-media-'));
const next=join(staging,'next'),previous=join(staging,'previous');
let published=false,preserveRecovery=false;
try{
if(existsSync(assetDir))cpSync(assetDir,next,{recursive:true});else mkdirSync(next);
// A legible rest frame doubles as the reduced-motion poster.
draw(0);writeFileSync(join(next,'bot-welcome.png'),c.toBuffer('image/png'));
const banner=`<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="640" viewBox="0 0 1280 640" role="img" aria-labelledby="title desc"><title id="title">Family VPN от Family Spy</title><desc id="desc">Existing Family Spy circle and three spokes, mint green on forest. Native vector composition. The companion MP4 traces the static circle once per four-second loop.</desc><rect width="1280" height="640" fill="${color.background}"/><g fill="none" stroke="${color.green}" stroke-width="11" stroke-linecap="round"><circle cx="250" cy="320" r="142"/><path d="M250 178V462M127.02 249 372.98 391M127.02 391 372.98 249"/></g><g font-family="Golos Text, sans-serif"><text x="465" y="325" fill="${color.white}" font-size="82" font-weight="600">Family VPN</text><text x="470" y="385" fill="${color.green}" font-size="32">от Family Spy</text></g></svg>\n`;
writeFileSync(join(next,'bot-welcome.svg'),banner);
const avatar=createCanvas(1024,1024),a=avatar.getContext('2d');a.fillStyle=color.background;a.fillRect(0,0,1024,1024);
a.strokeStyle=color.green;a.lineWidth=28.6;a.lineCap='round';a.beginPath();a.arc(512,512,308,0,Math.PI*2);a.stroke();
for(const [ax,ay,bx,by] of [[256,102,256,410],[122.9,179,389.1,333],[122.9,333,389.1,179]]){a.beginPath();a.moveTo(ax*2,ay*2);a.lineTo(bx*2,by*2);a.stroke();}
writeFileSync(join(next,'bot-avatar.png'),avatar.toBuffer('image/png'));
writeFileSync(join(next,'bot-avatar.jpg'),avatar.toBuffer('image/jpeg',94));
writeFileSync(join(next,'bot-avatar.svg'),`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 512 512" role="img" aria-labelledby="title desc"><title id="title">Family VPN</title><desc id="desc">Existing Family Spy circle and three spokes, mint green on forest; inset for a circular Telegram crop.</desc><rect width="512" height="512" fill="${color.background}"/><g fill="none" stroke="${color.green}" stroke-width="14.3" stroke-linecap="round"><circle cx="256" cy="256" r="154"/><path d="M256 102V410M122.9 179 389.1 333M122.9 333 389.1 179"/></g></svg>\n`);
await encode(join(next,'bot-welcome.mp4'));
if(existsSync(assetDir))renameSync(assetDir,previous);
try{renameSync(next,assetDir);}catch(error){
 if(existsSync(previous)){
  try{renameSync(previous,assetDir);}catch(rollbackError){
   preserveRecovery=true;
   throw new AggregateError([error,rollbackError],`Cannot publish or restore assets; original bundle preserved at ${previous}`);
  }
 }
 throw error;
}
published=true;
}finally{
 if(!preserveRecovery){
  try{rmSync(staging,{recursive:true,force:true});}catch(error){
   // A cleanup failure after publication must not report a failed build with changed assets.
   console.warn(`${published?'Bundle published':'Build failed'}; temporary directory retained at ${staging}: ${error.message}`);
  }
 }
}
console.log(JSON.stringify({banner:{width:W,height:H},avatar:{width:1024,height:1024},animation:{seconds:SECONDS,fps:FPS,frames:FPS*SECONDS,audio:false,loop:'rest-to-rest'},origin:'Existing Family Spy geometry and local Golos Text; deterministic canvas and FFmpeg. No AI raster generation.'}));
