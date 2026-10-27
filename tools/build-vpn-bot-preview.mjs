// Local, synthetic preview. This program never constructs a Telegram client or makes network calls.
import {readFileSync,writeFileSync,mkdirSync,chmodSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {VpnStore} from '../services/vpn/store.mjs';
import {Accounts} from '../services/vpn/auth.mjs';
import {TelegramStore} from '../services/vpn/telegram.mjs';
import {TelegramCommerce} from '../services/vpn/telegram-commerce.mjs';
import {TelegramUI,deliverUiOne,botBranding,nativeBotCommands} from '../services/vpn/telegram-ui.mjs';
import {TelegramSupport} from '../services/vpn/telegram-support.mjs';

if(process.env.NODE_ENV==='production')throw new Error('Synthetic local preview only');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),out=root+'/docs/preview/bot';
const privateDir=root+'/.context/recovery/preview/bot';
for(const path of [out,privateDir])mkdirSync(path,{recursive:true,mode:path===privateDir?0o700:0o755});
chmodSync(privateDir,0o700);
const hash=value=>createHash('sha256').update(value).digest('hex');
const sourceMark='<circle cx="16" cy="16" r="14"/><path d="M16 2v28M3.9 9l24.2 14M3.9 23 28.1 9"/>';
assert.ok(readFileSync(root+'/customer-site/index.html','utf8').includes(sourceMark),'Existing Family Spy mark changed; review avatar adaptation');
const avatar=`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 512 512" role="img" aria-labelledby="title desc">
<title id="title">Family VPN</title><desc id="desc">Existing Family Spy six-slice mark, coral on charcoal. Prepared bot avatar; not uploaded.</desc>
<rect width="512" height="512" fill="#101216"/>
<g transform="translate(80 80) scale(11)" fill="none" stroke="#ff9d88" stroke-width="1.3">${sourceMark}</g>
</svg>\n`;
writeFileSync(out+'/avatar.svg',avatar);
// Deterministic rasterization of the same circle/three line primitives, with four subpixel samples.
const require=createRequire(import.meta.url),{PNG}=require('../services/vpn/node_modules/pngjs');
const image=new PNG({width:1024,height:1024}),scale=2,stroke=14.3*scale;
const center=256*scale,radius=154*scale,segments=[[256,102,256,410],[122.9,179,389.1,333],[122.9,333,389.1,179]].map(row=>row.map(v=>v*scale));
function lineDistance(x,y,[ax,ay,bx,by]){const dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy)));return Math.hypot(x-ax-t*dx,y-ay-t*dy);}
for(let y=0;y<1024;y++)for(let x=0;x<1024;x++){
 let inside=0;for(const ox of [.25,.75])for(const oy of [.25,.75]){
  const px=x+ox,py=y+oy,d=Math.abs(Math.hypot(px-center,py-center)-radius);
  if(Math.min(d,...segments.map(s=>lineDistance(px,py,s)))<=stroke/2)inside++;
 }
 const coverage=inside/4,index=(y*1024+x)*4;
 for(const [channel,background,foreground] of [[0,16,255],[1,18,157],[2,22,136]])image.data[index+channel]=Math.round(background+(foreground-background)*coverage);
 image.data[index+3]=255;
}
const raster=PNG.sync.write(image);
const origin='Origin: deterministic raster of docs/preview/bot/avatar.svg, directly adapting the existing Family Spy mark in customer-site/index.html. Same circle and three line paths; charcoal #101216 and coral #ff9d88. Prepared for review; no upload.';
const text=Buffer.from('impeccable:prompt\0'+origin),type=Buffer.from('tEXt'),chunk=Buffer.alloc(text.length+12);
chunk.writeUInt32BE(text.length,0);type.copy(chunk,4);text.copy(chunk,8);
let crc=0xffffffff;for(const byte of Buffer.concat([type,text])){crc^=byte;for(let bit=0;bit<8;bit++)crc=crc&1?0xedb88320^(crc>>>1):crc>>>1;}
chunk.writeUInt32BE((crc^0xffffffff)>>>0,chunk.length-4);
writeFileSync(out+'/avatar.png',Buffer.concat([raster.subarray(0,-12),chunk,raster.subarray(-12)]));

const now=Date.UTC(2026,9,27,12),clock=()=>now;
const plans=JSON.parse(readFileSync(root+'/services/vpn/approved-plans.json','utf8'));
const store=new VpnStore(':memory:',{clock,plans}),users=new Accounts(store,{clock,publicSubscriptionOrigin:'https://subscription.example.invalid'});
const telegram=new TelegramStore(store,{clock}),commerce=new TelegramCommerce(store,{users,clock,origin:'https://preview.example.invalid',stars:{enabled:false,approved:false,plans:[]}});
const ui=new TelegramUI(telegram,{commerce,enabled:true,clock});telegram.ui=ui;
const raw=[],screens=[];let sequence=0;
const sender={call:async(method,data)=>{raw.push({method,data:structuredClone(data)});return {message_id:raw.length};}};
const message=(chatId,text)=>telegram.update({update_id:++sequence,message:{message_id:sequence,chat:{type:'private',id:chatId},from:{id:chatId},text}});
const drain=async()=>{let guard=100;while(await deliverUiOne(ui,sender))assert.ok(--guard>0);};
const last=()=>raw.filter(row=>row.method==='sendMessage').at(-1);
async function press(chatId,label){
 const button=last().data.reply_markup.inline_keyboard.flat().find(b=>b.text===label);assert.ok(button?.callback_data,'Missing real button '+label);
 telegram.update({update_id:++sequence,callback_query:{id:'synthetic-preview-'+sequence,from:{id:chatId},message:{message_id:1,chat:{type:'private',id:chatId}},data:button.callback_data}});await drain();
}
function sanitizedButton(button){
 const result={text:button.text};
 if(button.callback_data){
  const row=store.db.prepare('SELECT action,data FROM telegram_ui_callbacks WHERE token_hash=?').get(hash(button.callback_data.slice(2)));
  assert.ok(row);result.kind='callback';result.action=row.action;result.arguments=JSON.parse(row.data);
 }else if(button.copy_text){result.kind='copy';result.copyText=button.copy_text.text;}
 else if(button.url){const url=new URL(button.url);result.kind=url.hostname==='preview.example.invalid'?'handoff':'url';result.url=result.kind==='handoff'?url.origin+url.pathname+'#SYNTHETIC_HANDOFF_REDACTED':button.url;}
 return result;
}
function snapshot(id,title,trigger){
 const row=last();assert.equal(row.method,'sendMessage');
 screens.push({id,title,trigger,message:{method:row.method,text:row.data.text,parseMode:row.data.parse_mode||null,buttons:row.data.reply_markup?.inline_keyboard?.map(line=>line.map(sanitizedButton))||[]}});
}
const guest=12001,paidChat=12002;
message(guest,'/start');await drain();snapshot('guest','Первый запуск','/start');
await press(guest,'Купить / продлить');snapshot('unlinked','Подключение аккаунта','Купить / продлить');
await press(guest,'Уже есть подписка');snapshot('binding','Уже покупал на сайте','Уже есть подписка');
message(guest,'/renew');await drain();await press(guest,'Создать аккаунт');snapshot('terms','Новый аккаунт','Создать аккаунт');
await press(guest,'Принимаю и продолжаю');snapshot('sales-unavailable','Покупка пока закрыта','Принимаю и продолжаю');
const paid=await users.add({login:'synthetic-bot-preview-paid',profileUrl:'https://sub.family-pie.ru/sub/PREVIEW_ONLY',expiresAt:now+30*86400000});
store.db.prepare('UPDATE identities SET must_change=0 WHERE account_id=?').run(paid.accountId);
const plan=plans.find(p=>p.days===30),order=store.createOrder(paid.accountId,30,'synthetic-bot-preview-seed');store.bindPayment(paid.accountId,order.id,'synthetic-bot-preview-payment');
store.confirmPayment({id:'synthetic-bot-preview-payment',status:'succeeded',paid:true,test:true,amount:{currency:'RUB',value:(plan.priceMinor/100).toFixed(2)},metadata:{order_id:order.id}});
store.db.prepare("UPDATE managed_subscriptions SET enabled=1,sync_state='synced',entitlement_revision=? WHERE account_id=?").run(store.account(paid.accountId).revision,paid.accountId);
const session=users.newSession(paid.accountId),sessionHash=users.session(session.token).token_hash,nonce=telegram.issue(paid.accountId,sessionHash);
telegram.candidate(nonce,String(paidChat),'@synthetic_preview');telegram.confirm(paid.accountId,sessionHash);
message(paidChat,'/start');await drain();snapshot('paid','Подписка активна','/start');
await press(paidChat,'Подключиться');snapshot('devices','Выбор устройства','Подключиться');
await press(paidChat,'iPhone / iPad');snapshot('install','Установка и импорт','iPhone / iPad');
await press(paidChat,'Скопировать / вставить вручную');snapshot('manual','Ручное добавление','Скопировать / вставить вручную');
message(paidChat,'/notifications');await drain();snapshot('notifications','Напоминания','/notifications');
message(paidChat,'/stop');await drain();snapshot('muted','Напоминания выключены','/stop');
const operator=await users.add({login:'synthetic-bot-preview-operator',role:'admin'});
store.db.prepare('UPDATE identities SET must_change=0 WHERE account_id=?').run(operator.accountId);
store.db.prepare("INSERT INTO telegram_links(account_id,chat_id,generation,bound_at) VALUES(?,13003,'synthetic-operator',?)").run(operator.accountId,now);
telegram.support=new TelegramSupport(store,{operatorAccountId:operator.accountId,botId:14004,clock});
message(paidChat,'/menu');await drain();await press(paidChat,'Помощь');snapshot('help','Помощь в чате','Помощь');
const sourceFiles=['services/vpn/telegram-ui.mjs','services/vpn/telegram.mjs','services/vpn/telegram-commerce.mjs'];
const transcript={schema:'family-vpn-bot-preview/v1',syntheticOnly:true,generatedAt:new Date().toISOString(),fixtureDate:new Date(now).toISOString(),
 evidence:'Messages captured from TelegramStore.update → TelegramUI → injected local sender. No Telegram API, provider, real profile or device import.',
 redaction:'Opaque callback, account and handoff tokens excluded. Visible text and button labels are exact handler output. All displayed subscription values are synthetic.',
 sales:{enabled:false,approved:false,starPrices:[]},sources:Object.fromEntries(sourceFiles.map(path=>[path,hash(readFileSync(root+'/'+path))])),screens};
const rawPath=privateDir+'/transcript.raw.json';writeFileSync(rawPath,JSON.stringify({syntheticOnly:true,raw},null,2)+'\n',{mode:0o600});chmodSync(rawPath,0o600);
writeFileSync(out+'/transcript.json',JSON.stringify(transcript,null,2)+'\n');
assert.ok(!JSON.stringify(transcript).includes('u_')&&!JSON.stringify(transcript).includes('token=')&&!JSON.stringify(transcript).includes('bind_'));
const metadata={status:'prepared-not-applied',name:botBranding.name,shortDescription:botBranding.shortDescription,description:botBranding.description,language:'ru',
 avatar:{source:'avatar.svg',render:'avatar.png',width:1024,height:1024,sha256:hash(readFileSync(out+'/avatar.png')),provenance:'Adapted directly from customer-site/index.html .brand svg; same circle and three spokes. Charcoal #101216 / coral #ff9d88.'},
 commands:nativeBotCommands,changesAppliedToTelegram:false,publication:'Owner approval and authorized bot administration required; no BotFather or API calls performed.'};
assert.ok(metadata.name.length<=64&&metadata.shortDescription.length<=120&&metadata.description.length<=512);
writeFileSync(out+'/metadata.json',JSON.stringify(metadata,null,2)+'\n');
// Build a self-contained artifact: current local typefaces, avatar and sanitized real transcript are embedded.
const template=readFileSync(root+'/tools/vpn-bot-preview.template.html','utf8');
const fonts=[['400','14b6aebb899c'],['500','5276ae12340d'],['600','2ddbbcb0584d']].map(([weight,file])=>`@font-face{font-family:'Golos Text';font-style:normal;font-weight:${weight};font-display:swap;src:url(data:font/woff2;base64,${readFileSync(root+'/site/vpn/fonts/'+file+'.woff2').toString('base64')}) format('woff2')}`).join('\n');
const safeJSON=value=>JSON.stringify(value).replaceAll('<','\\u003c');
writeFileSync(out+'/index.html',template.replace('/* EMBEDDED_FONTS */',fonts).replace('<!-- AVATAR -->',avatar.replace(/ role="img" aria-labelledby="title desc"/,' aria-hidden="true"').replace(/<title.*?<\/title><desc.*?<\/desc>/s,''))
 .replace('/* TRANSCRIPT */',safeJSON(transcript)).replace('/* METADATA */',safeJSON(metadata)));
store.close();
console.log('Prepared synthetic bot preview: '+screens.length+' real-handler states; no messages sent.');
