import {randomUUID} from 'node:crypto';
import {SUPPORT_EMAIL,emailSupportText,supportEmailCopyButton} from './support-contact.mjs';

const DAY=86_400_000, MINUTE=60_000;
const positive=x=>Number.isSafeInteger(x)&&x>0;
const terminal=new Set(['sent','canceled','blocked','uncertain','failed']);
const knownCommands=new Set(['/start','/menu','/status','/subscription','/connect','/renew','/cabinet','/notifications','/email','/recover','/recovery']);
const menuText=new Set(['Моя подписка','Подключиться','Продлить','Личный кабинет','Уведомления','Меню']);
const intro='Напиши, что случилось. Можно приложить фото или скриншот. Ответ поддержки придёт сюда, вход в кабинет не нужен. Можно также обратиться по email.\n\n'+emailSupportText()+'\n/cancel — закончить обращение.';
const unavailable='Поддержка в Telegram сейчас недоступна.\n\n'+emailSupportText();
const operatorHelp='Чтобы ответить пользователю, нажми «Ответить» на сообщении его обращения или на заголовке с номером. /close в таком ответе закрывает обращение.';

/** Metadata-only relay. handle() runs inside TelegramStore.update's transaction. */
export class TelegramSupport {
 constructor(store,{operatorAccountId='',botId=0,clock=Date.now}={}) {
  this.store=store;this.db=store.db;this.operatorAccountId=operatorAccountId;this.botId=Number(botId);this.clock=clock;
  this.db.exec(`
   CREATE TABLE IF NOT EXISTS telegram_support_customers(chat_id TEXT PRIMARY KEY,product TEXT NOT NULL DEFAULT 'vpn',active INTEGER NOT NULL DEFAULT 1,blocked INTEGER NOT NULL DEFAULT 0,updated_at INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS telegram_support_tickets(id INTEGER PRIMARY KEY AUTOINCREMENT,chat_id TEXT NOT NULL,product TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'open',created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);
   CREATE UNIQUE INDEX IF NOT EXISTS telegram_support_open_product ON telegram_support_tickets(chat_id,product) WHERE state='open';
   DROP INDEX IF EXISTS telegram_support_open;
   CREATE TABLE IF NOT EXISTS telegram_support_receipts(update_id INTEGER PRIMARY KEY,chat_id TEXT NOT NULL,message_id INTEGER NOT NULL,kind TEXT NOT NULL,created_at INTEGER NOT NULL,UNIQUE(chat_id,message_id));
   CREATE TABLE IF NOT EXISTS telegram_support_outbox(id TEXT PRIMARY KEY,dedupe TEXT UNIQUE NOT NULL,ticket_id INTEGER REFERENCES telegram_support_tickets(id),direction TEXT NOT NULL,kind TEXT NOT NULL,chat_id TEXT NOT NULL,source_chat_id TEXT,source_message_id INTEGER,text TEXT,operator_chat_id TEXT,operator_generation TEXT,dependency_id TEXT,state TEXT NOT NULL DEFAULT 'pending',ready_at INTEGER NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,telegram_message_id INTEGER,error_code INTEGER);
   CREATE INDEX IF NOT EXISTS telegram_support_pending ON telegram_support_outbox(state,ready_at);
   CREATE TABLE IF NOT EXISTS telegram_support_messages(chat_id TEXT NOT NULL,message_id INTEGER NOT NULL,ticket_id INTEGER NOT NULL REFERENCES telegram_support_tickets(id),created_at INTEGER NOT NULL,PRIMARY KEY(chat_id,message_id));
  `);
 }
 operator() {
  if(!this.operatorAccountId||!positive(this.botId))return null;
  const row=this.db.prepare("SELECT l.chat_id,l.generation FROM telegram_links l JOIN identities i USING(account_id) WHERE i.account_id=? AND i.role='admin' AND i.enabled=1 AND i.must_change=0 AND l.enabled=1").get(this.operatorAccountId);
  return row&&positive(Number(row.chat_id))?row:null;
 }
 enqueue({dedupe,ticketId=null,direction='notice_customer',kind='text',chatId,sourceChatId=null,sourceMessageId=null,text=null,operator=null,dependencyId=null}) {
  const id=randomUUID(),now=this.clock();
  // Reserve ample space for failure notices while bounding even unauthenticated command floods.
  if(this.db.prepare("SELECT count(*) n FROM telegram_support_outbox WHERE state IN ('pending','sending')").get().n>=1000)return null;
  this.db.prepare('INSERT OR IGNORE INTO telegram_support_outbox(id,dedupe,ticket_id,direction,kind,chat_id,source_chat_id,source_message_id,text,operator_chat_id,operator_generation,dependency_id,ready_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,dedupe,ticketId,direction,kind,String(chatId),sourceChatId===null?null:String(sourceChatId),sourceMessageId,text,operator?.chat_id||null,operator?.generation||null,dependencyId,now,now,now);
  return this.db.prepare('SELECT id FROM telegram_support_outbox WHERE dedupe=?').get(dedupe).id;
 }
 notice(chatId,key,text,{operator=null,ticketId=null}={}) {
  return this.enqueue({chatId,dedupe:key,text,ticketId,operator,direction:operator?'notice_operator':'notice_customer'});
 }
 receipt(update,msg,kind) {
  return Boolean(this.db.prepare('INSERT OR IGNORE INTO telegram_support_receipts VALUES(?,?,?,?,?)').run(update.update_id,String(msg.chat.id),msg.message_id,kind,this.clock()).changes);
 }
 ticket(chatId,product) {
  let row=this.db.prepare("SELECT * FROM telegram_support_tickets WHERE chat_id=? AND product=? AND state='open'").get(chatId,product);
  if(!row){const result=this.db.prepare('INSERT INTO telegram_support_tickets(chat_id,product,created_at,updated_at) VALUES(?,?,?,?)').run(chatId,product,this.clock(),this.clock());row=this.db.prepare('SELECT * FROM telegram_support_tickets WHERE id=?').get(result.lastInsertRowid);}
  this.db.prepare('UPDATE telegram_support_tickets SET updated_at=? WHERE id=?').run(this.clock(),row.id);return row;
 }
 activate(chatId,product='vpn') {
  this.db.prepare('INSERT INTO telegram_support_customers VALUES(?,?,1,0,?) ON CONFLICT(chat_id) DO UPDATE SET product=excluded.product,active=1,blocked=0,updated_at=excluded.updated_at').run(chatId,product,this.clock());
 }
 cancel(chatId) {
  this.db.prepare("UPDATE telegram_support_outbox SET state='canceled',updated_at=? WHERE state='pending' AND (chat_id=? OR source_chat_id=? OR ticket_id IN (SELECT id FROM telegram_support_tickets WHERE chat_id=?))").run(this.clock(),chatId,chatId,chatId);
  this.db.prepare("UPDATE telegram_support_tickets SET state='closed',updated_at=? WHERE chat_id=? AND state='open'").run(this.clock(),chatId);
  this.db.prepare('UPDATE telegram_support_customers SET active=0,updated_at=? WHERE chat_id=?').run(this.clock(),chatId);
 }
 closeTicket(ticketId) {
  this.db.prepare("UPDATE telegram_support_outbox SET state='canceled',updated_at=? WHERE state='pending' AND ticket_id=?").run(this.clock(),ticketId);
  this.db.prepare("UPDATE telegram_support_tickets SET state='closed',updated_at=? WHERE id=?").run(this.clock(),ticketId);
 }
 limited(chatId) {
  return this.db.prepare('SELECT count(*) n FROM telegram_support_receipts WHERE chat_id=? AND created_at>?').get(chatId,this.clock()-MINUTE).n>10
   ||this.db.prepare("SELECT count(*) n FROM telegram_support_outbox WHERE source_chat_id=? AND kind='copy' AND state IN ('pending','sending')").get(chatId).n>=30
   ||this.db.prepare("SELECT count(*) n FROM telegram_support_outbox WHERE state IN ('pending','sending')").get().n>=500;
 }
 handle(update) {
  const membership=update?.my_chat_member;
  if(membership?.chat?.type==='private'&&positive(membership.chat.id)&&membership.new_chat_member?.status==='kicked'){
   const chatId=String(membership.chat.id);this.cancel(chatId);this.db.prepare('UPDATE telegram_support_customers SET blocked=1 WHERE chat_id=?').run(chatId);return false;
  }
  const msg=update?.message,chat=msg?.chat,from=msg?.from;
  if(!positive(update?.update_id)&&update?.update_id!==0)return false;
  if(chat?.type!=='private'||!positive(chat.id)||from?.id!==chat.id||from.is_bot||!positive(msg.message_id))return false;
  const chatId=String(chat.id),raw=typeof msg.text==='string'?msg.text.trim():'',command=raw.split(/\s+/)[0].split('@')[0];
  if(command==='/stop'){this.cancel(chatId);return false;}
  const payload=raw.split(/\s+/)[1],starts=command==='/start'&&['support','support_vpn','support_sufler'].includes(payload);
  const help=command==='/help'||raw==='Помощь';
  if((knownCommands.has(command)&&!starts)||menuText.has(raw))return false;
  const operator=this.operator(),candidate=this.operatorAccountId?this.db.prepare('SELECT chat_id FROM telegram_links WHERE account_id=?').get(this.operatorAccountId):null;
  const mapped=positive(msg.reply_to_message?.message_id)?this.db.prepare('SELECT ticket_id FROM telegram_support_messages WHERE chat_id=? AND message_id=?').get(chatId,msg.reply_to_message.message_id):null;
  const isOperator=operator?.chat_id===chatId;
  // A stale operator reply must never become a new customer ticket after revocation/rebinding.
  if(isOperator||candidate?.chat_id===chatId||mapped){
   if(!this.receipt(update,msg,'message'))return true;
   if(!isOperator){this.notice(chatId,'operator-denied:'+update.update_id,'Доступ к ответам поддержки отключён. Проверь привязку Telegram в настройках кабинета.');return true;}
   if(!mapped||msg.reply_to_message?.from?.id!==this.botId||msg.reply_to_message?.from?.is_bot!==true){this.notice(chatId,'operator-help:'+chatId+':'+Math.floor(this.clock()/MINUTE),operatorHelp,{operator});return true;}
   const ticket=this.db.prepare('SELECT * FROM telegram_support_tickets WHERE id=?').get(mapped.ticket_id);
   const customer=ticket&&this.db.prepare('SELECT * FROM telegram_support_customers WHERE chat_id=?').get(ticket.chat_id);
   if(!ticket||ticket.state!=='open'||!customer?.active||customer.blocked){this.notice(chatId,'closed-reply:'+update.update_id,'Обращение закрыто или пользователь остановил бота. Ответ не отправлен.',{operator});return true;}
   if(command==='/close'||command==='/cancel'){
    this.closeTicket(ticket.id);this.notice(chatId,'operator-close:'+update.update_id,`Обращение #${ticket.id} закрыто.`,{operator,ticketId:ticket.id});this.notice(ticket.chat_id,'customer-close:'+update.update_id,`Обращение #${ticket.id} закрыто. Если понадобится помощь, напиши снова.`,{ticketId:ticket.id});return true;
   }
   if(!this.supported(msg)||raw.startsWith('/')){this.notice(chatId,'operator-format:'+update.update_id,'Ответ не отправлен. Пришли текст, фото или изображение файлом, ответив на сообщение обращения.',{operator});return true;}
   if(this.limited(chatId)){this.notice(chatId,'operator-limit:'+chatId+':'+Math.floor(this.clock()/MINUTE),'Слишком много сообщений. Подожди минуту и отправь ответ снова.',{operator});return true;}
   this.enqueue({dedupe:'reply:'+chatId+':'+msg.message_id,ticketId:ticket.id,direction:'customer',kind:'copy',chatId:ticket.chat_id,sourceChatId:chatId,sourceMessageId:msg.message_id,operator});return true;
  }
  if(!this.receipt(update,msg,starts||help?'help':'message'))return true;
  if(command==='/close'||command==='/cancel'){
   this.cancel(chatId);this.notice(chatId,'cancel:'+update.update_id,'Обращение закрыто. Если понадобится помощь, напиши снова.');return true;
  }
  if(!operator){this.notice(chatId,'unavailable:'+chatId+':'+Math.floor(this.clock()/MINUTE),unavailable);return true;}
  if(this.limited(chatId)){this.notice(chatId,'limit:'+chatId+':'+Math.floor(this.clock()/MINUTE),'Слишком много сообщений в очереди. Подожди минуту и отправь сообщение снова.');return true;}
  if(starts||help){const current=this.db.prepare('SELECT product FROM telegram_support_customers WHERE chat_id=?').get(chatId);this.activate(chatId,starts?(payload==='support_sufler'?'sufler':'vpn'):current?.product||'vpn');this.notice(chatId,'intro:'+update.update_id,intro);return true;}
  if(!this.supported(msg)||raw.startsWith('/')){this.notice(chatId,'format:'+chatId+':'+Math.floor(this.clock()/MINUTE),'Пришли текст, фото или скриншот. Для обращения к поддержке: /help. Видео, голосовые сообщения и другие файлы пока не принимаются.');return true;}
  const old=this.db.prepare('SELECT product FROM telegram_support_customers WHERE chat_id=?').get(chatId);this.activate(chatId,old?.product||'vpn');
  const ticket=this.ticket(chatId,old?.product||'vpn');
  this.notice(chatId,'accepted:'+chatId+':'+msg.message_id,`Сообщение по обращению #${ticket.id} принято в очередь. Ответ придёт сюда.`,{ticketId:ticket.id});
  const header=this.enqueue({dedupe:'header:'+chatId+':'+msg.message_id,ticketId:ticket.id,direction:'operator',chatId:operator.chat_id,operator,text:`Обращение #${ticket.id} · ${ticket.product==='sufler'?'Sufler':'Family VPN'}\nОтветь на это сообщение или на сообщение пользователя.`});
  this.enqueue({dedupe:'message:'+chatId+':'+msg.message_id,ticketId:ticket.id,direction:'operator',kind:'copy',chatId:operator.chat_id,sourceChatId:chatId,sourceMessageId:msg.message_id,operator,dependencyId:header});return true;
 }
 supported(msg){return typeof msg.text==='string'&&msg.text.trim().length>0||Array.isArray(msg.photo)&&msg.photo.length>0||typeof msg.document?.mime_type==='string'&&/^image\/(?:png|jpeg|webp|gif|heic|heif|bmp|tiff)$/i.test(msg.document.mime_type);}
 valid(job) {
  if(job.created_at<this.clock()-DAY)return false;
  if(job.operator_generation){const op=this.operator();if(!op||op.chat_id!==job.operator_chat_id||op.generation!==job.operator_generation)return false;}
  if(job.direction==='operator'||job.direction==='customer'){
   const row=this.db.prepare('SELECT t.state,c.active,c.blocked FROM telegram_support_tickets t JOIN telegram_support_customers c ON c.chat_id=t.chat_id WHERE t.id=?').get(job.ticket_id);
   if(!row||row.state!=='open'||!row.active||row.blocked)return false;
  }
  return true;
 }
 failure(job,state,code=null) {
  this.db.prepare('UPDATE telegram_support_outbox SET state=?,error_code=?,updated_at=? WHERE id=?').run(state,code,this.clock(),job.id);
  if(job.direction==='operator'){
   const ticket=this.db.prepare('SELECT chat_id FROM telegram_support_tickets WHERE id=?').get(job.ticket_id);
   if(ticket)this.notice(ticket.chat_id,'failure:'+job.id,`Не удалось ${state==='uncertain'?'подтвердить доставку':'доставить сообщение'} по обращению #${job.ticket_id}. Сообщение автоматически не отправится повторно. Напиши ещё раз или на ${SUPPORT_EMAIL}.`,{ticketId:job.ticket_id});
  }else if(job.direction==='customer'){
   const op=this.operator();if(op&&op.chat_id===job.operator_chat_id&&op.generation===job.operator_generation)this.notice(op.chat_id,'failure:'+job.id,`Ответ по обращению #${job.ticket_id} ${state==='uncertain'?'мог быть доставлен, но подтверждения нет. Автоматического повтора не будет':'не доставлен'}.`,{operator:op,ticketId:job.ticket_id});
  }
 }
 next() {
  let changed=false;
  for(const job of this.db.prepare("SELECT * FROM telegram_support_outbox WHERE state='pending' AND ready_at<=? ORDER BY created_at,rowid LIMIT 1000").all(this.clock())){
   if(job.dependency_id){const parent=this.db.prepare('SELECT state FROM telegram_support_outbox WHERE id=?').get(job.dependency_id);if(parent?.state!=='sent'){if(!parent||terminal.has(parent.state))this.db.prepare("UPDATE telegram_support_outbox SET state='canceled',updated_at=? WHERE id=?").run(this.clock(),job.id);continue;}}
   if(!this.valid(job)){this.failure(job,'canceled');changed=true;continue;}
   return job;
  }return changed?this.next():null;
 }
 claim(job){return this.store.transaction(()=>{if(!this.valid(job)){this.failure(job,'canceled');return false;}return Boolean(this.db.prepare("UPDATE telegram_support_outbox SET state='sending',updated_at=? WHERE id=? AND state='pending'").run(this.clock(),job.id).changes);});}
 sent(job,messageId) {
  this.store.transaction(()=>{
   if(!positive(messageId)){this.failure(job,'uncertain');return;}
   const changed=this.db.prepare("UPDATE telegram_support_outbox SET state='sent',telegram_message_id=?,updated_at=? WHERE id=? AND state='sending'").run(messageId,this.clock(),job.id);if(!changed.changes)return;
   if(job.direction==='operator')this.db.prepare('INSERT OR IGNORE INTO telegram_support_messages VALUES(?,?,?,?)').run(job.chat_id,messageId,job.ticket_id,this.clock());
   if(job.kind==='copy'&&job.direction==='operator'){
    const ticket=this.db.prepare('SELECT chat_id FROM telegram_support_tickets WHERE id=?').get(job.ticket_id);
    this.notice(ticket.chat_id,'delivered:'+job.id,`Сообщение по обращению #${job.ticket_id} доставлено в поддержку. Ответ придёт сюда.`,{ticketId:job.ticket_id});
   }else if(job.kind==='copy'&&job.direction==='customer'){
    const op=this.operator();if(op&&op.chat_id===job.operator_chat_id&&op.generation===job.operator_generation)this.notice(op.chat_id,'delivered:'+job.id,`Ответ по обращению #${job.ticket_id} доставлен.`,{operator:op,ticketId:job.ticket_id});
   }
  });
 }
 failed(job,error) {
  this.store.transaction(()=>{
   if(error?.code===429){this.db.prepare("UPDATE telegram_support_outbox SET state='pending',ready_at=?,updated_at=? WHERE id=? AND state='sending'").run(this.clock()+Math.max(1000,Math.min((Number(error.retryAfter)||1)*1000,3_600_000)),this.clock(),job.id);return;}
   const rejected=Number.isInteger(error?.code),state=error?.code===403?'blocked':rejected?'failed':'uncertain';
   if(state==='blocked'&&(job.direction==='customer'||job.direction==='notice_customer')){this.cancel(job.chat_id);this.db.prepare('UPDATE telegram_support_customers SET blocked=1 WHERE chat_id=?').run(job.chat_id);}
   this.failure(job,state,rejected?error.code:null);
   if(state==='blocked'&&(job.direction==='operator'||job.direction==='notice_operator'))this.db.prepare('UPDATE telegram_links SET enabled=0 WHERE account_id=? AND chat_id=? AND generation=?').run(this.operatorAccountId,job.operator_chat_id,job.operator_generation);
  });
 }
 recover() {
  this.store.transaction(()=>{for(const job of this.db.prepare("SELECT * FROM telegram_support_outbox WHERE state='sending'").all())this.failure(job,'uncertain');});
 }
 plan() {
  const cutoff=this.clock()-90*DAY;
  this.db.prepare('DELETE FROM telegram_support_messages WHERE created_at<?').run(cutoff);
  this.db.prepare('DELETE FROM telegram_support_receipts WHERE created_at<?').run(cutoff);
  this.db.prepare("DELETE FROM telegram_support_outbox WHERE updated_at<? AND state NOT IN ('pending','sending')").run(cutoff);
  this.db.prepare('DELETE FROM telegram_support_tickets WHERE updated_at<? AND NOT EXISTS(SELECT 1 FROM telegram_support_messages m WHERE m.ticket_id=telegram_support_tickets.id) AND NOT EXISTS(SELECT 1 FROM telegram_support_outbox o WHERE o.ticket_id=telegram_support_tickets.id)').run(cutoff);
  this.db.prepare('DELETE FROM telegram_support_customers WHERE updated_at<? AND NOT EXISTS(SELECT 1 FROM telegram_support_tickets t WHERE t.chat_id=telegram_support_customers.chat_id)').run(cutoff);
 }
}

export async function deliverSupportOne(support,client) {
 const job=support.next();if(!job||!support.claim(job))return false;
 try {
  const data=job.kind==='copy'?{chat_id:job.chat_id,from_chat_id:job.source_chat_id,message_id:job.source_message_id}:{chat_id:job.chat_id,text:job.text,link_preview_options:{is_disabled:true}};
  if(job.kind!=='copy'&&job.direction==='notice_customer'&&job.text?.includes(SUPPORT_EMAIL))data.reply_markup={inline_keyboard:[[supportEmailCopyButton()]]};
  const result=await client.call(job.kind==='copy'?'copyMessage':'sendMessage',data);
  support.sent(job,result?.message_id);
 }catch(error){support.failed(job,error);}
 return true;
}
