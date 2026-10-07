import {randomBytes,createHash,randomUUID} from 'node:crypto';
const DAY=86400_000,hash=x=>createHash('sha256').update(x).digest('hex');
const CABINET='https://family-pie.ru/vpn/cabinet/';
const BIND_HELP='Чтобы увидеть свою подписку, привяжи Telegram в кабинете: Настройки → Telegram → Подключить. После запуска бота вернись в кабинет и подтверди привязку.\n'+CABINET+'#settings';
export const botCommands=[
 {command:'menu',description:'Открыть меню'},
 {command:'status',description:'Моя подписка'},
 {command:'connect',description:'Подключиться к VPN'},
 {command:'renew',description:'Продлить подписку'},
 {command:'cabinet',description:'Личный кабинет'},
 {command:'help',description:'Помощь с подключением'},
 {command:'notifications',description:'Настройки уведомлений'},
 {command:'stop',description:'Отключить уведомления и отвязать Telegram'}
];
export const botKeyboard={keyboard:[
 [{text:'Моя подписка'},{text:'Подключиться'}],
 [{text:'Продлить'},{text:'Личный кабинет'}],
 [{text:'Помощь'},{text:'Уведомления'}]
],resize_keyboard:true,is_persistent:true,input_field_placeholder:'Выбери действие в меню'};
const menuActions=new Map([
 ['Моя подписка','/status'],['Подключиться','/connect'],['Продлить','/renew'],
 ['Личный кабинет','/cabinet'],['Помощь','/help'],['Уведомления','/notifications'],['Меню','/menu']
]);
const expiryDate=ms=>new Intl.DateTimeFormat('ru-RU',{timeZone:'UTC',dateStyle:'long',timeStyle:'short'}).format(ms)+' UTC';
export async function configureBotMenu(client){
 await client.call('setMyCommands',{commands:botCommands,scope:{type:'all_private_chats'}});
 await client.call('setChatMenuButton',{menu_button:{type:'commands'}});
}
export class TelegramStore {
 constructor(store,{clock=Date.now}={}){this.store=store;this.db=store.db;this.clock=clock;this.db.exec(`
 CREATE TABLE IF NOT EXISTS telegram_links(account_id TEXT PRIMARY KEY REFERENCES identities(account_id),chat_id TEXT UNIQUE NOT NULL,username TEXT,enabled INTEGER NOT NULL DEFAULT 1,generation TEXT NOT NULL,bound_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS telegram_challenges(token_hash TEXT PRIMARY KEY,account_id TEXT NOT NULL REFERENCES identities(account_id),session_hash TEXT NOT NULL REFERENCES sessions(token_hash) ON DELETE CASCADE,expires INTEGER NOT NULL,chat_id TEXT,username TEXT);
 CREATE TABLE IF NOT EXISTS telegram_outbox(id TEXT PRIMARY KEY,dedupe TEXT UNIQUE NOT NULL,account_id TEXT,chat_id TEXT NOT NULL,generation TEXT,expiry INTEGER,stage TEXT,text TEXT,state TEXT NOT NULL DEFAULT 'pending',ready_at INTEGER NOT NULL,created_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS telegram_meta(key TEXT PRIMARY KEY,value INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS telegram_outbox_pending ON telegram_outbox(state,ready_at);
 `);}
 state(accountId,sessionHash){const link=this.db.prepare('SELECT enabled FROM telegram_links WHERE account_id=?').get(accountId);const pending=this.db.prepare('SELECT username FROM telegram_challenges WHERE account_id=? AND session_hash=? AND chat_id IS NOT NULL AND expires>?').get(accountId,sessionHash,this.clock());return {linked:Boolean(link),enabled:Boolean(link?.enabled),pending:Boolean(pending),candidate:pending?.username||null};}
 issue(accountId,sessionHash){const identity=this.db.prepare('SELECT enabled,must_change FROM identities WHERE account_id=?').get(accountId);const session=this.db.prepare('SELECT account_id,expires FROM sessions WHERE token_hash=?').get(sessionHash);if(!identity?.enabled||identity.must_change||session?.account_id!==accountId||session.expires<=this.clock())throw new Error('Forbidden');const token=randomBytes(32).toString('base64url');this.store.transaction(()=>{this.db.prepare('DELETE FROM telegram_challenges WHERE account_id=? OR expires<=?').run(accountId,this.clock());this.db.prepare('INSERT INTO telegram_challenges(token_hash,account_id,session_hash,expires) VALUES(?,?,?,?)').run(hash(token),accountId,sessionHash,this.clock()+600_000);});return token;}
 candidate(token,chatId,username){return this.store.transaction(()=>this.candidateInternal(token,chatId,username));}
 candidateInternal(token,chatId,username){if(typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token))return false;const row=this.db.prepare('SELECT c.*,i.enabled,i.must_change,s.expires AS session_expires FROM telegram_challenges c JOIN identities i ON i.account_id=c.account_id JOIN sessions s ON s.token_hash=c.session_hash WHERE c.token_hash=?').get(hash(token));if(!row||row.expires<=this.clock()||row.session_expires<=this.clock()||!row.enabled||row.must_change||row.chat_id)return false;this.db.prepare('UPDATE telegram_challenges SET chat_id=?,username=? WHERE token_hash=?').run(chatId,username,hash(token));return true;}
 confirm(accountId,sessionHash){return this.store.transaction(()=>{const row=this.db.prepare('SELECT * FROM telegram_challenges WHERE account_id=? AND session_hash=? AND expires>? AND chat_id IS NOT NULL').get(accountId,sessionHash,this.clock());if(!row)throw new Error('Link expired');const old=this.db.prepare('SELECT account_id FROM telegram_links WHERE chat_id=?').get(row.chat_id);if(old&&old.account_id!==accountId)throw new Error('Telegram already linked');this.disconnectInternal(accountId);this.db.prepare('INSERT INTO telegram_links VALUES(?,?,?,1,?,?)').run(accountId,row.chat_id,row.username,randomBytes(16).toString('hex'),this.clock());this.db.prepare('DELETE FROM telegram_challenges WHERE account_id=?').run(accountId);return true;});}
 disconnectInternal(accountId){this.db.prepare("UPDATE telegram_outbox SET state='canceled' WHERE account_id=? AND state='pending'").run(accountId);this.db.prepare('DELETE FROM telegram_links WHERE account_id=?').run(accountId);this.db.prepare('DELETE FROM telegram_challenges WHERE account_id=?').run(accountId);}
 disconnect(accountId){this.store.transaction(()=>this.disconnectInternal(accountId));}
 offset(){return this.db.prepare("SELECT value FROM telegram_meta WHERE key='offset'").get()?.value||0;}
 reply(chatId,updateId,text){this.db.prepare("INSERT OR IGNORE INTO telegram_outbox(id,dedupe,chat_id,text,ready_at,created_at) VALUES(?,?,?,?,?,?)").run(randomUUID(),'reply:'+updateId,chatId,text,this.clock(),this.clock());}
 linkedSubscription(chatId){return this.db.prepare('SELECT s.*,i.enabled AS account_enabled,i.must_change,l.enabled AS notifications FROM telegram_links l JOIN managed_subscriptions s USING(account_id) JOIN identities i USING(account_id) WHERE l.chat_id=?').get(chatId);}
 subscriptionStatus(row){
  if(!row)return BIND_HELP;
  if(!row.account_enabled||row.must_change)return 'Для просмотра подписки войди в кабинет.\n'+CABINET;
  if(row.deleted)return 'Подписка отключена. Обратись в поддержку: '+CABINET+'#support';
  if(row.allow_unlimited&&row.unlimited&&row.enabled)return 'Твоя подписка без ограничения срока. Продление не требуется.\nПодключение: '+CABINET+'#home';
  const paid=this.store.subscription(row.account_id);
  if(!row.allow_unlimited&&paid.active&&(row.sync_state!=='synced'||row.entitlement_revision!==paid.revision))return 'Оплата подтверждена. Подключение готовится автоматически.\nПодписка действует до '+expiryDate(paid.expiresAt)+'.\n'+CABINET+'#home';
  if(!row.allow_unlimited&&!paid.active)return paid.expiresAt?'Подписка закончилась '+expiryDate(paid.expiresAt)+'.\nПродлить: '+CABINET+'#plans':'Активной подписки пока нет. Выбери тариф и оплати его — подключение появится автоматически.\n'+CABINET+'#plans';
  if(row.sync_state==='awaiting_payment')return 'Активной подписки пока нет. Выбери тариф и оплати его — подключение появится автоматически.\n'+CABINET+'#plans';
  if(row.expires_at&&row.expires_at<=this.clock())return 'Подписка закончилась '+expiryDate(row.expires_at)+'.\nПродлить: '+CABINET+'#plans';
  if(!row.enabled)return 'Подписка отключена. Проверь её в кабинете: '+CABINET+'#home';
  if(row.sync_state!=='synced')return 'Подключение обновляется. Статус и ссылка появятся в кабинете: '+CABINET+'#home';
  return row.expires_at?'Твоя подписка действует до '+expiryDate(row.expires_at)+'.\nЛимит тарифа: '+row.devices+'.\nПодключение: '+CABINET+'#home':'Нет активной подписки.\n'+CABINET+'#plans';
 }
 update(update){if(!Number.isSafeInteger(update?.update_id)||update.update_id<this.offset())return;this.store.transaction(()=>{
 const msg=update.message,chat=msg?.chat,from=msg?.from;
 if(chat?.type==='private'&&Number.isSafeInteger(chat.id)&&chat.id>0&&from?.id===chat.id&&!from.is_bot&&typeof msg.text==='string'){
  const id=String(chat.id),command=menuActions.get(msg.text.trim())||msg.text.trim().split(/\s+/)[0].split('@')[0];let text;
  const recent=this.db.prepare('SELECT count(*) n FROM telegram_outbox WHERE chat_id=? AND created_at>?').get(id,this.clock()-60000).n;
  if(command==='/stop'){
   const row=this.db.prepare('SELECT account_id FROM telegram_links WHERE chat_id=?').get(id);if(row)this.disconnectInternal(row.account_id);
   this.db.prepare('DELETE FROM telegram_challenges WHERE chat_id=?').run(id);text='Уведомления отключены, Telegram отвязан. Подключить его снова можно в настройках кабинета.\n'+CABINET+'#settings';
  }else if(command==='/start'){
   const payload=msg.text.trim().split(/\s+/)[1];
   if(payload?.startsWith('bind_'))text=this.candidateInternal(payload.slice(5),id,typeof from.username==='string'&&/^[A-Za-z0-9_]{1,32}$/.test(from.username)?'@'+from.username:'Telegram ID '+id)?'Вернись в личный кабинет и подтверди привязку этого Telegram-аккаунта. Ссылка действует 10 минут.':'Ссылка недействительна или уже использована. Создай новую в личном кабинете.';
   else text='Family VPN. Выбери действие кнопками ниже.\n'+(this.linkedSubscription(id)?this.subscriptionStatus(this.linkedSubscription(id)):BIND_HELP);
  }else if(command==='/status'||command==='/subscription'){
   text=this.subscriptionStatus(this.linkedSubscription(id));
  }else if(command==='/connect'){
   const row=this.linkedSubscription(id);
   text=this.subscriptionStatus(row);
   if(row?.account_enabled&&!row.must_change&&!row.deleted&&row.enabled&&row.sync_state==='synced'&&(row.allow_unlimited&&row.unlimited||row.expires_at>this.clock()&&this.store.subscription(row.account_id).active))text='Открой «Обзор» в кабинете — там твоя ссылка подключения, QR-код и кнопка добавления в Happ.\n'+CABINET+'#home\nИнструкции для устройства: '+CABINET+'#devices';
  }else if(command==='/renew'){
   const row=this.linkedSubscription(id);
   text=row?.account_enabled&&!row.must_change&&row.allow_unlimited&&row.unlimited&&row.enabled&&!row.deleted?'Твоя подписка без ограничения срока. Продление не требуется.\n'+CABINET+'#home':'Выбери тариф и оплати в кабинете. После подтверждения ЮKassa срок добавится автоматически.\n'+CABINET+'#plans';
  }else if(command==='/cabinet'){
   text='Твой личный кабинет: '+CABINET+'\nВойди своим логином и паролем.';
  }else if(command==='/help'){
   text='Настройка VPN для твоего устройства: '+CABINET+'#devices\nЕсли подключение не работает, напиши в поддержку: '+CABINET+'#support';
  }else if(command==='/notifications'){
   const row=this.linkedSubscription(id);
   text=!row||!row.account_enabled||row.must_change?BIND_HELP:row.notifications?'Напоминания включены: за 3 дня, за сутки и после окончания подписки. Для бессрочной подписки напоминаний нет.\n/stop — отключить уведомления и отвязать Telegram.\nНастройки: '+CABINET+'#settings':'Напоминания выключены. Подключить их снова можно в настройках: '+CABINET+'#settings';
  }else{
   text='Выбери действие кнопками меню: подписка, подключение, продление или помощь.\n'+CABINET;
  }
  if(text&&recent<10)this.reply(id,update.update_id,text);
 }
 const membership=update.my_chat_member;
 if(membership?.chat?.type==='private'&&membership.new_chat_member?.status==='kicked'){
  this.db.prepare('DELETE FROM telegram_challenges WHERE chat_id=?').run(String(membership.chat.id));
  const row=this.db.prepare('SELECT account_id FROM telegram_links WHERE chat_id=?').get(String(membership.chat.id));if(row)this.disconnectInternal(row.account_id);
 }
 this.db.prepare("INSERT INTO telegram_meta VALUES('offset',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(update.update_id+1);
 });}
 plan(){const now=this.clock();this.db.prepare('DELETE FROM telegram_challenges WHERE expires<=?').run(now);this.db.prepare("DELETE FROM telegram_outbox WHERE created_at<? AND state IN ('sent','canceled','blocked','uncertain')").run(now-90*DAY);
 const rows=this.db.prepare("SELECT s.*,l.chat_id,l.generation FROM managed_subscriptions s JOIN telegram_links l USING(account_id) JOIN identities i USING(account_id) WHERE l.enabled=1 AND i.enabled=1 AND i.must_change=0 AND s.unlimited=0 AND s.deleted=0 AND s.expires_at>0 AND s.sync_state='synced'").all();
 for(const row of rows){const left=row.expires_at-now;if(left>3*DAY||left<-7*DAY||left>0&&!row.enabled)continue;const stage=left<=0?'expired':left<=DAY?'1d':'3d';this.db.prepare('INSERT OR IGNORE INTO telegram_outbox(id,dedupe,account_id,chat_id,generation,expiry,stage,ready_at,created_at) VALUES(?,?,?,?,?,?,?,?,?)').run(randomUUID(),`${row.account_id}:${row.expires_at}:${stage}:${row.generation}`,row.account_id,row.chat_id,row.generation,row.expires_at,stage,now,now);}}
 next(){for(const job of this.db.prepare("SELECT * FROM telegram_outbox WHERE state='pending' AND ready_at<=? ORDER BY created_at,rowid LIMIT 100").all(this.clock())){
 if(job.account_id){const current=this.db.prepare('SELECT s.*,l.chat_id,l.enabled AS notifications,l.generation,i.enabled AS account_enabled FROM managed_subscriptions s JOIN telegram_links l USING(account_id) JOIN identities i USING(account_id) WHERE s.account_id=?').get(job.account_id);const left=job.expiry-this.clock();const stage=left<=0?'expired':left<=DAY?'1d':left<=3*DAY?'3d':null;
 if(!current||!current.account_enabled||!current.notifications||current.deleted||current.unlimited||current.sync_state!=='synced'||current.expires_at!==job.expiry||current.chat_id!==job.chat_id||current.generation!==job.generation||stage!==job.stage||left<-7*DAY||left>0&&!current.enabled){this.db.prepare("UPDATE telegram_outbox SET state='canceled' WHERE id=?").run(job.id);continue;}
 job.text=(job.stage==='expired'?'Подписка Family VPN закончилась.':job.stage==='1d'?'До окончания подписки Family VPN осталось меньше суток.':'Подписка Family VPN скоро закончится.')+'\nДата окончания: '+new Date(job.expiry).toISOString().replace('T',' ').slice(0,16)+' UTC.\nУправление подпиской: https://family-pie.ru/vpn/cabinet/\n/stop — отключить уведомления';}
 return job;}return null;}
 recover(){this.db.prepare("UPDATE telegram_outbox SET state='uncertain' WHERE state='sending'").run();}
}
export class TelegramApiError extends Error {constructor(code,retryAfter=0){super('Telegram request rejected');this.code=code;this.retryAfter=retryAfter;}}
export class TelegramClient {
 constructor(token,{request=fetch}={}){if(!/^\d{5,}:[A-Za-z0-9_-]{20,}$/.test(token))throw new Error('Invalid private Telegram credential');this.token=token;this.request=request;}
 async call(method,data={}){if(!['getMe','getWebhookInfo','getUpdates','sendMessage','setMyCommands','getMyCommands','setChatMenuButton','getChatMenuButton'].includes(method))throw new Error('Unsupported method');let r;try{r=await this.request(`https://api.telegram.org/bot${this.token}/${method}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),redirect:'error',signal:AbortSignal.timeout(30000)});}catch{throw new Error('Telegram delivery outcome unknown');}let x;try{x=await r.json();}catch{throw new Error('Telegram delivery outcome unknown');}if(!r.ok||x.ok!==true)throw new TelegramApiError(Number(x.error_code)||r.status,Number(x.parameters?.retry_after)||0);return x.result;}
}
export async function deliverOne(telegram,client){const job=telegram.next();if(!job)return false;const changed=telegram.db.prepare("UPDATE telegram_outbox SET state='sending' WHERE id=? AND state='pending'").run(job.id);if(!changed.changes)return false;try{await client.call('sendMessage',{chat_id:job.chat_id,text:job.text,reply_markup:botKeyboard,link_preview_options:{is_disabled:true}});telegram.db.prepare("UPDATE telegram_outbox SET state='sent' WHERE id=?").run(job.id);}catch(e){if(e instanceof TelegramApiError&&e.code===429)telegram.db.prepare("UPDATE telegram_outbox SET state='pending',ready_at=? WHERE id=?").run(telegram.clock()+Math.max(1000,Math.min(e.retryAfter*1000,3600000)),job.id);else{telegram.db.prepare('UPDATE telegram_outbox SET state=? WHERE id=?').run(e instanceof TelegramApiError&&e.code===403?'blocked':'uncertain',job.id);if(e instanceof TelegramApiError&&e.code===403&&job.account_id)telegram.db.prepare('UPDATE telegram_links SET enabled=0 WHERE account_id=?').run(job.account_id);}}return true;}
