import {createHash, randomBytes, randomUUID} from 'node:crypto';
import QRCode from 'qrcode';
import {SUPPORT_EMAIL,emailSupportText,supportEmailCopyButton} from './support-contact.mjs';

const MINUTE = 60_000, DAY = 86_400_000;
const digest = value => createHash('sha256').update(value).digest('hex');
const html = value => String(value).replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const positive = value => Number.isSafeInteger(value) && value > 0;
const date = value => new Intl.DateTimeFormat('ru-RU', {timeZone:'UTC',dateStyle:'long'}).format(value).replace(/\.$/,'');
const commandFor = new Map([
 ['Подключиться','/connect'], ['Моя подписка','/status'], ['Продлить','/renew'],
 ['Купить / продлить','/renew'], ['Помощь','/help'], ['Меню','/menu'],
 ['Уведомления','/notifications'], ['Личный кабинет','/cabinet']
]);
const commands = new Set(['/start','/menu','/status','/subscription','/connect','/renew','/plans',
 '/notifications','/stop','/disconnect','/cabinet','/terms','/privacy','/paysupport']);
export const nativeBotCommands = [
 {command:'menu',description:'Меню Family VPN'},
 {command:'connect',description:'Подключиться на устройстве'},
 {command:'status',description:'Моя подписка'},
 {command:'renew',description:'Купить или продлить'},
 {command:'help',description:'Написать в поддержку'},
 {command:'notifications',description:'Напоминания и привязка'},
 {command:'stop',description:'Выключить напоминания'},
 {command:'paysupport',description:'Помощь с оплатой'},
 {command:'terms',description:'Условия сервиса'}
];
export const botBranding = Object.freeze({
 name:'Family VPN', shortDescription:'Подключение, подписка и помощь в одном месте.',
 description:'Family VPN от Family Spy. Подключай устройства, проверяй подписку и пиши в поддержку прямо здесь.'
});

// Match the existing, supported device guides. Third-party app names appear only at installation/import.
export const botDevices = Object.freeze({
 ios:{title:'iPhone / iPad',install:[['App Store','https://apps.apple.com/us/app/happ-proxy-utility/id6504287215']]},
 android:{title:'Android',install:[['Google Play','https://play.google.com/store/apps/details?id=com.happproxy'],['Официальный APK','https://github.com/Happ-proxy/happ-android/releases/latest/download/Happ.apk']]},
 windows:{title:'Windows',install:[['Windows x64','https://github.com/Happ-proxy/happ-desktop/releases/latest/download/setup-Happ.x64.exe'],['Windows ARM64','https://github.com/Happ-proxy/happ-desktop/releases/latest/download/setup-Happ.arm64.exe']]},
 macos:{title:'Mac',install:[['Скачать для Mac','https://github.com/Happ-proxy/happ-desktop/releases/latest/download/Happ.macOS.universal.dmg']]},
 linux:{title:'Linux',install:[['Linux DEB · x64','https://github.com/Happ-proxy/happ-desktop/releases/latest/download/Happ.linux.x64.deb'],['Linux RPM · x64','https://github.com/Happ-proxy/happ-desktop/releases/latest/download/Happ.linux.x64.rpm']]},
 tv:{title:'Smart TV',install:[['Android TV','https://play.google.com/store/apps/details?id=com.happproxy'],['Apple TV','https://apps.apple.com/us/app/happ-proxy-utility-for-tv/id6748297274']]}
});

/** Private-chat UI. Persist intents, never personal subscription URLs or auth handoffs. */
export class TelegramUI {
 constructor(telegram,{commerce,enabled=false,clock=telegram.clock,origin='https://family-spy.ru'}={}) {
  this.telegram=telegram;this.store=telegram.store;this.db=telegram.db;this.commerce=commerce;
  this.enabled=enabled;this.clock=clock;this.origin=new URL(origin).origin;
  if(!/^https:\/\//.test(this.origin))throw new Error('HTTPS bot origin required');
  this.db.exec(`
   CREATE TABLE IF NOT EXISTS telegram_ui_state(chat_id TEXT PRIMARY KEY,mode TEXT NOT NULL DEFAULT 'menu',blocked INTEGER NOT NULL DEFAULT 0,updated_at INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS telegram_ui_callbacks(token_hash TEXT PRIMARY KEY,chat_id TEXT NOT NULL,scope TEXT NOT NULL,action TEXT NOT NULL,data TEXT NOT NULL,expires INTEGER NOT NULL,used INTEGER NOT NULL DEFAULT 0);
   CREATE TABLE IF NOT EXISTS telegram_ui_outbox(id TEXT PRIMARY KEY,dedupe TEXT UNIQUE NOT NULL,chat_id TEXT NOT NULL,scope TEXT NOT NULL,view TEXT NOT NULL,payload TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'pending',ready_at INTEGER NOT NULL,created_at INTEGER NOT NULL);
   CREATE INDEX IF NOT EXISTS telegram_ui_pending ON telegram_ui_outbox(state,ready_at);
  `);
 }
 authority(chatId) {
  const identity=this.commerce.accountForChat(chatId);
  if(!identity)return {identity:null,scope:'guest'};
  const link=this.db.prepare('SELECT generation FROM telegram_links WHERE account_id=? AND chat_id=?').get(identity.account_id,chatId);
  return link?{identity,scope:identity.account_id+':'+link.generation}:{identity:null,scope:'guest'};
 }
 mode(chatId,mode='menu') {
  this.db.prepare('INSERT INTO telegram_ui_state(chat_id,mode,updated_at) VALUES(?,?,?) ON CONFLICT(chat_id) DO UPDATE SET mode=excluded.mode,blocked=0,updated_at=excluded.updated_at').run(chatId,mode,this.clock());
 }
 queue(chatId,key,view,payload={}) {
  if(this.db.prepare("SELECT count(*) n FROM telegram_ui_outbox WHERE state IN ('pending','sending')").get().n>=500)return false;
  if(!['precheckout','callback_answer'].includes(view)&&this.db.prepare('SELECT count(*) n FROM telegram_ui_outbox WHERE chat_id=? AND created_at>?').get(String(chatId),this.clock()-MINUTE).n>=20)return false;
  this.db.prepare('INSERT OR IGNORE INTO telegram_ui_outbox(id,dedupe,chat_id,scope,view,payload,ready_at,created_at) VALUES(?,?,?,?,?,?,?,?)')
   .run(randomUUID(),key,String(chatId),this.authority(String(chatId)).scope,view,JSON.stringify(payload),this.clock(),this.clock());
  return true;
 }
 button(chatId,text,action,data={}) {
  const token=randomBytes(18).toString('base64url');
  this.db.prepare('INSERT INTO telegram_ui_callbacks VALUES(?,?,?,?,?,?,0)').run(digest(token),chatId,this.authority(chatId).scope,action,JSON.stringify(data),this.clock()+10*MINUTE);
  return {text,callback_data:'u_'+token};
 }
 cancel(chatId,{keepControl=false}={}) {
  this.db.prepare("UPDATE telegram_ui_outbox SET state='canceled' WHERE chat_id=? AND state='pending'"+(keepControl?" AND view NOT IN ('callback_answer','precheckout')":"")).run(chatId);
  this.db.prepare('DELETE FROM telegram_ui_callbacks WHERE chat_id=?').run(chatId);
 }
 mute(chatId,enabled) {
  const {identity}=this.authority(chatId);if(!identity)return;
  this.db.prepare('UPDATE telegram_links SET enabled=? WHERE account_id=? AND chat_id=?').run(Number(enabled),identity.account_id,chatId);
  if(!enabled)this.db.prepare("UPDATE telegram_outbox SET state='canceled' WHERE account_id=? AND state='pending'").run(identity.account_id);
 }
 nativeAccount(chatId) {
  return this.db.prepare('SELECT 1 FROM telegram_native_accounts n JOIN telegram_links l USING(account_id) WHERE l.chat_id=?').get(chatId);
 }
 handle(update) {
  const membership=update.my_chat_member;
  if(membership?.chat?.type==='private'&&positive(membership.chat.id)&&membership.new_chat_member?.status==='kicked') {
   const blockedChat=String(membership.chat.id);
   if(!this.enabled&&!this.nativeAccount(blockedChat)&&!(this.authority(blockedChat).identity&&!this.commerce.canUnlink(blockedChat)))return false;
   const chatId=String(membership.chat.id);this.cancel(chatId);this.mute(chatId,false);
   this.telegram.support?.cancel(chatId);this.mode(chatId);this.db.prepare('UPDATE telegram_ui_state SET blocked=1 WHERE chat_id=?').run(chatId);
   this.db.prepare('DELETE FROM telegram_challenges WHERE chat_id=?').run(chatId);
   return true; // Blocking notifications must not destroy a Telegram-only login identity.
  }
  if(update.pre_checkout_query) {
   const answer=this.commerce.preCheckout(update.pre_checkout_query);
   if(positive(update.pre_checkout_query.from?.id))this.queue(String(update.pre_checkout_query.from.id),'precheckout:'+update.pre_checkout_query.id,'precheckout',answer);
   return true;
  }
  if(update.callback_query)return this.enabled?this.callback(update):false;
  const msg=update.message;
  if(msg?.chat?.type!=='private'||!positive(msg.chat.id)||msg.from?.id!==msg.chat.id||msg.from.is_bot)return false;
  const chatId=String(msg.chat.id),key='ui:'+update.update_id;
  if(msg.successful_payment||msg.refunded_payment) {
   try {
    const result=msg.successful_payment?this.commerce.successfulPayment(msg):this.commerce.refundedPayment(msg);
    this.mode(chatId);this.queue(chatId,key,this.enabled?(msg.successful_payment?'paid':'refunded'):'financial_receipt',{duplicate:Boolean(result.duplicate),refunded:Boolean(msg.refunded_payment)});
   }catch(error){if(error.code!=='INVALID_PAYMENT')throw error;this.queue(chatId,key,this.enabled?'payment_invalid':'financial_receipt',{invalid:true});}
   return true;
  }
  if(!this.enabled) {
   const legacyCommand=typeof msg.text==='string'?(commandFor.get(msg.text.trim())||msg.text.trim().split(/\s+/)[0].split('@')[0]):'';
   const linked=this.authority(chatId).identity;
   if(!this.nativeAccount(chatId)&&!(linked&&(legacyCommand==='/cabinet'||legacyCommand==='/stop'&&!this.commerce.canUnlink(chatId))))return false;
   if(legacyCommand==='/stop')this.mute(chatId,false);
   this.mode(chatId);this.queue(chatId,key,'financial_receipt',{recovery:true});return true;
  }
  const raw=typeof msg.text==='string'?msg.text.trim():'',command=commandFor.get(raw)||raw.split(/\s+/)[0].split('@')[0],payload=raw.split(/\s+/)[1];
  // Operator replies remain owned by the support router even after using the native menu.
  if(this.telegram.support&&!commands.has(command)) {
   const operator=this.telegram.support.operator();
   const mapped=positive(msg.reply_to_message?.message_id)&&this.db.prepare('SELECT 1 FROM telegram_support_messages WHERE chat_id=? AND message_id=?').get(chatId,msg.reply_to_message.message_id);
   if(operator?.chat_id===chatId||mapped)return false;
  }
  if(typeof msg.text!=='string') {
   if(this.db.prepare('SELECT mode FROM telegram_ui_state WHERE chat_id=?').get(chatId)?.mode==='menu'){this.queue(chatId,key,'input_help');return true;}
   return false;
  }
  if(command==='/help'||command==='/support'||command==='/paysupport'||command==='/start'&&['support','support_vpn','support_sufler'].includes(payload)) {
   this.mode(chatId,'support');
   if(command==='/paysupport')this.telegram.support?.activate(chatId,'vpn');
   if(this.telegram.support&&command!=='/paysupport')return false;
   this.queue(chatId,key,'help');return true;
  }
  if(!commands.has(command)) {
   if(this.db.prepare('SELECT mode FROM telegram_ui_state WHERE chat_id=?').get(chatId)?.mode==='menu'){this.queue(chatId,key,'input_help');return true;}
   return false;
  }
  const first=!this.db.prepare('SELECT 1 FROM telegram_ui_state WHERE chat_id=?').get(chatId);
  this.mode(chatId);
  if(first&&this.db.prepare("SELECT 1 FROM telegram_outbox WHERE chat_id=? AND state='sent'").get(chatId))this.queue(chatId,key+':keyboard','keyboard_reset');
  if(command==='/start'&&payload?.startsWith('bind_')) {
   const ok=this.telegram.candidateInternal(payload.slice(5),chatId,typeof msg.from.username==='string'&&/^[A-Za-z0-9_]{1,32}$/.test(msg.from.username)?'@'+msg.from.username:null);
   this.queue(chatId,key,'binding',{ok});return true;
  }
  if(command==='/stop'){this.mute(chatId,false);this.queue(chatId,key,'settings',{muted:true});return true;}
  const view=({'/status':'subscription','/subscription':'subscription','/connect':'devices','/renew':'plans','/plans':'plans','/notifications':'settings','/disconnect':'unlink','/cabinet':'cabinet','/terms':'terms','/privacy':'terms'})[command]||'home';
  this.queue(chatId,key,view);return true;
 }
 callback(update) {
  const query=update.callback_query,msg=query.message,from=query.from;
  if(msg?.chat?.type!=='private'||!positive(msg.chat.id)||from?.id!==msg.chat.id||from.is_bot||typeof query.id!=='string'||query.id.length>128)return true;
  const chatId=String(msg.chat.id),token=typeof query.data==='string'&&/^u_[A-Za-z0-9_-]{24}$/.test(query.data)?query.data.slice(2):null;
  const row=token?this.db.prepare('SELECT * FROM telegram_ui_callbacks WHERE token_hash=?').get(digest(token)):null;
  const valid=row&&!row.used&&row.chat_id===chatId&&row.scope===this.authority(chatId).scope&&row.expires>this.clock();
  this.queue(chatId,'ack:'+update.update_id,'callback_answer',{callback_query_id:query.id,text:valid?'':'Кнопка устарела. Открой /menu.',show_alert:!valid});
  if(!valid)return true;
  this.db.prepare('UPDATE telegram_ui_callbacks SET used=1 WHERE token_hash=?').run(digest(token));
  const key='ui:'+update.update_id,data=JSON.parse(row.data);this.mode(chatId);
  try { if(row.action==='help') {
   this.mode(chatId,'support');this.telegram.support?.activate(chatId,'vpn');this.queue(chatId,key,'help');
  }else if(row.action==='create')this.queue(chatId,key,'terms');
  else if(row.action==='accept_terms') {
   this.commerce.ensure(chatId,{acceptedTerms:true});this.queue(chatId,key,'plans');
  }else if(row.action==='reminders') {
   this.mute(chatId,Boolean(data.enabled));this.queue(chatId,key,'settings');
  }else if(row.action==='unlink_confirm') {
   if(this.commerce.canUnlink(chatId)) {
    const {identity}=this.authority(chatId);if(identity)this.telegram.disconnectInternal(identity.account_id);
    this.cancel(chatId,{keepControl:true});this.queue(chatId,key,'unlinked');
   }else this.queue(chatId,key,'unlink_blocked');
  }else if(row.action==='device'&&botDevices[data.device])this.queue(chatId,key,'device',{device:data.device});
  else if(row.action==='manual'&&botDevices[data.device])this.queue(chatId,key,'manual',{device:data.device});
  else if(row.action==='qr')this.queue(chatId,key,'qr');
  else if(row.action==='invoice'&&Number.isInteger(data.days))this.queue(chatId,key,'invoice',{days:data.days,requestKey:'tg-ui:'+token});
  else if(['home','subscription','devices','plans','settings','cabinet','binding','unlink'].includes(row.action))this.queue(chatId,key,row.action);
  }catch(error){if(error.code!=='INVALID_PAYMENT')throw error;this.queue(chatId,key,'action_unavailable');}
  return true;
 }
 ready(chatId) {
  const sub=this.commerce.subscription(chatId);
  if(!sub?.active||sub.sync_state!=='synced'||!sub.profile_url)return null;
  let url;try{url=new URL(sub.profile_url);}catch{return null;}
  if(url.protocol!=='https:'||url.username||url.password||!/^\/sub\/[A-Za-z0-9_-]+$/.test(url.pathname))return null;
  return {...sub,profile_url:url.href};
 }
 render(job) {
  const chatId=job.chat_id,payload=JSON.parse(job.payload),{identity}=this.authority(chatId);
  if(job.view==='callback_answer')return {method:'answerCallbackQuery',data:payload};
  if(job.view==='precheckout')return {method:'answerPreCheckoutQuery',data:payload};
  const button=(text,action,data)=>this.button(chatId,text,action,data),home=()=>[button('← В меню','home')];
  const rows=[],sub=identity?this.commerce.subscription(chatId):null;
  const body={chat_id:chatId,parse_mode:'HTML',link_preview_options:{is_disabled:true}};
  if(job.view==='keyboard_reset')return {method:'sendMessage',data:{...body,text:'Family VPN · подписка, подключение и помощь',reply_markup:{remove_keyboard:true}}};
  if(job.view==='financial_receipt') {
   const text=payload.invalid?'Не удалось подтвердить платёж. Доступ не изменён.':payload.recovery?'Family VPN. Подписка и способ входа сохранены.':payload.refunded?'Возврат подтверждён. Срок подписки обновлён.':'Оплата подтверждена. Подключение готовится автоматически. Повторно платить не нужно.';
   const buttons=identity?[[{text:'Открыть мой кабинет',url:this.commerce.handoff(chatId,{purpose:'login'})}]]:[];
   buttons.push([supportEmailCopyButton()]);
   return {method:'sendMessage',data:{...body,text:text+'\nПомощь с оплатой: '+SUPPORT_EMAIL+'.',reply_markup:{inline_keyboard:buttons}}};
  }
  let text;
  const main=()=>{rows.push([button('Подключиться','devices'),button('Моя подписка','subscription')],[button('Купить / продлить','plans'),button('Помощь','help')],[button('Напоминания','settings')]);};
  const status=()=>!identity?'Подключи существующую подписку или создай аккаунт.':sub?.deleted?'Подписка отключена. Напиши в поддержку.':sub?.allow_unlimited&&sub.unlimited&&sub.enabled?'Бессрочная подписка · без ограничений по устройствам.':sub?.payment_confirmed&&sub.sync_state!=='synced'?'Оплата подтверждена. Подключение готовится. Повторно платить не нужно.':sub?.active?'Подписка активна до '+date(sub.expires_at)+'.\nБез ограничений по устройствам.':sub?.paid_expires_at?'Подписка закончилась '+date(sub.paid_expires_at)+'.':'Активной подписки пока нет.';
  if(!identity&&['subscription','devices','plans','settings','cabinet','unlink','manual','device','qr','invoice'].includes(job.view)) {
   text='<b>Family VPN</b>\n\n'+status();rows.push([button('Уже есть подписка','binding')],[button('Создать аккаунт','create')],[button('Помощь','help')]);
  }else if(job.view==='binding') {
   text=payload.ok===false?'Ссылка привязки недействительна или уже использована. Создай новую в кабинете.':payload.ok?'Остался один шаг: вернись в кабинет и подтверди, что это твой Telegram. До подтверждения личная подписка здесь не появится.':'Уже покупал на сайте? Войди в кабинет → Настройки → Telegram → Подключить. После Start вернись на сайт и подтверди привязку.';
   rows.push([{text:'Открыть кабинет',url:this.origin+'/vpn/cabinet/#settings'}],home());
  }else if(job.view==='terms') {
   text='<b>Создать аккаунт Family VPN</b>\n\nTelegram станет способом входа в сервис. Подписка появится после подтверждённой оплаты. Нажимая «Принимаю и продолжаю», ты принимаешь условия сервиса и обработку данных.';
   rows.push([{text:'Условия и конфиденциальность',url:this.origin+'/vpn/terms/'}],[button('Принимаю и продолжаю','accept_terms')],home());
  }else if(job.view==='home'||job.view==='subscription'||job.view==='paid'||job.view==='refunded') {
   text='<b>Family VPN</b>\n\n'+(job.view==='paid'?'Оплата подтверждена.\n':job.view==='refunded'?'Возврат подтверждён.\n':'')+status();main();
  }else if(job.view==='devices') {
   if(!this.ready(chatId)){text='<b>Подключение</b>\n\n'+status();rows.push([button('Проверить снова','devices'),button('Помощь','help')],home());}
   else {text='<b>На каком устройстве подключаем VPN?</b>\n\nУстановка → добавление подписки → включение VPN.';rows.push([button('iPhone / iPad','device',{device:'ios'}),button('Android','device',{device:'android'})],[button('Windows','device',{device:'windows'}),button('Mac','device',{device:'macos'})],[button('Linux','device',{device:'linux'}),button('Smart TV','device',{device:'tv'})],home());}
  }else if(job.view==='device'||job.view==='manual') {
   const ready=this.ready(chatId),device=botDevices[payload.device];
   if(!ready||!device){text=status();rows.push([button('Проверить подключение','devices')],home());}
   else {
    text='<b>'+html(device.title)+'</b>\n\n1. Установи Happ.\n2. Добавь личную подписку. Логин от сайта в приложении не нужен.\n3. Включи VPN в приложении.';
    for(const [label,url] of device.install)rows.push([{text:label,url}]);
    rows.push([{text:'Добавить подписку в приложение',url:this.commerce.handoff(chatId,{device:payload.device,purpose:'import'})}]);
    if(job.view==='manual') {
     text+='\n\n<b>Личная ссылка</b>\n<code>'+html(ready.profile_url)+'</code>\n\nСкопируй её → открой Happ → «+» → добавь подписку из буфера. Не публикуй ссылку.';
     if(ready.profile_url.length<=256)rows.push([{text:'Скопировать ссылку',copy_text:{text:ready.profile_url}}]);
    }else rows.push([button('Скопировать / вставить вручную','manual',{device:payload.device})]);
    rows.push([button('QR для другого устройства','qr')],[button('← Выбрать устройство','devices')],home());
   }
  }else if(job.view==='qr') {
   const ready=this.ready(chatId);
   if(ready)return {method:'sendPhoto',qr:ready.profile_url,data:{chat_id:chatId,caption:'QR для подключения другого устройства. Это личный доступ: не публикуй код.',protect_content:true,reply_markup:{inline_keyboard:[home()]}}};
   text=status();rows.push(home());
  }else if(job.view==='plans') {
   const catalogue=this.commerce.plans();
   if(sub?.allow_unlimited&&sub.unlimited){text='У тебя бессрочная подписка. Продление не требуется.';rows.push(home());}
   else if(!catalogue.available){text='Покупка в Telegram пока недоступна. Текущая подписка и помощь остаются здесь.';rows.push([button('Моя подписка','subscription'),button('Помощь','help')],home());}
   else {text='<b>Выбери срок подписки</b>\n\nОплата в Telegram Stars. Срок добавится к текущей подписке.';for(const plan of catalogue.plans)rows.push([button(plan.days+' дней · '+plan.stars+' ⭐','invoice',{days:plan.days})]);rows.push(home());}
  }else if(job.view==='invoice') {
   return {method:'sendInvoice',data:this.commerce.invoice(chatId,payload.days,payload.requestKey)};
  }else if(job.view==='settings') {
   const enabled=Boolean(this.db.prepare('SELECT enabled FROM telegram_links WHERE account_id=? AND chat_id=?').get(identity.account_id,chatId)?.enabled);
   text='<b>Напоминания</b>\n\n'+(enabled?'Включены: за 3 дня, за сутки и после окончания подписки.':'Выключены. Подписка и вход через Telegram сохранены.')+'\nБессрочной подписке напоминания не нужны.';
   rows.push([button(enabled?'Выключить напоминания':'Включить напоминания','reminders',{enabled:!enabled})],[button('Отвязать Telegram','unlink')],home());
  }else if(job.view==='unlink'||job.view==='unlink_blocked') {
   const allowed=this.commerce.canUnlink(chatId);
   text=allowed?'Отвязать Telegram от аккаунта? Это отключит напоминания и доступ к подписке в этом чате. Подписка останется в кабинете.':'Сначала добавь и проверь другой способ входа в кабинете. Сейчас Telegram — единственный способ доступа к аккаунту.';
   rows.push([{text:'Открыть кабинет',url:this.commerce.handoff(chatId,{purpose:'login'})}]);
   if(allowed)rows.push([button('Да, отвязать Telegram','unlink_confirm')]);rows.push(home());
  }else if(job.view==='cabinet') {
   text='Кабинет Family VPN. Ссылка для входа одноразовая. Не пересылай её.';rows.push([{text:'Открыть мой кабинет',url:this.commerce.handoff(chatId,{purpose:'login'})}],home());
  }else if(job.view==='help') {
   text=(this.telegram.support?.operator()?'Напиши здесь или по email. Ответ на сообщение в Telegram придёт в этот чат. Можно приложить фото или скриншот.\n/cancel — закончить обращение.':'Поддержка в Telegram сейчас недоступна.')+'\n\n'+emailSupportText({html:true});rows.push([supportEmailCopyButton()],home());
  }else if(job.view==='unlinked') {text='Telegram отвязан. Подписка сохранена. Вернуться можно через кабинет.';rows.push(home());}
  else if(job.view==='payment_invalid') {text='Не удалось подтвердить платёж. Доступ не изменён. Напиши /paysupport или на '+SUPPORT_EMAIL+'.';rows.push([supportEmailCopyButton()],home());}
  else if(job.view==='action_unavailable') {text='Действие сейчас недоступно. Открой меню и проверь подписку. Если нужна помощь, напиши здесь или на '+SUPPORT_EMAIL+'.';rows.push([supportEmailCopyButton()],home());}
  else {text='Выбери действие кнопками. Чтобы написать человеку, открой «Помощь».';main();}
  return {method:'sendMessage',data:{...body,text,reply_markup:{inline_keyboard:rows},...(job.view==='manual'?{protect_content:true}:{})}};
 }
 next() {
  for(const job of this.db.prepare("SELECT * FROM telegram_ui_outbox WHERE state='pending' AND ready_at<=? ORDER BY CASE view WHEN 'precheckout' THEN 0 WHEN 'callback_answer' THEN 1 ELSE 2 END,created_at,rowid LIMIT 100").all(this.clock())) {
   const ttl=job.view==='precheckout'?8_000:job.view==='callback_answer'?30_000:10*MINUTE;
   const control=['precheckout','callback_answer'].includes(job.view);
   if(job.created_at+ttl<=this.clock()||!control&&(job.scope!==this.authority(job.chat_id).scope||this.db.prepare('SELECT blocked FROM telegram_ui_state WHERE chat_id=?').get(job.chat_id)?.blocked)){this.db.prepare("UPDATE telegram_ui_outbox SET state='canceled' WHERE id=?").run(job.id);continue;}
   return job;
  }
  return null;
 }
 recover(){this.db.prepare("UPDATE telegram_ui_outbox SET state='uncertain' WHERE state='sending'").run();}
 plan(){this.db.prepare('DELETE FROM telegram_ui_callbacks WHERE expires<=?').run(this.clock());this.db.prepare("DELETE FROM telegram_ui_outbox WHERE created_at<? AND state NOT IN ('pending','sending')").run(this.clock()-DAY);this.db.prepare('DELETE FROM telegram_ui_state WHERE updated_at<?').run(this.clock()-90*DAY);}
}

export async function deliverUiOne(ui,client) {
 const job=ui.next();if(!job)return false;
 if(!ui.db.prepare("UPDATE telegram_ui_outbox SET state='sending' WHERE id=? AND state='pending'").run(job.id).changes)return false;
 try {
  const message=ui.render(job);
  if(message.qr)message.data.photo=await QRCode.toBuffer(message.qr,{type:'png',errorCorrectionLevel:'M',margin:2,width:600});
  if(!['precheckout','callback_answer'].includes(job.view)&&job.scope!==ui.authority(job.chat_id).scope){ui.db.prepare("UPDATE telegram_ui_outbox SET state='canceled' WHERE id=?").run(job.id);return true;}
  await client.call(message.method,message.data);ui.db.prepare("UPDATE telegram_ui_outbox SET state='sent' WHERE id=?").run(job.id);
 }catch(error) {
  if(error.code===429)ui.db.prepare("UPDATE telegram_ui_outbox SET state='pending',ready_at=? WHERE id=?").run(ui.clock()+Math.max(1000,Math.min(Number(error.retryAfter||1)*1000,3_600_000)),job.id);
  else {ui.db.prepare('UPDATE telegram_ui_outbox SET state=? WHERE id=?').run(error.code===403?'blocked':Number.isInteger(error.code)||error.code==='INVALID_PAYMENT'?'failed':'uncertain',job.id);if(error.code==='INVALID_PAYMENT')ui.queue(job.chat_id,'failure:'+job.id,'action_unavailable');if(error.code===403){ui.cancel(job.chat_id);ui.mute(job.chat_id,false);ui.db.prepare('UPDATE telegram_ui_state SET blocked=1 WHERE chat_id=?').run(job.chat_id);}}
 }
 return true;
}

export async function processTelegramUpdates(telegram,ui,client,updates) {
 if(!Array.isArray(updates))throw new Error('Invalid Telegram updates');
 for(const update of updates)telegram.update(update);
 // Pre-checkout has a 10-second deadline; discover every update before waiting on callback network I/O.
 while(ui&&['precheckout','callback_answer'].includes(ui.next()?.view))await deliverUiOne(ui,client);
}
