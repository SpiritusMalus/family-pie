import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {VpnStore} from '../store.mjs';
import {Accounts} from '../auth.mjs';
import {Cabinet} from '../cabinet.mjs';
import {TelegramStore,TelegramClient,TelegramApiError} from '../telegram.mjs';
import {TelegramCommerce} from '../telegram-commerce.mjs';
import {TelegramUI,deliverUiOne,processTelegramUpdates} from '../telegram-ui.mjs';
import {TelegramSupport,deliverSupportOne} from '../telegram-support.mjs';

function purchase(commerce,chatId,days,key){const offer=commerce.preparePurchase(chatId,days,key);commerce.acceptPurchase(chatId,offer.token);return commerce.invoice(chatId,days,key,offer.token);}
const DAY=86_400_000,CHAT=1001;
async function fixture(t,{path=':memory:',native=true,stars=true,paid=false}={}) {
 let now=Date.UTC(2026,9,27),sequence=0;
 const clock=()=>now,store=new VpnStore(path,{clock,plans:[{days:30,priceMinor:30000,devices:0}]});
 t.after(()=>store.close());
 const users=new Accounts(store,{clock,publicSubscriptionOrigin:'https://sub.family-spy.ru'});
 new Cabinet(store).setPlans([{days:30,priceMinor:30000,devices:0}]);
 const telegram=new TelegramStore(store,{clock});
 const commerce=new TelegramCommerce(store,{users,clock,stars:{enabled:stars,approved:stars,plans:[{days:30,stars:50}]}});
 const ui=new TelegramUI(telegram,{commerce,enabled:native,clock});telegram.ui=ui;
 const calls=[],client={call:async(method,data)=>{calls.push({method,data});return {message_id:calls.length};}};
 const update=body=>{const update={update_id:++sequence,...body};telegram.update(update);return update;};
 const message=(text,id=CHAT)=>update({message:{message_id:sequence+1,chat:{type:'private',id},from:{id},text}});
 const drain=async()=>{let limit=100;while(await deliverUiOne(ui,client))assert.ok(--limit>0);};
 const last=()=>{const data=calls.filter(x=>['sendMessage','sendPhoto','sendAnimation'].includes(x.method)).at(-1)?.data;return data&&{...data,text:data.text??data.caption};};
 const callback=(data,{chatId=CHAT,fromId=chatId,type='private'}={})=>update({callback_query:{id:'query-'+(sequence+1),from:{id:fromId},message:{message_id:1,chat:{type,id:chatId}},data}});
 const press=async(label,options)=>{const button=last()?.reply_markup?.inline_keyboard.flat().find(x=>x.text===label);assert.ok(button?.callback_data,'Missing callback '+label);callback(button.callback_data,options);await drain();};
 let account;
 if(paid) {
  account=await users.add({login:'ui-existing-fixture',profileUrl:'https://sub.family-pie.ru/sub/fictional_ui_profile',expiresAt:now+30*DAY});
  store.db.prepare('UPDATE identities SET must_change=0 WHERE account_id=?').run(account.accountId);
  const order=store.createOrder(account.accountId,30,'ui-paid-fixture'),paymentId='ui-fictional-yookassa';store.bindPayment(account.accountId,order.id,paymentId);
  store.confirmPayment({id:paymentId,status:'succeeded',paid:true,test:true,metadata:{order_id:order.id},amount:{currency:'RUB',value:'300.00'}});
  store.db.prepare("UPDATE managed_subscriptions SET enabled=1,sync_state='synced',entitlement_revision=? WHERE account_id=?").run(store.account(account.accountId).revision,account.accountId);
  const session=users.newSession(account.accountId),sessionHash=users.session(session.token).token_hash,token=telegram.issue(account.accountId,sessionHash);
  telegram.candidate(token,String(CHAT),'@fictional_fixture');telegram.confirm(account.accountId,sessionHash);
 }
 return {store,users,telegram,commerce,ui,calls,client,update,message,drain,last,callback,press,account,advance:ms=>now+=ms};
}

test('native UI defaults off and preserves legacy bot behavior without account creation',async t=>{
 const f=await fixture(t,{native:false});f.message('/start');await f.drain();
 assert.equal(f.calls.length,0);assert.match(f.store.db.prepare('SELECT text FROM telegram_outbox').get().text,/привяжи Telegram/);
 assert.equal(f.store.db.prepare('SELECT count(*) n FROM telegram_native_accounts').get().n,0);
});

test('plain Start welcomes without creating access while menu and deep links retain their own routes',async t=>{
 const f=await fixture(t);f.message('/start');await f.drain();
 const welcome=f.calls.at(-1);assert.equal(welcome.method,'sendAnimation');assert.ok(welcome.data.animation instanceof Uint8Array);assert.equal(welcome.data.animation.subarray(4,8).toString(),'ftyp');
 assert.equal(welcome.data.duration,4);assert.equal(welcome.data.width,1280);assert.equal(welcome.data.height,640);
 assert.equal(welcome.data.reply_markup.inline_keyboard[0][0].style,'success');
 assert.ok(welcome.data.caption.length<=1024);assert.equal(welcome.data.parse_mode,'HTML');
 assert.deepEqual(welcome.data.caption.match(/^<blockquote>([\s\S]*)<\/blockquote>$/)[1].split('\n'),['Телефон, компьютер и Smart TV','Одна подписка без лимита устройств','Маршруты через Нидерланды и Германию','Подключение по личной ссылке или QR-коду','Поддержка прямо в Telegram','Напоминания об окончании подписки']);
 assert.doesNotMatch(welcome.data.caption,/Family VPN|Что внутри|Интернет для тебя|Выбери действие/);
 assert.deepEqual(welcome.data.reply_markup.inline_keyboard.flat().map(button=>button.text),['💳 Купить / продлить','🔌 Подключиться','📋 Моя подписка','💬 Помощь','🔔 Напоминания']);
 assert.equal(f.store.db.prepare('SELECT count(*) n FROM telegram_native_accounts').get().n,0);
 assert.equal(f.store.db.prepare('SELECT count(*) n FROM orders').get().n,0);assert.equal(f.store.db.prepare('SELECT count(*) n FROM grants').get().n,0);
 await f.press('🔌 Подключиться');assert.equal(f.calls.at(-1).method,'sendMessage');
 assert.ok(f.last().reply_markup.inline_keyboard.flat().some(button=>button.text==='Уже есть подписка'));
 f.message('/menu');await f.drain();assert.equal(f.calls.at(-1).method,'sendMessage');assert.ok(f.last().text.length<welcome.data.caption.length);
 f.message('/start unknown_payload');await f.drain();assert.equal(f.calls.at(-1).method,'sendMessage');
 f.message('/start support_vpn');await f.drain();assert.equal(f.calls.at(-1).method,'sendMessage');assert.match(f.last().text,/support@family-pie\.ru/);
 f.message('/start bind_invalid');await f.drain();assert.equal(f.calls.at(-1).method,'sendMessage');assert.match(f.last().text,/привязки недействительна/);
 const animationCount=f.calls.filter(call=>call.method==='sendAnimation').length;
 f.message('Подключиться');await f.drain();assert.ok(f.last().reply_markup.inline_keyboard.flat().some(button=>button.text==='Уже есть подписка'));
 const messageCount=f.calls.filter(call=>call.method==='sendMessage').length;
 f.message('🔌 Подключиться');await f.drain();assert.equal(f.calls.filter(call=>call.method==='sendMessage').length,messageCount+1);
 assert.ok(f.last().reply_markup.inline_keyboard.flat().some(button=>button.text==='Уже есть подписка'));assert.equal(f.calls.filter(call=>call.method==='sendAnimation').length,animationCount);
});

test('new Telegram buyer explicitly accepts delivered terms and reaches RUB website checkout without a payment',async t=>{
 const f=await fixture(t);f.message('/renew');await f.drain();await f.press('Создать аккаунт');
 assert.equal(f.commerce.accountForChat(CHAT),null);assert.match(f.last().text,/условия/);
 const accept=f.last().reply_markup.inline_keyboard.flat().find(x=>x.text==='Принимаю и продолжаю').callback_data;
 f.callback(accept);await f.drain();const identity=f.commerce.accountForChat(CHAT);assert.ok(identity);
 assert.equal(f.store.db.prepare('SELECT password_set,must_change FROM identities WHERE account_id=?').get(identity.account_id).password_set,0);
 f.callback(accept);await f.drain();assert.equal(f.store.db.prepare('SELECT count(*) n FROM telegram_native_accounts').get().n,1);
 f.message('/renew');await f.drain();await f.press('30 дней · 300 ₽');
 assert.match(f.last().text,/Всего: <b>300 ₽/);
 const link=f.last().reply_markup.inline_keyboard.flat().find(button=>button.text==='Перейти на сайт').url;
 const token=new URLSearchParams(new URL(link).hash.slice(1)).get('telegram');assert.equal(f.commerce.previewLogin(token).period,30);
 const terms=f.store.db.prepare('SELECT terms_version,terms_hash FROM telegram_native_accounts').get();assert.ok(terms.terms_version);assert.match(terms.terms_hash,/^[a-f0-9]{64}$/);
 assert.ok(!f.calls.some(x=>x.method==='sendInvoice'));assert.equal(f.store.db.prepare('SELECT count(*) n FROM orders').get().n,0);
 assert.equal(f.store.db.prepare('SELECT count(*) n FROM grants').get().n,0);
 assert.ok(!f.calls.some(x=>JSON.stringify(x).includes('happ://')));
});

test('RUB website checkout remains independent of disabled Stars sales',async t=>{
 const f=await fixture(t,{stars:false});f.commerce.ensure(CHAT,{acceptedTerms:true});f.message('/renew');await f.drain();
 assert.match(f.last().text,/рублях.*ЮKassa/);assert.ok(f.last().reply_markup.inline_keyboard.flat().some(x=>x.text==='30 дней · 300 ₽'));assert.ok(!f.calls.some(x=>x.method==='sendInvoice'));
 assert.ok(!f.last().reply_markup.inline_keyboard.flat().some(x=>x.text.includes('⭐')));
});

test('returning paid customer uses owned RUB checkout; old Stars callbacks and unsent invoice jobs create no new sale',async t=>{
 const f=await fixture(t,{paid:true});f.message('/renew');await f.drain();
 const selected=f.last().reply_markup.inline_keyboard.flat().find(x=>x.text==='30 дней · 300 ₽').callback_data;
 f.callback(selected,{fromId:1002});await f.drain();assert.equal(f.store.db.prepare('SELECT count(*) n FROM telegram_handoffs').get().n,0);
 f.callback(selected);await f.drain();assert.match(f.last().text,/Всего: <b>300 ₽/);assert.equal(f.store.db.prepare('SELECT count(*) n FROM telegram_handoffs').get().n,1);
 f.callback(selected);await f.drain();assert.equal(f.store.db.prepare('SELECT count(*) n FROM telegram_handoffs').get().n,1);
 const old=f.ui.button(String(CHAT),'Historical Stars button','invoice',{days:30});f.callback(old.callback_data);await f.drain();assert.match(f.last().text,/Оплата в рублях/);
 const offer=f.commerce.preparePurchase(CHAT,30,'historical-consent-fixture');f.commerce.acceptPurchase(CHAT,offer.token);const invoice=f.commerce.invoice(CHAT,30,'historical-consent-fixture',offer.token);
 const before=f.store.db.prepare('SELECT id,days,payment_amount,state FROM orders ORDER BY id').all();
 f.ui.queue(String(CHAT),'old-invoice-job','invoice',{days:30,requestKey:'historical-consent-fixture',consentToken:offer.token});await f.drain();assert.match(f.last().text,/Оплата в рублях/);
 f.ui.queue(String(CHAT),'old-consent-job','purchase_terms',{consentToken:offer.token});await f.drain();
 assert.deepEqual(f.store.db.prepare('SELECT id,days,payment_amount,state FROM orders ORDER BY id').all(),before);assert.equal(f.store.db.prepare('SELECT count(*) n FROM grants').get().n,1);
 assert.ok(invoice.payload);assert.ok(!f.calls.some(x=>x.method==='sendInvoice'));
});

test('native binding Start is only a candidate until the original website session confirms ownership',async t=>{
 const f=await fixture(t),user=await f.users.add({login:'native-bind-fixture'});f.store.db.prepare('UPDATE identities SET must_change=0 WHERE account_id=?').run(user.accountId);
 const session=f.users.newSession(user.accountId),sessionHash=f.users.session(session.token).token_hash,nonce=f.telegram.issue(user.accountId,sessionHash);
 f.message('/start bind_'+nonce);await f.drain();assert.equal(f.commerce.accountForChat(CHAT),null);assert.match(f.last().text,/вернись в кабинет и подтверди/);
 assert.equal(f.telegram.state(user.accountId,sessionHash).pending,true);f.telegram.confirm(user.accountId,sessionHash);f.message('/status');await f.drain();
 assert.equal(f.commerce.accountForChat(CHAT).account_id,user.accountId);assert.match(f.last().text,/Активной подписки пока нет/);
});

test('existing paid buyer gets canonical URL, safe fragment handoff, manual copy and private second-device QR without cabinet login',async t=>{
 const f=await fixture(t,{paid:true});f.message('/start');await f.drain();assert.match(f.last().text,/<\/blockquote>\n\nПодписка активна до/);f.message('/connect');await f.drain();await f.press('iPhone / iPad');
 assert.match(f.last().text,/Логин от сайта в приложении не нужен/);
 const handoff=f.last().reply_markup.inline_keyboard.flat().find(x=>x.text==='Добавить подписку в приложение').url;
 const url=new URL(handoff);assert.equal(url.pathname,'/vpn/connect/');assert.equal(url.search,'');assert.match(url.hash,/^#token=[A-Za-z0-9_-]{43}&device=ios$/);
 await f.press('Скопировать / вставить вручную');assert.match(f.last().text,/https:\/\/sub\.family-spy\.ru\/sub\/fictional_ui_profile/);
 const copy=f.last().reply_markup.inline_keyboard.flat().find(x=>x.copy_text);assert.equal(copy.copy_text.text,'https://sub.family-spy.ru/sub/fictional_ui_profile');
 const stored=JSON.stringify({callbacks:f.store.db.prepare('SELECT * FROM telegram_ui_callbacks').all(),jobs:f.store.db.prepare('SELECT * FROM telegram_ui_outbox').all()});
 assert.doesNotMatch(stored,/fictional_ui_profile|#token=|happ:\/\//);
 await f.press('QR для другого устройства');const photo=f.calls.find(x=>x.method==='sendPhoto');assert.ok(photo.data.photo instanceof Uint8Array);assert.equal(photo.data.protect_content,true);assert.match(photo.data.caption,/другого устройства/);
});

test('callback tokens reject forwarded chats, spoofed actors, groups, expiry and replaced bindings',async t=>{
 const f=await fixture(t,{paid:true});f.message('/menu');await f.drain();
 const token=f.last().reply_markup.inline_keyboard[0][0].callback_data,before=f.calls.filter(x=>x.method==='sendMessage').length;
 f.callback(token,{chatId:1002});await f.drain();assert.equal(f.calls.filter(x=>x.method==='sendMessage').length,before);assert.match(f.calls.at(-1).data.text,/устарела/);
 f.callback(token,{fromId:1002});f.callback(token,{type:'group'});await f.drain();assert.equal(f.calls.filter(x=>x.method==='sendMessage').length,before);
 f.advance(601_000);f.callback(token);await f.drain();assert.match(f.calls.at(-1).data.text,/устарела/);
 f.message('/menu');await f.drain();const stale=f.last().reply_markup.inline_keyboard[0][0].callback_data;
 f.store.db.prepare("UPDATE telegram_links SET generation='replacement' WHERE chat_id=?").run(String(CHAT));f.callback(stale);await f.drain();assert.match(f.calls.at(-1).data.text,/устарела/);
});

test('queued personal delivery is canceled after binding or paid entitlement revocation',async t=>{
 const f=await fixture(t,{paid:true});f.message('/connect');await f.drain();
 const device=f.last().reply_markup.inline_keyboard.flat().find(x=>x.text==='Android').callback_data;f.callback(device);
 f.store.db.prepare('UPDATE identities SET enabled=0 WHERE account_id=?').run(f.account.accountId);await f.drain();
 assert.ok(!f.calls.some(x=>x.data.text?.includes('1. Установи')));
 f.store.db.prepare('UPDATE identities SET enabled=1 WHERE account_id=?').run(f.account.accountId);f.message('/connect');await f.drain();
 f.store.db.prepare('UPDATE grants SET reversed=1 WHERE account_id=?').run(f.account.accountId);await f.press('Android');assert.ok(!f.last().reply_markup.inline_keyboard.flat().some(x=>x.url?.includes('/vpn/connect/')));
});

test('/stop mutes reminders without deleting access; Telegram-only identity cannot be unlinked and survives blocking',async t=>{
 const f=await fixture(t);const identity=f.commerce.ensure(CHAT,{acceptedTerms:true});f.message('/stop');await f.drain();
 assert.equal(f.commerce.accountForChat(CHAT).account_id,identity.account_id);assert.equal(f.store.db.prepare('SELECT enabled FROM telegram_links WHERE chat_id=?').get(String(CHAT)).enabled,0);
 assert.match(f.last().text,/вход через Telegram сохранены/);await f.press('Отвязать Telegram');assert.match(f.last().text,/единственный способ/);
 assert.ok(!f.last().reply_markup.inline_keyboard.flat().some(x=>x.text==='Да, отвязать Telegram'));
 f.update({my_chat_member:{chat:{type:'private',id:CHAT},new_chat_member:{status:'kicked'}}});assert.equal(f.commerce.accountForChat(CHAT).account_id,identity.account_id);
 f.message('/start');await f.drain();assert.equal(f.calls.at(-1).method,'sendAnimation');assert.match(f.last().text,/<\/blockquote>\n\nАктивной подписки пока нет/);assert.equal(f.store.db.prepare('SELECT blocked FROM telegram_ui_state WHERE chat_id=?').get(String(CHAT)).blocked,0);
});

test('explicit unlink with another auth method revokes bot callbacks but preserves paid subscription',async t=>{
 const f=await fixture(t,{paid:true});f.message('/disconnect');await f.drain();await f.press('Да, отвязать Telegram');
 assert.equal(f.commerce.accountForChat(CHAT),null);assert.equal(f.store.subscription(f.account.accountId).active,true);assert.match(f.last().text,/Подписка сохранена/);
 assert.ok(f.calls.some(x=>x.method==='answerCallbackQuery'));
});

test('native subscription card distinguishes preparing access, expired term and legacy unlimited',async t=>{
 const f=await fixture(t,{paid:true});f.store.db.prepare("UPDATE managed_subscriptions SET sync_state='pending',enabled=0 WHERE account_id=?").run(f.account.accountId);
 f.message('/status');await f.drain();assert.match(f.last().text,/Оплата подтверждена/);assert.match(f.last().text,/Повторно платить не нужно/);
 f.advance(31*DAY);f.message('/status');await f.drain();assert.match(f.last().text,/закончилась/);
 f.store.db.prepare("UPDATE managed_subscriptions SET allow_unlimited=1,unlimited=1,enabled=1,sync_state='synced',expires_at=0 WHERE account_id=?").run(f.account.accountId);
 f.message('/status');await f.drain();assert.match(f.last().text,/Бессрочная подписка/);f.message('/renew');await f.drain();assert.match(f.last().text,/Продление не требуется/);
});

test('support receives free text only after an explicit help action during native commerce flow',async t=>{
 const f=await fixture(t);const owner=await f.users.add({login:'native-ui-support-owner',role:'admin'});f.store.db.prepare('UPDATE identities SET must_change=0 WHERE account_id=?').run(owner.accountId);
 f.store.db.prepare("INSERT INTO telegram_links(account_id,chat_id,generation,bound_at) VALUES(?,9001,'operator',?)").run(owner.accountId,Date.now());
 const support=new TelegramSupport(f.store,{operatorAccountId:owner.accountId,botId:7001});f.telegram.support=support;
 f.message('/start');await f.drain();f.message('private commerce input');assert.equal(f.store.db.prepare('SELECT count(*) n FROM telegram_support_tickets').get().n,0);
 f.message('/menu');await f.drain();await f.press('💬 Помощь');f.message('Help with my phone');assert.equal(f.store.db.prepare('SELECT count(*) n FROM telegram_support_tickets').get().n,1);
 assert.equal(f.store.db.prepare('SELECT mode FROM telegram_ui_state WHERE chat_id=?').get(String(CHAT)).mode,'support');
 f.message('/menu');await f.drain();f.message('receipt input');assert.equal(f.store.db.prepare('SELECT count(*) n FROM telegram_support_tickets').get().n,1);
 while(await deliverSupportOne(support,f.client));
 const mapped=f.store.db.prepare('SELECT message_id FROM telegram_support_messages WHERE chat_id=?').get('9001');assert.ok(mapped);
 f.message('/menu',9001);await f.drain();
 f.update({message:{message_id:1000,chat:{type:'private',id:9001},from:{id:9001},text:'Operator answer after menu',reply_to_message:{message_id:mapped.message_id,from:{id:7001,is_bot:true}}}});
 assert.equal(f.store.db.prepare("SELECT count(*) n FROM telegram_support_outbox WHERE direction='customer' AND kind='copy'").get().n,1);
 f.message('/start support_sufler');f.message('/paysupport');f.message('VPN payment question');
 assert.equal(f.store.db.prepare('SELECT product FROM telegram_support_customers WHERE chat_id=?').get(String(CHAT)).product,'vpn');
 assert.ok(f.store.db.prepare("SELECT 1 FROM telegram_support_tickets WHERE chat_id=? AND product='vpn'").get(String(CHAT)));
});

test('stale commerce actions recover with a message and cannot pin the update offset',async t=>{
 const f=await fixture(t);f.message('/renew');await f.drain();await f.press('Создать аккаунт');
 const token=f.last().reply_markup.inline_keyboard.flat().find(x=>x.text==='Принимаю и продолжаю').callback_data;
 const disabled=await f.users.add({login:'disabled-native-fixture'});f.store.db.prepare('UPDATE identities SET enabled=0 WHERE account_id=?').run(disabled.accountId);
 f.store.db.prepare("INSERT INTO telegram_links(account_id,chat_id,generation,bound_at) VALUES(?,?,'disabled',?)").run(disabled.accountId,String(CHAT),Date.now());
 const before=f.telegram.offset();f.callback(token);await f.drain();assert.ok(f.telegram.offset()>before);assert.match(f.last().text,/Подтверждение условий недействительно/);assert.equal(f.store.db.prepare('SELECT count(*) n FROM telegram_native_accounts').get().n,0);
 const active=await fixture(t);active.commerce.ensure(CHAT,{acceptedTerms:true});active.message('/renew');await active.drain();
 const purchase=active.last().reply_markup.inline_keyboard.flat().find(x=>x.text==='30 дней · 300 ₽').callback_data;active.callback(purchase);new Cabinet(active.store).setPlans([]);await active.drain();
 assert.ok(!active.calls.some(x=>x.method==='sendInvoice'));assert.match(active.last().text,/Действие сейчас недоступно/);
});

test('payment grant and durable update offset commit together; duplicates do not add duration twice',async t=>{
 const f=await fixture(t);const identity=f.commerce.ensure(CHAT,{acceptedTerms:true}),invoice=purchase(f.commerce,CHAT,30,'ui-payment-request');
 f.update({pre_checkout_query:{id:'ui-precheckout',from:{id:CHAT},invoice_payload:invoice.payload,currency:'XTR',total_amount:50}});await f.drain();assert.equal(f.calls.at(-1).method,'answerPreCheckoutQuery');assert.equal(f.calls.at(-1).data.ok,true);
 const payment={invoice_payload:invoice.payload,currency:'XTR',total_amount:50,telegram_payment_charge_id:'fictional-ui-charge'};
 const body={message:{chat:{type:'private',id:CHAT},from:{id:CHAT},successful_payment:payment}};
 f.update(body);await f.drain();f.update(body);await f.drain();assert.equal(f.store.db.prepare('SELECT count(*) n FROM grants').get().n,1);
 assert.equal(f.store.subscription(identity.account_id).expiresAt,Date.UTC(2026,9,27)+30*DAY);
 const second=purchase(f.commerce,CHAT,30,'ui-second-request');f.commerce.preCheckout({id:'second-precheckout',from:{id:CHAT},invoice_payload:second.payload,currency:'XTR',total_amount:50});
 const before=f.telegram.offset(),original=f.commerce.successfulPayment.bind(f.commerce);f.commerce.successfulPayment=msg=>{original(msg);throw new Error('isolated operational failure');};
 assert.throws(()=>f.update({message:{chat:{type:'private',id:CHAT},from:{id:CHAT},successful_payment:{...payment,invoice_payload:second.payload,telegram_payment_charge_id:'second-fictional-charge'}}}),/operational failure/);
 assert.equal(f.telegram.offset(),before);assert.equal(f.store.db.prepare('SELECT count(*) n FROM grants').get().n,1);
});

test('late Stars payment and refund remain durable with native navigation and sales both disabled',async t=>{
 const f=await fixture(t),identity=f.commerce.ensure(CHAT,{acceptedTerms:true}),invoice=purchase(f.commerce,CHAT,30,'ui-flagoff-purchase');
 f.commerce.preCheckout({id:'flagoff-precheckout',from:{id:CHAT},invoice_payload:invoice.payload,currency:'XTR',total_amount:50});
 f.ui.enabled=false;f.commerce.enabled=false;
 const payment={invoice_payload:invoice.payload,currency:'XTR',total_amount:50,telegram_payment_charge_id:'flagoff-fictional-charge'};
 f.update({message:{chat:{type:'private',id:CHAT},from:{id:CHAT},successful_payment:payment}});await f.drain();
 assert.equal(f.store.subscription(identity.account_id).active,true);assert.match(f.last().text,/Оплата подтверждена/);
 assert.ok(!f.last().reply_markup.inline_keyboard.flat().some(x=>x.callback_data));
 assert.match(f.last().text,/support@family-pie\.ru/);assert.ok(!f.last().reply_markup.inline_keyboard.flat().some(button=>button.copy_text));
 const before=f.telegram.offset();f.update({message:{chat:{type:'private',id:CHAT},from:{id:CHAT},refunded_payment:payment}});await f.drain();
 assert.ok(f.telegram.offset()>before);assert.equal(f.store.subscription(identity.account_id).active,false);assert.equal(f.store.db.prepare('SELECT reversed FROM grants').get().reversed,1);assert.match(f.last().text,/Возврат подтверждён/);
 assert.match(f.last().text,/support@family-pie\.ru/);assert.ok(!f.last().reply_markup.inline_keyboard.flat().some(button=>button.copy_text));
 f.message('/stop');await f.drain();assert.equal(f.commerce.accountForChat(CHAT).account_id,identity.account_id);
 f.update({my_chat_member:{chat:{type:'private',id:CHAT},new_chat_member:{status:'kicked'}}});assert.equal(f.commerce.accountForChat(CHAT).account_id,identity.account_id);
});

test('confirmed non-native Telegram link retains a usable cabinet login when navigation is off and the final web method is removed',async t=>{
 const f=await fixture(t,{paid:true});assert.equal(f.store.db.prepare('SELECT count(*) n FROM telegram_native_accounts').get().n,0);
 // A passwordless web account after its last web credential was removed; confirmed Telegram remains.
 f.store.db.prepare('UPDATE identities SET password_set=0 WHERE account_id=?').run(f.account.accountId);f.ui.enabled=false;
 assert.equal(f.commerce.canUnlink(CHAT),false);assert.equal(await f.users.login(f.account.login,f.account.password),null);
 f.message('/cabinet');await f.drain();const handoff=f.last().reply_markup.inline_keyboard.flat().find(x=>x.text==='Открыть мой кабинет').url;
 const token=new URLSearchParams(new URL(handoff).hash.slice(1)).get('telegram'),session=f.commerce.consume(token,'login');
 assert.equal(session.identity.account_id,f.account.accountId);assert.ok(f.users.session(session.token));
 f.message('/stop');await f.drain();assert.equal(f.commerce.accountForChat(CHAT).account_id,f.account.accountId);
});

test('worker batch processes later pre-checkout before waiting on an earlier callback acknowledgement',async t=>{
 const f=await fixture(t);f.commerce.ensure(CHAT,{acceptedTerms:true});f.message('/menu');await f.drain();
 const token=f.last().reply_markup.inline_keyboard[0][0].callback_data,invoice=purchase(f.commerce,CHAT,30,'ui-batch-purchase'),calls=[];
 await processTelegramUpdates(f.telegram,f.ui,{call:async(method,data)=>{calls.push({method,data});return {};}},[
  {update_id:100,callback_query:{id:'batch-callback',from:{id:CHAT},message:{chat:{type:'private',id:CHAT}},data:token}},
  {update_id:101,pre_checkout_query:{id:'batch-precheckout',from:{id:CHAT},invoice_payload:invoice.payload,currency:'XTR',total_amount:50}}
 ]);
 assert.equal(calls[0].method,'answerPreCheckoutQuery');assert.equal(calls[0].data.ok,true);assert.equal(calls[1].method,'answerCallbackQuery');assert.equal(f.telegram.offset(),102);
});

test('intent/callback state survives reopen; uncertain sends do not replay after restart',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'telegram-native-ui-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const path=join(dir,'private.sqlite');
 const f=await fixture(t,{path,paid:true});f.message('/connect');await f.drain();const data=f.last().reply_markup.inline_keyboard.flat().find(x=>x.text==='Android').callback_data;
 const store=new VpnStore(path,{clock:f.ui.clock});t.after(()=>store.close());const users=new Accounts(store,{clock:f.ui.clock,publicSubscriptionOrigin:'https://sub.family-spy.ru'}),telegram=new TelegramStore(store,{clock:f.ui.clock}),commerce=new TelegramCommerce(store,{users,clock:f.ui.clock}),ui=new TelegramUI(telegram,{commerce,enabled:true,clock:f.ui.clock});telegram.ui=ui;
 telegram.update({update_id:100,callback_query:{id:'reopen-callback',from:{id:CHAT},message:{chat:{type:'private',id:CHAT}},data}});
 const calls=[];while(await deliverUiOne(ui,{call:async(method,data)=>{calls.push({method,data});return {};}}));assert.ok(calls.some(x=>x.data.text?.includes('Логин от сайта')));
 telegram.update({update_id:101,message:{chat:{type:'private',id:CHAT},from:{id:CHAT},text:'/status'}});
 let count=0;await deliverUiOne(ui,{call:async()=>{count++;throw new Error('uncertain private response');}});ui.recover();await deliverUiOne(ui,{call:async()=>{count++;}});assert.equal(count,1);
});

test('explicit 429 is retried, callback acknowledgements precede chat backlog and media uses multipart without URL transport',async t=>{
 const f=await fixture(t,{paid:true});f.message('/menu');await f.drain();const token=f.last().reply_markup.inline_keyboard[0][0].callback_data;
 f.message('/status');f.callback(token);assert.equal(f.ui.next().view,'callback_answer');await deliverUiOne(f.ui,{call:async()=>{throw new TelegramApiError(429,1);}});
 f.advance(1001);await f.drain();assert.ok(f.calls.some(x=>x.method==='answerCallbackQuery'));
 let request;const client=new TelegramClient('123456:FICTIONAL_ONLY_TELEGRAM_CREDENTIAL',{request:async(url,options)=>{request={url,options};return {ok:true,json:async()=>({ok:true,result:{message_id:1}})};}});
 await client.call('sendPhoto',{chat_id:CHAT,photo:new Uint8Array([137,80,78,71]),caption:'private QR',protect_content:true});assert.ok(request.options.body instanceof FormData);assert.equal(request.options.headers,undefined);assert.equal(request.options.body.get('photo').name,'subscription.png');assert.equal(request.options.body.get('photo').type,'image/png');
 const animation=new Uint8Array([0,0,0,24,102,116,121,112]),markup={inline_keyboard:[[{text:'Купить',callback_data:'opaque-test-callback',style:'success'}]]};
 await client.call('sendAnimation',{chat_id:CHAT,animation,duration:4,width:1280,height:640,caption:'Welcome',parse_mode:'HTML',reply_markup:markup});
 assert.ok(request.options.body instanceof FormData);assert.equal(request.options.headers,undefined);assert.match(request.url,/\/sendAnimation$/);
 const media=request.options.body.get('animation');assert.equal(media.name,'welcome.mp4');assert.equal(media.type,'video/mp4');assert.deepEqual(new Uint8Array(await media.arrayBuffer()),animation);
 for(const [key,value] of Object.entries({chat_id:CHAT,duration:4,width:1280,height:640,caption:'Welcome',parse_mode:'HTML'}))assert.equal(request.options.body.get(key),String(value));
 assert.deepEqual(JSON.parse(request.options.body.get('reply_markup')),markup);assert.equal(request.options.body.has('photo'),false);assert.equal(request.options.redirect,'error');
});

test('uncertain animation upload is held without retrying or sending a fallback greeting',async t=>{
 const f=await fixture(t);f.message('/start');const calls=[];
 const client=new TelegramClient('123456:FICTIONAL_ONLY_TELEGRAM_CREDENTIAL',{request:async(url,options)=>{calls.push({url,options});throw new Error('Upload delivery unknown');}});
 await deliverUiOne(f.ui,client);assert.equal(f.store.db.prepare("SELECT state FROM telegram_ui_outbox WHERE view='welcome'").get().state,'uncertain');
 f.ui.recover();await deliverUiOne(f.ui,client);assert.equal(calls.length,1);assert.match(calls[0].url,/\/sendAnimation$/);assert.ok(calls[0].options.body instanceof FormData);
 assert.equal(f.store.db.prepare('SELECT count(*) n FROM telegram_native_accounts').get().n,0);assert.equal(f.store.db.prepare('SELECT count(*) n FROM grants').get().n,0);
});

test('native help and financial fallbacks keep published email as text without an email-copy button',async t=>{
 const f=await fixture(t,{stars:false});const before=f.store.db.prepare('SELECT count(*) n FROM identities').get().n;
 f.message('/help');await f.drain();const message=f.last();assert.match(message.text,/support@family-pie\.ru/);assert.match(message.text,/Укажи устройство/);assert.match(message.text,/Не отправляй пароли/);
 assert.deepEqual(message.reply_markup.inline_keyboard.flat().map(button=>button.text),['← В меню']);assert.ok(!message.reply_markup.inline_keyboard.flat().some(button=>button.copy_text||button.url?.startsWith('mailto:')));
 for(const view of ['payment_invalid','action_unavailable','financial_receipt']){
  f.ui.queue(CHAT,'email-text-only:'+view,view);await f.drain();const reply=f.last();assert.match(reply.text,/support@family-pie\.ru/);assert.ok(!(reply.reply_markup?.inline_keyboard||[]).flat().some(button=>button.copy_text||button.text==='Скопировать email'));
 }
 assert.equal(f.store.db.prepare('SELECT count(*) n FROM identities').get().n,before);assert.equal(f.commerce.accountForChat(CHAT),null);assert.equal(f.store.db.prepare('SELECT count(*) n FROM grants').get().n,0);
});
