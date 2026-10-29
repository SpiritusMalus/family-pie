// Optional, owner-only QA navigation on the existing poller. No merchant credentials,
// provider client, panel worker, financial-event simulation or public trial lives here.
import {constants,openSync,closeSync,readFileSync,fstatSync,lstatSync,realpathSync} from 'node:fs';
import {dirname,isAbsolute,join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {VpnStore} from './store.mjs';
import {Accounts} from './auth.mjs';
import {Cabinet} from './cabinet.mjs';
import {TelegramStore,deliverOne} from './telegram.mjs';
import {TelegramCommerce} from './telegram-commerce.mjs';
import {TelegramUI,deliverUiOne} from './telegram-ui.mjs';

const MAX_CASE_MS=3*3_600_000,positive=value=>Number.isSafeInteger(value)&&value>0;
const banner='TEST · без реальных списаний. Отдельный проверочный аккаунт.\n\n';
const unavailable='TEST сейчас недоступен. Реальная покупка не начата. Восстановление: /recover. Помощь: /help.';
const requireThat=ok=>{if(!ok)throw new Error('Private Telegram QA configuration unavailable');};
const hash=value=>createHash('sha256').update(value).digest('hex');
const financial=update=>Boolean(update?.pre_checkout_query||update?.message?.successful_payment||update?.message?.refunded_payment);
const privateActor=update=>{
 const msg=update?.callback_query?.message||update?.message,actor=update?.callback_query?.from||msg?.from;
 return msg?.chat?.type==='private'&&positive(msg.chat.id)&&actor?.id===msg.chat.id&&!actor.is_bot?msg.chat.id:null;
};
const navigationText=new Set(['Меню','Моя подписка','Подключиться','Продлить','Купить / продлить','Уведомления','Личный кабинет','💳 Купить / продлить','🔌 Подключиться','📋 Моя подписка','🔔 Напоминания']);
const navigationCommands=new Set(['/menu','/terms','/privacy','/status','/subscription','/connect','/renew','/plans','/notifications','/disconnect','/cabinet']);
const privateOwner=stat=>(stat.uid===0||stat.uid===process.getuid?.())&&(stat.mode&0o077)===0;
function privateFile(path,max=16_384){
 const parent=lstatSync(dirname(path));requireThat(parent.isDirectory()&&!parent.isSymbolicLink()&&privateOwner(parent));
 const before=lstatSync(path);requireThat(before.isFile()&&!before.isSymbolicLink()&&before.nlink===1&&before.size<=max&&privateOwner(before));
 const fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW);
 try{const current=fstatSync(fd);requireThat(current.dev===before.dev&&current.ino===before.ino&&privateOwner(current));return readFileSync(fd,'utf8');}finally{closeSync(fd);}
}

/** Credential contains routing/state only. Unknown fields, including merchant secrets, fail closed. */
export function readTelegramQaConfig(path,{liveDbPath,ownerId,clock=Date.now}={}){
 const value=JSON.parse(privateFile(path)),keys=['schema','caseId','ownerId','expiresAt','dbPath','webOrigin','plans'];
 requireThat(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&Object.keys(value).every(key=>keys.includes(key)));
 requireThat(value.schema===1&&typeof value.caseId==='string'&&/^[a-z0-9][a-z0-9-]{7,63}$/.test(value.caseId)&&positive(ownerId)&&value.ownerId===ownerId);
 requireThat(positive(value.expiresAt)&&value.expiresAt<=clock()+MAX_CASE_MS); // An expired, valid case remains fenced.
 requireThat(typeof value.dbPath==='string'&&isAbsolute(value.dbPath)&&resolve(value.dbPath)===value.dbPath&&realpathSync(value.dbPath)===value.dbPath);
 const dir=lstatSync(dirname(value.dbPath)),file=lstatSync(value.dbPath),live=lstatSync(liveDbPath);
 requireThat(dir.isDirectory()&&!dir.isSymbolicLink()&&privateOwner(dir)&&file.isFile()&&!file.isSymbolicLink()&&file.nlink===1&&privateOwner(file));
 requireThat(realpathSync(dirname(value.dbPath))!==realpathSync(dirname(liveDbPath))&&!(file.dev===live.dev&&file.ino===live.ino));
 for(const suffix of ['-wal','-shm']){try{const side=lstatSync(value.dbPath+suffix);requireThat(side.isFile()&&!side.isSymbolicLink()&&side.nlink===1&&privateOwner(side));}catch(error){if(error.code!=='ENOENT')throw error;}}
 const origin=new URL(value.webOrigin);requireThat(origin.origin===value.webOrigin&&origin.protocol==='http:'&&origin.hostname==='localhost'&&origin.port==='8352'&&!origin.username&&!origin.password);
 requireThat(Array.isArray(value.plans)&&value.plans.length===1&&value.plans[0]&&Object.keys(value.plans[0]).sort().join(',')==='days,devices,priceMinor'&&value.plans[0].days===30&&value.plans[0].priceMinor===30000&&value.plans[0].devices===0);
 return Object.freeze({...value,plans:Object.freeze(value.plans.map(plan=>Object.freeze({...plan})))});
}

export class TelegramQaDispatcher {
 constructor(telegram,productionUi,{config=null,ownerId,clock=telegram.clock,botUsername=''}={}){
  requireThat(positive(ownerId));
  this.telegram=telegram;this.productionUi=productionUi;this.clock=clock;this.config=config;this.ownerId=ownerId;this.failed=!config;this.store=null;
  this.proxy={commerce:productionUi.commerce,handle:update=>this.handle(update)};
  if(!config)return;
  try{
   requireThat(typeof botUsername==='string'&&/^[A-Za-z0-9_]{5,32}$/.test(botUsername));
   // Inspect before any constructor writes: an unmarked DB must contain zero accounts.
   const probe=new DatabaseSync(config.dbPath,{readOnly:true});
   try{
    const marked=probe.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='telegram_qa_case'").get();
    const count=probe.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='accounts'").get()?probe.prepare('SELECT count(*) n FROM accounts').get().n:0;
    requireThat(marked||count===0);
    if(marked)requireThat(probe.prepare('SELECT binding FROM telegram_qa_case WHERE singleton=1').get()?.binding===this.binding());
   }finally{probe.close();}
   this.store=new VpnStore(config.dbPath,{clock,plans:config.plans});
   // A QA web transaction must not consume the production pre-checkout deadline.
   this.store.db.exec('PRAGMA busy_timeout=250');
   const users=new Accounts(this.store,{clock}),cabinet=new Cabinet(this.store,{origin:config.webOrigin});
   this.qaTelegram=new TelegramStore(this.store,{clock});
   this.commerce=new TelegramCommerce(this.store,{users,clock,origin:config.webOrigin,stars:{enabled:false,approved:false,plans:[]}});
   this.ui=new TelegramUI(this.qaTelegram,{commerce:this.commerce,clock,enabled:true,origin:productionUi.origin});
   this.qaTelegram.ui={handle:update=>{if(this.ui.handle(update))return true;this.ui.queue(String(config.ownerId),'qa-input:'+update.update_id,'input_help');return true;}};
   this.store.transaction(()=>{
    this.store.db.exec('CREATE TABLE IF NOT EXISTS telegram_qa_case(singleton INTEGER PRIMARY KEY CHECK(singleton=1),binding TEXT NOT NULL,initial_accounts INTEGER NOT NULL CHECK(initial_accounts=0),created_at INTEGER NOT NULL)');
    this.store.db.prepare('INSERT OR IGNORE INTO telegram_qa_case VALUES(1,?,0,?)').run(this.binding(),clock());
    requireThat(this.store.db.prepare('SELECT binding FROM telegram_qa_case WHERE singleton=1').get()?.binding===this.binding());
    cabinet.setPlans(config.plans);this.checkAccounts();
   });
   const render=this.ui.render.bind(this.ui);
   this.ui.render=job=>{
    requireThat(this.active()&&job.chat_id===String(config.ownerId));
    const message=render(job);requireThat(!['sendInvoice','answerPreCheckoutQuery','refundStarPayment'].includes(message.method));
    if(typeof message.data?.text==='string')message.data.text=banner+message.data.text;
    if(typeof message.data?.caption==='string')message.data.caption=banner+message.data.caption;
    // A real Telegram deep link enters the existing production support handler;
    // no support tickets or synthetic support updates are created in the QA DB.
    for(const row of message.data?.reply_markup?.inline_keyboard||[])for(let n=0;n<row.length;n++){
     const button=row[n],data=button.callback_data;
     if(typeof data==='string'&&/^u_[A-Za-z0-9_-]{24}$/.test(data)&&this.store.db.prepare('SELECT action FROM telegram_ui_callbacks WHERE token_hash=?').get(hash(data.slice(2)))?.action==='help')row[n]={text:button.text,url:'https://t.me/'+botUsername+'?start=support_vpn'};
    }
    return message;
   };
  }catch{this.failed=true;this.store?.close();this.store=null;}
 }
 binding(){const {schema,caseId,ownerId,expiresAt,dbPath,webOrigin,plans}=this.config;return hash(JSON.stringify({schema,caseId,ownerId,expiresAt,dbPath,webOrigin,plans}));}
 checkAccounts(){
  const db=this.store.db,owner=String(this.config.ownerId),count=db.prepare('SELECT count(*) n FROM accounts').get().n;
  requireThat(count<=1&&db.prepare('SELECT count(*) n FROM identities').get().n===count&&db.prepare('SELECT count(*) n FROM telegram_links').get().n===count);
  requireThat(!db.prepare('SELECT 1 FROM telegram_links WHERE chat_id<>?').get(owner)&&!db.prepare('SELECT 1 FROM identities WHERE role<>\'user\'').get());
 }
 active(){return !this.failed&&this.store!==null&&this.clock()<this.config.expiresAt;}
 productionOnly(update){
  if(financial(update)||update?.my_chat_member)return true;
  const msg=update?.message;
  if(msg){
   const raw=typeof msg.text==='string'?msg.text.trim():'',parts=raw.split(/\s+/),command=parts[0].split('@')[0];
   if(msg.reply_to_message||['/recover','/recovery','/email','/help','/support','/paysupport','/cancel'].includes(command)||['Помощь','💬 Помощь'].includes(raw)||command==='/start'&&(parts[1]?.startsWith('bind_')||['recover','recovery','support','support_vpn','support_sufler'].includes(parts[1])))return true;
   // Ordinary support replies stay in production; explicit menu commands can leave support mode.
   if(!raw.startsWith('/')&&!navigationText.has(raw)){
    if(this.productionUi.db.prepare('SELECT mode FROM telegram_ui_state WHERE chat_id=?').get(String(msg.chat?.id))?.mode==='support')return true;
   }
  }
  const data=update?.callback_query?.data;
  if(typeof data==='string'&&/^u_[A-Za-z0-9_-]{24}$/.test(data)){
   const row=this.productionUi.db.prepare('SELECT action FROM telegram_ui_callbacks WHERE token_hash=?').get(hash(data.slice(2)));
   if(row&&['help','binding','unlink','unlink_confirm','reminders','settings'].includes(row.action))return true;
  }
  return false;
 }
 deliberateNavigation(update){
  const msg=update?.message;
  if(msg){
   if(msg.reply_to_message||msg.forward_origin||msg.forward_from||msg.forward_date||msg.via_bot||msg.sender_chat||msg.external_reply)return false;
   const raw=typeof msg.text==='string'?msg.text.trim():'',parts=raw.split(/\s+/),command=parts[0].split('@')[0];
   return navigationText.has(raw)||navigationCommands.has(command)||command==='/start'&&!parts[1];
  }
  const data=update?.callback_query?.data;
  if(typeof data!=='string'||!/^u_[A-Za-z0-9_-]{24}$/.test(data))return false;
  const row=this.ui.db.prepare('SELECT * FROM telegram_ui_callbacks WHERE token_hash=?').get(hash(data.slice(2)));
  return Boolean(row&&!row.used&&row.chat_id===String(this.ownerId)&&row.scope===this.ui.authority(String(this.ownerId)).scope&&row.expires>this.clock()&&['create','home','subscription','devices','plans','settings','cabinet','checkout','device','manual','qr','accept_terms'].includes(row.action));
 }
 handle(update){
  if(this.productionOnly(update)){
   // Replies go directly to the existing support router, not a pending registration notice.
   if(update?.message?.reply_to_message)return false;
   return this.productionUi.handle(update);
  }
  const actor=privateActor(update);
  if(actor===null)return this.productionUi.handle(update);
  if(actor!==this.ownerId)return this.productionUi.handle(update);
  if(!this.active())return this.fence(update,actor);
  // Old production navigation callbacks cannot create a live account or start live checkout.
  const data=update?.callback_query?.data;
  if(typeof data==='string'&&/^u_[A-Za-z0-9_-]{24}$/.test(data)&&this.productionUi.db.prepare('SELECT 1 FROM telegram_ui_callbacks WHERE token_hash=?').get(hash(data.slice(2))))return this.fence(update,actor);
  try{
   // A deliberate owner navigation exits only the old UI context. The production
   // support ticket, customer/history and relay outboxes are left untouched.
   if(this.deliberateNavigation(update)&&this.productionUi.db.prepare('SELECT mode FROM telegram_ui_state WHERE chat_id=?').get(String(actor))?.mode==='support')this.productionUi.mode(String(actor));
   this.checkAccounts();this.qaTelegram.update(update);this.checkAccounts();
   requireThat(this.qaTelegram.offset()>update.update_id);
   return true; // QA transaction has COMMITTED before the live transaction advances its cursor.
  }catch{
   // Keep the financial poller running. This update is durably rejected in the live
   // outbox, never retried as a live purchase or presented as successful QA registration.
   this.failed=true;return this.fence(update,actor);
  }
 }
 fence(update,actor){
  const recent=this.telegram.db.prepare('SELECT count(*) n FROM telegram_outbox WHERE chat_id=? AND created_at>?').get(String(actor),this.clock()-60000).n;
  if(recent<10)this.telegram.reply(String(actor),update.update_id,unavailable);
  const query=update?.callback_query;
  if(typeof query?.id==='string'&&query.id.length<=128)this.productionUi.queue(String(actor),'qa-fence:'+update.update_id,'callback_answer',{callback_query_id:query.id,text:'TEST недоступен. Открой /menu.',show_alert:true});
  return true;
 }
 prepare(){
  // Do not let a previously queued live purchase/registration notice escape into the QA journey.
  this.telegram.db.prepare("UPDATE telegram_ui_outbox SET state='canceled' WHERE state='pending' AND view NOT IN ('precheckout','callback_answer','paid','refunded','financial_receipt','payment_invalid','help','binding','settings','unlink','unlink_blocked','unlinked') AND chat_id=?").run(String(this.ownerId));
  if(!this.active()&&this.store)this.guard(()=>this.store.db.prepare("UPDATE telegram_ui_outbox SET state='canceled' WHERE state='pending'").run());
 }
 guard(fn,fallback=false){try{return fn();}catch{this.failed=true;return fallback;}}
 async guardAsync(fn){try{return await fn();}catch{this.failed=true;return false;}}
 recover(){if(this.store)this.guard(()=>{this.qaTelegram.recover();this.ui.recover();});}
 pending(){return this.active()?this.guard(()=>Boolean(this.qaTelegram.next()||this.ui.next())):false;}
 plan(){if(this.active())this.guard(()=>this.ui.plan());}
 async controls(client){return this.guardAsync(async()=>{while(this.active()&&this.ui.next()?.view==='callback_answer')await deliverUiOne(this.ui,client);});}
 deliveries(client){return [()=>this.guardAsync(async()=>this.active()?deliverUiOne(this.ui,client):false),()=>this.guardAsync(async()=>this.active()?deliverOne(this.qaTelegram,{call:(method,data)=>client.call(method,{...data,text:banner+data.text})}):false)];}
 close(){if(this.store)this.guard(()=>this.store.close());this.store=null;}
}

/** No credential reads or QA DB opens unless explicitly enabled. Never stops financial polling. */
export function createTelegramQa(telegram,productionUi,{env=process.env,clock=telegram.clock,onStatus=message=>console.error(message)}={}){
 if(env.VPN_TELEGRAM_QA_ENABLED!=='1')return null;
 const raw=env.VPN_TELEGRAM_QA_OWNER_ID,ownerId=Number(raw);
 if(typeof raw!=='string'||!/^[1-9][0-9]{0,15}$/.test(raw)||!positive(ownerId)||String(ownerId)!==raw){onStatus('Telegram QA not armed: explicit owner configuration missing or invalid');return null;}
 let config=null;try{requireThat(typeof env.CREDENTIALS_DIRECTORY==='string'&&isAbsolute(env.CREDENTIALS_DIRECTORY));config=readTelegramQaConfig(join(env.CREDENTIALS_DIRECTORY,'telegram-qa'),{liveDbPath:env.VPN_DATABASE_PATH,ownerId,clock});}catch{}
 const qa=new TelegramQaDispatcher(telegram,productionUi,{config,ownerId,clock,botUsername:env.VPN_TELEGRAM_BOT_USERNAME});
 if(qa.failed)onStatus('Telegram QA fenced for configured owner: private configuration or state unavailable');
 return qa;
}
