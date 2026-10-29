import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {PasswordRecovery} from './recovery.mjs';
import {validateStarsPlans} from './telegram-pricing.mjs';
import {SUPPORT_EMAIL} from './support-contact.mjs';
const digest=value=>createHash('sha256').update(value).digest('hex');
const devices=new Set(['android','ios','windows','macos','linux','tv']);
const invalid=message=>{const e=new Error(message);e.code='INVALID_PAYMENT';throw e;};
const chat=value=>{const id=String(value);if(!/^[1-9][0-9]{0,15}$/.test(id)||!Number.isSafeInteger(Number(id)))invalid('Недопустимый личный чат');return id;};
const required=(ok,message='Не удалось проверить платёж')=>{if(!ok)invalid(message);};
// Bump the version whenever this purchase notice or the linked purchase terms change.
export const TELEGRAM_STARS_TERMS=Object.freeze({version:'2026-10-27.2',notice:'Платёж в Telegram Stars разовый. Автоматических списаний нет. Доступ появится после подтверждения оплаты. Помощь с оплатой и возвратом: /paysupport или '+SUPPORT_EMAIL+'.',termsPath:'/vpn/terms/',privacyPath:'/vpn/privacy/'});
const termsSnapshot=JSON.stringify(TELEGRAM_STARS_TERMS),termsHash=digest(termsSnapshot);

// Prices are explicit Stars amounts, never a conversion from the website RUB price.
export function loadTelegramStarsConfig(env=process.env){
 let plans=[];
 if(env.VPN_TELEGRAM_STARS_PLANS_FILE){const data=JSON.parse(readFileSync(env.VPN_TELEGRAM_STARS_PLANS_FILE,'utf8'));plans=Array.isArray(data)?data:data?.plans;if(!Array.isArray(plans))throw new Error('Invalid Stars plans');}
 return {enabled:env.VPN_TELEGRAM_STARS_ENABLED==='1',approved:env.VPN_TELEGRAM_STARS_APPROVED==='1',plans:validateStarsPlans(plans)};
}

// Only the one authenticated Telegram poller calls actor/payment methods. These are
// deliberately not HTTP endpoints accepting a client's claimed Telegram identity.
export class TelegramCommerce {
 constructor(store,{users,origin='https://family-spy.ru',stars={},clock=store.clock,recovery=null}={}){
  if(!users)throw new Error('Accounts required');
  const url=new URL(origin);if(url.origin!==origin||url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))throw new Error('HTTPS public origin required');
  this.store=store;this.db=store.db;this.users=users;this.clock=clock;this.origin=origin;
  this.starPlans=new Map(validateStarsPlans(stars.plans===undefined?[]:stars.plans).map(plan=>[plan.days,plan]));
  this.enabled=stars.enabled===true&&stars.approved===true&&this.starPlans.size>0;
  this.db.exec(`CREATE TABLE IF NOT EXISTS telegram_native_accounts(account_id TEXT PRIMARY KEY REFERENCES identities(account_id),registered_chat TEXT NOT NULL,terms_at INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS telegram_handoffs(token_hash TEXT PRIMARY KEY,account_id TEXT NOT NULL REFERENCES identities(account_id),chat_id TEXT NOT NULL,generation TEXT NOT NULL,purpose TEXT NOT NULL,device TEXT NOT NULL,expires INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS telegram_orders(order_id TEXT PRIMARY KEY REFERENCES orders(id),payload TEXT UNIQUE NOT NULL,chat_id TEXT NOT NULL,precheckout_id TEXT UNIQUE,expires INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS telegram_refunds(order_id TEXT PRIMARY KEY REFERENCES orders(id),state TEXT NOT NULL,requested_at INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS telegram_purchase_consents(token_hash TEXT PRIMARY KEY,account_id TEXT NOT NULL REFERENCES identities(account_id),chat_id TEXT NOT NULL,generation TEXT NOT NULL,request_key TEXT NOT NULL,days INTEGER NOT NULL,stars INTEGER NOT NULL,terms_version TEXT NOT NULL,terms_hash TEXT NOT NULL,terms_json TEXT NOT NULL,expires INTEGER NOT NULL,accepted_at INTEGER,order_id TEXT REFERENCES orders(id));
   CREATE INDEX IF NOT EXISTS telegram_purchase_order ON telegram_purchase_consents(order_id);
   CREATE INDEX IF NOT EXISTS telegram_purchase_pending ON telegram_purchase_consents(account_id,expires);`);
  this.recovery=recovery||new PasswordRecovery(store,users,{origin,clock});
 }
 recoveryHandoff(chatId){return this.recovery.issueTelegram(chatId);}
 transaction(fn){return this.db.isTransaction?fn():this.store.transaction(fn);}
 plans(){return {available:Boolean(this.enabled),plans:[...this.starPlans.values()]};}
 accountForChat(chatId){
  const id=chat(chatId),row=this.db.prepare('SELECT i.account_id,i.login,i.role,i.must_change,i.enabled FROM telegram_links l JOIN identities i USING(account_id) WHERE l.chat_id=?').get(id);
  return row?.enabled&&!row.must_change?row:null;
 }
 ensure(chatId,{acceptedTerms=false}={}){
  const id=chat(chatId);required(acceptedTerms===true,'Подтверди условия сервиса перед созданием аккаунта');
  return this.transaction(()=>{
   const linked=this.db.prepare('SELECT account_id FROM telegram_links WHERE chat_id=?').get(id);
   if(linked){const existing=this.accountForChat(id);required(existing,'Сначала восстанови вход в существующий аккаунт');return existing;}
   const identity=this.users.addTelegramInternal();
   this.db.prepare('INSERT INTO telegram_native_accounts(account_id,registered_chat,terms_at) VALUES(?,?,?)').run(identity.account_id,id,this.clock());
   this.db.prepare('INSERT INTO telegram_links(account_id,chat_id,enabled,generation,bound_at) VALUES(?,?,1,?,?)').run(identity.account_id,id,randomBytes(16).toString('hex'),this.clock());
   return identity;
  });
 }
 canUnlink(chatId){
  const identity=this.accountForChat(chatId);if(!identity)return false;
  return this.users.hasAlternativeAuth(identity.account_id,'telegram');
 }
 subscription(chatId){
  const identity=this.accountForChat(chatId);if(!identity)return null;
  const sub=this.users.subscription(identity.account_id);
  return {...sub,profile_url:sub.active&&sub.sync_state==='synced'?sub.profile_url:null};
 }
 handoff(chatId,{device='android',purpose='login'}={}){
  const id=chat(chatId),identity=this.accountForChat(id);required(identity,'Сначала подключи свой аккаунт');
  required(devices.has(device)&&['login','import'].includes(purpose),'Неизвестный способ подключения');
  if(purpose==='import'){const s=this.subscription(id);required(s?.active&&s.sync_state==='synced'&&s.profile_url,'Подключение пока не готово');}
  const link=this.db.prepare('SELECT generation FROM telegram_links WHERE account_id=? AND chat_id=?').get(identity.account_id,id),token=randomBytes(32).toString('base64url');
  this.transaction(()=>{
   this.db.prepare('DELETE FROM telegram_handoffs WHERE expires<=? OR (account_id=? AND purpose=?)').run(this.clock(),identity.account_id,purpose);
   this.db.prepare('INSERT INTO telegram_handoffs(token_hash,account_id,chat_id,generation,purpose,device,expires) VALUES(?,?,?,?,?,?,?)').run(digest(token),identity.account_id,id,link.generation,purpose,device,this.clock()+300000);
  });
  return this.origin+(purpose==='import'?'/vpn/connect/#token=':'/vpn/cabinet/auth/#telegram=')+token+'&device='+device;
 }
 handoffRecord(token,purpose,accountId=null){
  required(typeof token==='string'&&/^[A-Za-z0-9_-]{43}$/.test(token),'Ссылка недействительна или истекла. Открой новую в боте');
  const row=this.db.prepare('SELECT h.* FROM telegram_handoffs h JOIN telegram_links l ON l.account_id=h.account_id AND l.chat_id=h.chat_id AND l.generation=h.generation WHERE h.token_hash=? AND h.purpose=? AND h.expires>?').get(digest(token),purpose,this.clock());
  required(row&&this.accountForChat(row.chat_id)?.account_id===row.account_id,'Ссылка недействительна или истекла. Открой новую в боте');
  if(purpose==='login'&&accountId&&accountId!==row.account_id){const error=new Error('Сейчас открыт другой аккаунт. Выйди из него перед входом через Telegram');error.code='LOGIN_ACCOUNT_CONFLICT';throw error;}
  return row;
 }
 previewLogin(token,{accountId=null}={}){return this.transaction(()=>{const row=this.handoffRecord(token,'login',accountId);return {login:this.users.identity(row.account_id).login,device:row.device};});}
 consume(token,purpose,{accountId=null}={}){
  return this.transaction(()=>{
   const row=this.handoffRecord(token,purpose,accountId);
   if(purpose==='import'){
    const s=this.subscription(row.chat_id);required(s?.active&&s.sync_state==='synced'&&s.profile_url,'Подключение пока не готово. Открой новую ссылку в боте');
    this.db.prepare('DELETE FROM telegram_handoffs WHERE token_hash=?').run(digest(token));
    return {profileUrl:s.profile_url,device:row.device,expiresAt:s.expires_at};
   }
   required(purpose==='login');this.db.prepare('DELETE FROM telegram_handoffs WHERE token_hash=?').run(digest(token));
   return {...this.users.newSession(row.account_id,{method:'telegram'}),device:row.device};
  });
 }
 purchaseAccount(chatId,days,requestKey){
  const id=chat(chatId),identity=this.accountForChat(id),plan=this.starPlans.get(Number(days));
  required(this.enabled&&plan,'Покупка в Telegram пока недоступна');required(identity?.role==='user','Сначала создай или подключи пользовательский аккаунт');
  const sub=this.users.subscription(identity.account_id);required(!sub.deleted&&!sub.allow_unlimited,'Для этого аккаунта покупка недоступна');
  required(typeof requestKey==='string'&&requestKey.length>=8&&requestKey.length<=128,'Не удалось создать заказ');
  const link=this.db.prepare('SELECT generation FROM telegram_links WHERE account_id=? AND chat_id=?').get(identity.account_id,id);
  return {id,identity,plan,generation:link?.generation};
 }
 prunePurchaseOffers(){this.db.prepare('DELETE FROM telegram_purchase_consents WHERE order_id IS NULL AND expires<=?').run(this.clock());}
 preparePurchase(chatId,days,requestKey){
  return this.transaction(()=>{
   const {id,identity,plan,generation}=this.purchaseAccount(chatId,days,requestKey),old=this.db.prepare('SELECT * FROM orders WHERE account_id=? AND request_key=?').get(identity.account_id,requestKey);
   if(old)required(old.provider==='telegram-stars'&&old.currency==='XTR'&&old.days===Number(days)&&old.payment_actor===id&&old.state==='pending','Данные заказа уже сохранены');
   const binding=old&&this.db.prepare('SELECT expires FROM telegram_orders WHERE order_id=?').get(old.id);
   required(!old||binding?.expires>this.clock(),'Срок заказа истёк. Выбери тариф ещё раз');
   // Retain order-linked acceptance evidence; unused quotes expire without retaining chat data forever.
   this.prunePurchaseOffers();this.db.prepare('DELETE FROM telegram_purchase_consents WHERE order_id IS NULL AND account_id=? AND request_key=?').run(identity.account_id,requestKey);
   required(this.db.prepare('SELECT count(*) n FROM telegram_purchase_consents WHERE account_id=? AND order_id IS NULL').get(identity.account_id).n<5,'Сначала заверши выбранную покупку или попробуй через 10 минут');
   const token=randomBytes(24).toString('base64url');
   this.db.prepare('INSERT INTO telegram_purchase_consents(token_hash,account_id,chat_id,generation,request_key,days,stars,terms_version,terms_hash,terms_json,expires) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(digest(token),identity.account_id,id,generation,requestKey,plan.days,old?old.payment_amount:plan.stars,TELEGRAM_STARS_TERMS.version,termsHash,termsSnapshot,Math.min(this.clock()+600000,binding?.expires??Infinity));
   return this.purchaseTerms(id,token);
  });
 }
 purchaseRecord(chatId,token){
  required(typeof token==='string'&&/^[A-Za-z0-9_-]{32}$/.test(token),'Перед оплатой открой тариф и прими условия');
  const row=this.db.prepare('SELECT * FROM telegram_purchase_consents WHERE token_hash=?').get(digest(token));
  required(row,'Перед оплатой открой тариф и прими условия');
  const authority=this.purchaseAccount(chatId,row.days,row.request_key);
  required(row.account_id===authority.identity.account_id&&row.chat_id===authority.id&&row.generation===authority.generation,'Подтверди условия заново в своём аккаунте');
  required(row.terms_version===TELEGRAM_STARS_TERMS.version&&row.terms_hash===termsHash&&row.terms_json===termsSnapshot,'Условия изменились. Выбери тариф и подтверди их заново');
  const old=this.db.prepare('SELECT * FROM orders WHERE account_id=? AND request_key=?').get(row.account_id,row.request_key);
  if(old)required(old.provider==='telegram-stars'&&old.currency==='XTR'&&old.state==='pending'&&old.payment_actor===row.chat_id&&old.days===row.days&&old.payment_amount===row.stars&&(!row.order_id||row.order_id===old.id),'Данные заказа уже сохранены');
  else required(!row.order_id&&row.stars===authority.plan.stars,'Цена изменилась. Выбери тариф ещё раз');
  const binding=old&&this.db.prepare('SELECT expires FROM telegram_orders WHERE order_id=?').get(old.id);
  required(row.order_id?binding?.expires>this.clock():row.expires>this.clock(),'Подтверждение истекло. Выбери тариф ещё раз');
  return row;
 }
 purchaseTerms(chatId,token){
  const row=this.purchaseRecord(chatId,token);
  return {token,days:row.days,stars:row.stars,version:row.terms_version,notice:TELEGRAM_STARS_TERMS.notice,termsUrl:this.origin+TELEGRAM_STARS_TERMS.termsPath,privacyUrl:this.origin+TELEGRAM_STARS_TERMS.privacyPath,expiresAt:row.expires};
 }
 acceptPurchase(chatId,token){
  return this.transaction(()=>{const row=this.purchaseRecord(chatId,token);this.db.prepare('UPDATE telegram_purchase_consents SET accepted_at=COALESCE(accepted_at,?) WHERE token_hash=?').run(this.clock(),digest(token));return {days:row.days,requestKey:row.request_key,consentToken:token};});
 }
 invoice(chatId,days,requestKey,consentToken){
  const id=chat(chatId);
  const order=this.transaction(()=>{
   const {identity}=this.purchaseAccount(id,days,requestKey);
   const consent=this.purchaseRecord(id,consentToken);required(consent.accepted_at!==null&&consent.days===Number(days)&&consent.request_key===requestKey,'Перед оплатой прими условия выбранного тарифа');
   const old=this.db.prepare('SELECT * FROM orders WHERE account_id=? AND request_key=?').get(identity.account_id,requestKey);
   if(old){required(old.provider==='telegram-stars'&&old.currency==='XTR'&&old.days===Number(days)&&old.payment_actor===id&&old.payment_amount===consent.stars,'Данные заказа уже сохранены');this.db.prepare('UPDATE telegram_purchase_consents SET order_id=? WHERE token_hash=?').run(old.id,digest(consentToken));return old;}
   required(this.db.prepare("SELECT count(*) n FROM orders WHERE account_id=? AND provider='telegram-stars' AND state='pending' AND created_at>?").get(identity.account_id,this.clock()-3600000).n<5,'Сначала заверши предыдущий заказ');
   const orderId=randomUUID(),payload=randomBytes(24).toString('base64url');
   this.db.prepare("INSERT INTO orders(id,account_id,request_key,days,price_minor,payment_amount,devices,provider,currency,payment_actor,created_at) VALUES(?,?,?,?,0,?,0,'telegram-stars','XTR',?,?)").run(orderId,identity.account_id,requestKey,consent.days,consent.stars,id,this.clock());
   this.db.prepare('INSERT INTO telegram_orders(order_id,payload,chat_id,expires) VALUES(?,?,?,?)').run(orderId,payload,id,this.clock()+1800000);
   this.db.prepare('UPDATE telegram_purchase_consents SET order_id=? WHERE token_hash=? AND order_id IS NULL').run(orderId,digest(consentToken));
   return this.store.order(identity.account_id,orderId);
  });
  const binding=this.db.prepare('SELECT * FROM telegram_orders WHERE order_id=?').get(order.id);
  required(order.state==='pending'&&binding?.chat_id===id&&binding.expires>this.clock(),'Срок заказа истёк. Выбери тариф ещё раз');
  return {chat_id:Number(id),title:'Family VPN · '+order.days+' дней',description:'VPN-подписка на '+order.days+' дней. Без автоматических списаний.',payload:binding.payload,currency:'XTR',prices:[{label:order.days+' дней',amount:order.payment_amount}],start_parameter:'vpn_subscription'};
 }
 paymentOrder(actor,payment){
  const id=chat(actor);required(payment&&typeof payment.invoice_payload==='string'&&/^[A-Za-z0-9_-]{32}$/.test(payment.invoice_payload));
  const row=this.db.prepare('SELECT o.*,t.payload,t.chat_id,t.precheckout_id,t.expires FROM orders o JOIN telegram_orders t ON t.order_id=o.id WHERE t.payload=?').get(payment.invoice_payload);
  required(row&&row.provider==='telegram-stars'&&row.currency==='XTR'&&row.payment_actor===id&&row.chat_id===id&&payment.currency==='XTR'&&Number.isSafeInteger(payment.total_amount)&&payment.total_amount===row.payment_amount);
  return row;
 }
 preCheckout(query){
  const answer={pre_checkout_query_id:query?.id,ok:false};
  try{return this.transaction(()=>{
   required(typeof query?.id==='string'&&query.id.length>0&&query.id.length<=256&&query.from?.is_bot!==true);
   const order=this.paymentOrder(query.from?.id,query),identity=this.accountForChat(query.from.id),sub=identity&&this.users.subscription(identity.account_id);
   required(this.enabled&&identity?.account_id===order.account_id&&identity.role==='user'&&!sub.deleted&&!sub.allow_unlimited&&order.state==='pending'&&order.expires>this.clock(),'Заказ недоступен. Открой новый в боте');
   const link=this.db.prepare('SELECT generation FROM telegram_links WHERE account_id=? AND chat_id=?').get(order.account_id,String(query.from.id));
   required(this.db.prepare('SELECT 1 FROM telegram_purchase_consents WHERE order_id=? AND account_id=? AND chat_id=? AND generation=? AND days=? AND stars=? AND terms_version=? AND terms_hash=? AND terms_json=? AND accepted_at IS NOT NULL').get(order.id,order.account_id,String(query.from.id),link?.generation,order.days,order.payment_amount,TELEGRAM_STARS_TERMS.version,termsHash,termsSnapshot),'Перед оплатой выбери тариф и подтверди условия заново');
   required(!order.precheckout_id||order.precheckout_id===query.id,'Этот заказ уже проверяется. Не оплачивай его повторно');
   this.db.prepare('UPDATE telegram_orders SET precheckout_id=? WHERE order_id=?').run(query.id,order.id);
   return {...answer,ok:true};
  });}catch(e){if(e.code!=='INVALID_PAYMENT')throw e;return {...answer,error_message:e.message};}
 }
 privatePayment(message,field){
  required(message?.chat?.type==='private'&&message.from?.is_bot!==true&&String(message.from?.id)===String(message.chat.id));
  return this.paymentOrder(message.from.id,message[field]);
 }
 successfulPayment(message){
  return this.transaction(()=>{
   const order=this.privatePayment(message,'successful_payment'),payment=message.successful_payment,charge=payment.telegram_payment_charge_id;
   required(typeof charge==='string'&&charge.length>0&&charge.length<=512&&!payment.is_recurring&&!payment.is_first_recurring&&!payment.subscription_expiration_date&&order.precheckout_id,'Не удалось проверить оплату');
   const prior=this.db.prepare("SELECT id FROM orders WHERE provider='telegram-stars' AND provider_charge_id=?").get(charge);
   required(!prior||prior.id===order.id);required(!order.provider_charge_id||order.provider_charge_id===charge);
   const duplicate=['paid','refunded'].includes(order.state);required(duplicate||order.state==='pending');
   if(!duplicate){
    this.db.prepare("UPDATE orders SET provider_charge_id=?,state='paid' WHERE id=?").run(charge,order.id);
    this.db.prepare('INSERT INTO grants(order_id,account_id,granted_at) VALUES(?,?,?)').run(order.id,order.account_id,this.clock());
    this.store.enqueue(order.account_id);
   }
   return {accountId:order.account_id,orderId:order.id,subscription:this.store.subscription(order.account_id),duplicate};
  });
 }
 reverse(order,charge){
  required(order.provider==='telegram-stars'&&order.currency==='XTR'&&order.provider_charge_id===charge&&['paid','refunded'].includes(order.state));
  const duplicate=order.state==='refunded';
  if(!duplicate){this.db.prepare('UPDATE grants SET reversed=1 WHERE order_id=?').run(order.id);this.db.prepare("UPDATE orders SET state='refunded' WHERE id=?").run(order.id);this.store.enqueue(order.account_id);}
  this.db.prepare("INSERT INTO telegram_refunds VALUES(?,'confirmed',?) ON CONFLICT(order_id) DO UPDATE SET state='confirmed'").run(order.id,this.clock());
  return {accountId:order.account_id,orderId:order.id,subscription:this.store.subscription(order.account_id),duplicate};
 }
 refundedPayment(message){return this.transaction(()=>{const order=this.privatePayment(message,'refunded_payment');return this.reverse(order,message.refunded_payment.telegram_payment_charge_id);});}
 queueRefund(accountId,orderId){
  const order=this.store.order(accountId,orderId);required(order.provider==='telegram-stars'&&order.currency==='XTR'&&['paid','refunded'].includes(order.state));
  if(order.state==='refunded')return {state:'confirmed',alreadyRefunded:true};
  const old=this.db.prepare('SELECT state FROM telegram_refunds WHERE order_id=?').get(orderId);
  if(old)return {state:old.state};
  this.db.prepare("INSERT INTO telegram_refunds VALUES(?,'pending',?)").run(orderId,this.clock());
  return {state:'pending'};
 }
 recoverRefunds(){this.db.prepare("UPDATE telegram_refunds SET state='uncertain' WHERE state='sending'").run();}
 async deliverRefundOne(client){
  const job=this.db.prepare("SELECT order_id FROM telegram_refunds WHERE state='pending' ORDER BY requested_at LIMIT 1").get();
  if(!job)return false;
  const order=this.db.prepare('SELECT * FROM orders WHERE id=?').get(job.order_id);
  if(order?.state==='refunded'){this.db.prepare("UPDATE telegram_refunds SET state='confirmed' WHERE order_id=?").run(job.order_id);return true;}
  required(order?.provider==='telegram-stars'&&order.currency==='XTR'&&order.state==='paid'&&order.provider_charge_id);
  if(!this.db.prepare("UPDATE telegram_refunds SET state='sending' WHERE order_id=? AND state='pending'").run(order.id).changes)return false;
  let result;
  try{result=await client.call('refundStarPayment',{user_id:Number(order.payment_actor),telegram_payment_charge_id:order.provider_charge_id});}
  catch{this.db.prepare("UPDATE telegram_refunds SET state='uncertain' WHERE order_id=? AND state='sending'").run(order.id);return true;}
  if(result!==true){this.db.prepare("UPDATE telegram_refunds SET state='uncertain' WHERE order_id=? AND state='sending'").run(order.id);return true;}
  this.transaction(()=>this.reverse(this.store.order(order.account_id,order.id),order.provider_charge_id));return true;
 }
 async refund(accountId,orderId,client){
  const queued=this.queueRefund(accountId,orderId);if(queued.state==='pending')await this.deliverRefundOne(client);
  return this.db.prepare('SELECT state FROM telegram_refunds WHERE order_id=?').get(orderId)||queued;
 }
}
