import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {VpnStore} from '../store.mjs';
import {Accounts} from '../auth.mjs';
import {TelegramStore,TelegramApiError} from '../telegram.mjs';
import {TelegramSupport,deliverSupportOne} from '../telegram-support.mjs';

const DAY=86_400_000,BOT=900001,OWNER=900002;
function message(updateId,text,chatId=1001,extra={}){return {update_id:updateId,message:{message_id:updateId+100,chat:{type:'private',id:chatId},from:{id:chatId,is_bot:false},...(text===null?{}:{text}),...extra}};}
function reply(updateId,text,messageId,extra={}){return message(updateId,text,OWNER,{reply_to_message:{message_id:messageId,from:{id:BOT,is_bot:true}},...extra});}
async function fixture(t,{path=':memory:',clock=null}={}){
 let now=Date.UTC(2026,9,20),seq=1;
 const readClock=clock||(()=>now),store=new VpnStore(path,{clock:readClock});t.after(()=>store.close());
 const accounts=new Accounts(store,{clock:readClock}),telegram=new TelegramStore(store,{clock:readClock});
 const owner=await accounts.add({login:'support-owner',role:'admin'});store.db.prepare('UPDATE identities SET must_change=0 WHERE account_id=?').run(owner.accountId);
 const session=accounts.newSession(owner.accountId),sessionHash=accounts.session(session.token).token_hash;
 const bind=(id=OWNER)=>{const nonce=telegram.issue(owner.accountId,sessionHash);assert.ok(telegram.candidate(nonce,String(id),'@fixture'));telegram.confirm(owner.accountId,sessionHash);};bind();
 const support=new TelegramSupport(store,{operatorAccountId:owner.accountId,botId:BOT,clock:readClock});telegram.support=support;
 const calls=[],client={call:async(method,body)=>{calls.push({method,body});return {message_id:seq++};}};
 return {store,accounts,telegram,support,owner,bind,client,calls,advance:ms=>now+=ms,handle:update=>store.transaction(()=>support.handle(update)),drain:async(limit=100)=>{let n=0;while(n<limit&&await deliverSupportOne(support,client))n++;assert.ok(n<limit,'outbox did not settle');},jobs:()=>store.db.prepare('SELECT * FROM telegram_support_outbox ORDER BY rowid').all(),mapped:()=>store.db.prepare('SELECT * FROM telegram_support_messages ORDER BY message_id').all()};
}

test('guest text is copied intact to operator; Reply to header or copy reaches exact guest without a cabinet account',async t=>{
 const f=await fixture(t),body='Я не могу войти. <b>Не HTML</b>\n'+ 'а'.repeat(4000);
 const before=f.store.db.prepare('SELECT count(*) n FROM identities').get().n;
 assert.equal(f.handle(message(1,body)),true);assert.equal(f.store.db.prepare('SELECT count(*) n FROM identities').get().n,before);
 await f.drain();assert.match(f.calls[0].body.text,/принято в очередь/);assert.match(f.calls[1].body.text,/Обращение #1/);
 assert.deepEqual(f.calls[2],{method:'copyMessage',body:{chat_id:String(OWNER),from_chat_id:'1001',message_id:101}});
 assert.equal(f.mapped().length,2);assert.equal(f.calls[3].body.chat_id,'1001');assert.match(f.calls[3].body.text,/доставлено/);
 assert.ok(f.jobs().every(j=>!String(j.text).includes('Я не могу войти')));assert.ok(f.calls.every(c=>!('parse_mode' in c.body)));
 f.handle(reply(2,'Помогу',f.mapped()[0].message_id));await f.drain();assert.deepEqual(f.calls[4],{method:'copyMessage',body:{chat_id:'1001',from_chat_id:String(OWNER),message_id:102}});
 f.handle(reply(3,'Ещё ответ',f.mapped()[1].message_id));await f.drain();assert.equal(f.calls[6].body.chat_id,'1001');
});

test('interleaved customers are routed by exact replied bot message and never by last active customer',async t=>{
 const f=await fixture(t);f.handle(message(1,'Первый',1001));f.handle(message(2,'Второй',1002));await f.drain();
 const rows=f.mapped();assert.equal(rows.length,4);
 f.handle(reply(3,'Ответ первому',rows[0].message_id));f.handle(reply(4,'Ответ второму',rows[3].message_id));await f.drain();
 const copies=f.calls.filter(c=>c.method==='copyMessage'&&c.body.from_chat_id===String(OWNER));assert.deepEqual(copies.map(c=>c.body.chat_id),['1001','1002']);
});

test('owner text without Reply, unknown Reply and a spoofed reply sender never open or route a ticket',async t=>{
 const f=await fixture(t);f.handle(message(1,'Просто текст',OWNER));f.handle(reply(2,'Ответ',12345));
 f.handle(message(3,'Вопрос'));await f.drain();const id=f.mapped()[0].message_id;
 f.handle(reply(4,'Подмена',id,{reply_to_message:{message_id:id,from:{id:BOT+1,is_bot:true}}}));
 f.handle(reply(5,'Подмена',id,{reply_to_message:{message_id:id,from:{id:BOT,is_bot:false}}}));await f.drain();
 assert.equal(f.store.db.prepare('SELECT count(*) n FROM telegram_support_tickets').get().n,1);
 assert.equal(f.calls.filter(c=>c.method==='copyMessage'&&c.body.from_chat_id===String(OWNER)).length,0);
 assert.ok(f.calls.some(c=>c.body.text?.includes('Чтобы ответить')));
});

test('only private same-author human messages enter support; known subscription and binding commands stay in legacy handler',async t=>{
 const f=await fixture(t);
 assert.equal(f.handle(message(1,'group',1001,{chat:{id:-100,type:'supergroup'}})),false);
 assert.equal(f.handle(message(2,'spoof',1001,{from:{id:1002}})),false);
 assert.equal(f.handle(message(3,'bot',1001,{from:{id:1001,is_bot:true}})),false);
 assert.equal(f.handle(message(4,'no message id',1001,{message_id:0})),false);
 let id=10;for(const cmd of ['/start','/start bind_fixture','/status','/subscription','/menu','/connect','/renew','/cabinet','/notifications','Моя подписка','Подключиться','Продлить','Личный кабинет','Уведомления'])assert.equal(f.handle(message(id++,cmd)),false,cmd);
 assert.equal(f.jobs().length,0);assert.equal(f.handle(message(50,'/help')),true);assert.match(f.jobs()[0].text,/вход в кабинет не нужен/);
});

test('support deep links choose product and supported media use copyMessage without downloading or retaining bodies',async t=>{
 const f=await fixture(t);f.handle(message(1,'/start support_sufler'));f.handle(message(2,null,1001,{photo:[{file_id:'not-stored'}],caption:'private-caption'}));
 f.handle(message(3,null,1001,{document:{mime_type:'image/png',file_id:'not-stored-either'},caption:'private-caption-two'}));
 f.handle(message(4,null,1001,{document:{mime_type:'application/pdf',file_id:'unsupported'}}));f.handle(message(5,null,1001,{voice:{file_id:'unsupported-voice'}}));
 await f.drain();const copies=f.calls.filter(c=>c.method==='copyMessage');assert.deepEqual(copies.map(c=>c.body.message_id),[102,103]);
 assert.equal(f.store.db.prepare('SELECT product FROM telegram_support_tickets').get().product,'sufler');assert.ok(f.calls.some(c=>c.body.text?.includes('другие файлы')));
 const rows=JSON.stringify(f.jobs());assert.doesNotMatch(rows,/private-caption|file_id|not-stored/);
});

test('one guest can keep separate product tickets; /help retains product and owner closing VPN preserves Sufler',async t=>{
 const f=await fixture(t);f.handle(message(1,'VPN question'));await f.drain();
 const vpnHeader=f.mapped()[0].message_id;
 f.handle(message(2,'/start support_sufler'));f.handle(message(3,'Sufler question'));f.handle(message(4,'/help'));f.handle(message(5,'Sufler followup'));await f.drain();
 const tickets=f.store.db.prepare('SELECT * FROM telegram_support_tickets ORDER BY id').all();assert.deepEqual(tickets.map(x=>x.product),['vpn','sufler']);
 assert.equal(f.jobs().filter(x=>x.kind==='copy'&&x.direction==='operator'&&x.ticket_id===2).length,2);
 f.handle(reply(6,'/close',vpnHeader));await f.drain();assert.equal(f.store.db.prepare('SELECT state FROM telegram_support_tickets WHERE id=1').get().state,'closed');assert.equal(f.store.db.prepare('SELECT state FROM telegram_support_tickets WHERE id=2').get().state,'open');
});

test('duplicate updates and duplicate source message IDs are durable and never enqueue a second copy',async t=>{
 const f=await fixture(t);assert.equal(f.handle(message(1,'one')),true);assert.equal(f.handle(message(1,'one')),true);
 const again=message(2,'one');again.message.message_id=101;assert.equal(f.handle(again),true);assert.equal(f.jobs().length,3);
 await f.drain();assert.equal(f.calls.filter(c=>c.method==='copyMessage').length,1);
});

test('disabled, gated, non-admin, unlinked and disabled-link operators cannot receive guest messages',async t=>{
 const f=await fixture(t);const denied=()=>{f.handle(message(f.jobs().length+1,'private'));assert.equal(f.jobs().filter(j=>j.direction==='operator').length,0);};
 f.store.db.prepare('UPDATE identities SET enabled=0 WHERE account_id=?').run(f.owner.accountId);denied();
 f.store.db.prepare('UPDATE identities SET enabled=1,must_change=1 WHERE account_id=?').run(f.owner.accountId);denied();
 f.store.db.prepare("UPDATE identities SET must_change=0,role='user' WHERE account_id=?").run(f.owner.accountId);denied();
 f.store.db.prepare("UPDATE identities SET role='admin' WHERE account_id=?").run(f.owner.accountId);f.store.db.prepare('UPDATE telegram_links SET enabled=0').run();denied();
 f.store.db.prepare('DELETE FROM telegram_links').run();denied();
});

test('outbound dispatch rechecks admin role and exact current binding; queued responses cannot escape after revoke or rebind',async t=>{
 const f=await fixture(t);f.handle(message(1,'question'));await f.drain();f.handle(reply(2,'answer',f.mapped()[0].message_id));
 f.store.db.prepare("UPDATE identities SET role='user' WHERE account_id=?").run(f.owner.accountId);await f.drain();assert.equal(f.calls.filter(c=>c.method==='copyMessage'&&c.body.from_chat_id===String(OWNER)).length,0);
 f.store.db.prepare("UPDATE identities SET role='admin' WHERE account_id=?").run(f.owner.accountId);f.handle(message(3,'next',1002));f.bind(OWNER+10);await f.drain();
 assert.equal(f.calls.filter(c=>c.method==='copyMessage'&&c.body.from_chat_id==='1002').length,0);
 f.handle(reply(4,'old reply',f.mapped()[0].message_id));await f.drain();assert.equal(f.store.db.prepare('SELECT count(*) n FROM telegram_support_tickets WHERE chat_id=?').get(String(OWNER)).n,0);
});

test('revoked operator cancels header and dependent copy with only one customer failure notice',async t=>{
 const f=await fixture(t);f.handle(message(1,'question'));f.store.db.prepare('UPDATE identities SET enabled=0 WHERE account_id=?').run(f.owner.accountId);await f.drain();
 assert.equal(f.calls.filter(c=>c.method==='copyMessage').length,0);
 assert.equal(f.calls.filter(c=>c.body.chat_id==='1001'&&c.body.text?.includes('Не удалось доставить')).length,1);
 assert.equal(f.jobs().filter(j=>j.dedupe.startsWith('failure:')).length,1);
 assert.ok(f.jobs().filter(j=>j.direction==='operator').every(j=>j.state==='canceled'));
});

test('operator account is pinned; a different admin link cannot become operator and old generation is never reused',async t=>{
 const f=await fixture(t);const other=await f.accounts.add({login:'other-admin',role:'admin'});f.store.db.prepare('UPDATE identities SET must_change=0 WHERE account_id=?').run(other.accountId);
 f.store.db.prepare('INSERT INTO telegram_links VALUES(?,?,NULL,1,?,?)').run(other.accountId,'900003','other-generation',Date.now());
 f.handle(message(1,'question'));f.bind();await f.drain();assert.equal(f.calls.filter(c=>c.method==='copyMessage').length,0);
 f.handle(message(2,'new question'));await f.drain();assert.ok(f.calls.some(c=>c.method==='copyMessage'&&c.body.chat_id===String(OWNER)));assert.ok(!f.calls.some(c=>c.body.chat_id==='900003'));
});

test('/cancel and /stop cancel unsent support jobs and close mode; stop still reaches the legacy unlink handler',async t=>{
 const f=await fixture(t);f.handle(message(1,'first'));assert.equal(f.handle(message(2,'/stop')),false);await f.drain();assert.equal(f.calls.filter(c=>c.method==='copyMessage').length,0);
 assert.equal(f.store.db.prepare('SELECT active FROM telegram_support_customers WHERE chat_id=?').get('1001').active,0);
 f.handle(message(3,'new issue'));await f.drain();const mapped=f.mapped().at(-1).message_id;f.handle(reply(4,'pending reply',mapped));f.handle(message(5,'/cancel'));await f.drain();
 assert.equal(f.calls.filter(c=>c.method==='copyMessage'&&c.body.from_chat_id===String(OWNER)).length,0);
 f.handle(reply(6,'late reply',mapped));await f.drain();assert.ok(f.calls.some(c=>c.body.text?.includes('Ответ не отправлен')));
});

test('owner /close requires exact mapped Reply; later guest message opens a new ticket',async t=>{
 const f=await fixture(t);f.handle(message(1,'first'));await f.drain();f.handle(reply(2,'/close',f.mapped()[0].message_id));await f.drain();
 assert.equal(f.store.db.prepare('SELECT state FROM telegram_support_tickets WHERE id=1').get().state,'closed');f.handle(message(3,'second'));await f.drain();
 assert.equal(f.store.db.prepare("SELECT id FROM telegram_support_tickets WHERE state='open'").get().id,2);
});

test('per-origin message rate and pending queue are bounded; command floods cannot bypass the queue cap',async t=>{
 const f=await fixture(t);for(let i=1;i<=15;i++)f.handle(message(i,'question'));
 assert.equal(f.jobs().filter(j=>j.kind==='copy').length,10);assert.equal(f.jobs().filter(j=>j.dedupe.startsWith('limit:')).length,1);
 for(let minute=0;minute<3;minute++){f.advance(60001);for(let i=0;i<10;i++)f.handle(message(100+minute*10+i,'question'));}
 assert.equal(f.jobs().filter(j=>j.kind==='copy'&&j.state==='pending').length,30);
 for(let i=1000;i<2100;i++)f.handle(message(i,'/help',i));assert.ok(f.jobs().filter(j=>j.state==='pending').length<=1000);
});

test('explicit 429 retries later, successful send IDs are mapped atomically, and delivery acknowledgement requires actual copy delivery',async t=>{
 const f=await fixture(t);f.handle(message(1,'question'));await deliverSupportOne(f.support,f.client);await deliverSupportOne(f.support,{call:async()=>{throw new TelegramApiError(429,10);}});
 assert.equal(f.mapped().length,0);assert.equal(f.support.next(),null);assert.ok(!f.jobs().some(j=>j.dedupe.startsWith('delivered:')));
 f.advance(10001);await f.drain();assert.equal(f.mapped().length,2);assert.equal(f.calls.filter(c=>c.method==='copyMessage').length,1);
});

test('403 to operator mutes exact link, cancels dependent copy and tells customer delivery failed',async t=>{
 const f=await fixture(t);f.handle(message(1,'question'));await deliverSupportOne(f.support,f.client);await deliverSupportOne(f.support,{call:async()=>{throw new TelegramApiError(403);}});await f.drain();
 assert.equal(f.support.operator(),null);assert.equal(f.calls.filter(c=>c.method==='copyMessage').length,0);assert.ok(f.calls.some(c=>c.body.chat_id==='1001'&&c.body.text?.includes('Не удалось')));
 assert.ok(!f.jobs().some(j=>j.dedupe.startsWith('delivered:')));
});

test('customer blocking produces operator delivery failure and stops queued replies',async t=>{
 const f=await fixture(t);f.handle(message(1,'question'));await f.drain();f.handle(reply(2,'answer',f.mapped()[0].message_id));f.handle(reply(3,'answer two',f.mapped()[0].message_id));
 await deliverSupportOne(f.support,{call:async()=>{throw new TelegramApiError(403);}});await f.drain();
 assert.equal(f.store.db.prepare('SELECT blocked FROM telegram_support_customers').get().blocked,1);assert.ok(f.calls.some(c=>c.body.chat_id===String(OWNER)&&c.body.text?.includes('не доставлен')));
 assert.equal(f.calls.filter(c=>c.method==='copyMessage'&&c.body.from_chat_id===String(OWNER)).length,0);
});

test('timeouts and restart with sending jobs are uncertain, never blindly retried; a missing message_id also cannot create routing',async t=>{
 const f=await fixture(t);f.handle(message(1,'question'));let attempts=0;
 await deliverSupportOne(f.support,f.client);
 await deliverSupportOne(f.support,{call:async()=>{attempts++;throw new Error('timeout with secret content');}});await f.drain();assert.equal(attempts,1);assert.equal(f.mapped().length,0);assert.ok(f.jobs().some(j=>j.state==='uncertain'));
 f.handle(message(2,'second',1002));await deliverSupportOne(f.support,f.client);const pending=f.support.next();assert.ok(f.support.claim(pending));f.support.recover();await f.drain();assert.ok(f.jobs().some(j=>j.id===pending.id&&j.state==='uncertain'));
 f.handle(message(3,'third',1003));await deliverSupportOne(f.support,f.client);await deliverSupportOne(f.support,{call:async()=>({})});await f.drain();assert.equal(f.mapped().length,0);
 assert.doesNotMatch(JSON.stringify(f.jobs()),/secret content/);
});

test('explicit copy rejection reports failure; copied owner headers remain usable and no content is logged',async t=>{
 const f=await fixture(t);f.handle(message(1,'question'));await deliverSupportOne(f.support,f.client);await deliverSupportOne(f.support,f.client);
 await deliverSupportOne(f.support,{call:async()=>{throw new TelegramApiError(400);}});await f.drain();assert.equal(f.mapped().length,1);assert.ok(f.calls.some(c=>c.body.text?.includes('Не удалось доставить')));
 f.handle(reply(2,'Try again',f.mapped()[0].message_id));await f.drain();assert.ok(f.calls.some(c=>c.method==='copyMessage'&&c.body.chat_id==='1001'));
});

test('blocking membership cancels support mode even for guests; groups cannot cancel it',async t=>{
 const f=await fixture(t);f.handle(message(1,'question'));
 f.handle({update_id:2,my_chat_member:{chat:{id:1001,type:'group'},new_chat_member:{status:'kicked'}}});assert.equal(f.jobs().filter(j=>j.state==='pending').length,3);
 f.handle({update_id:3,my_chat_member:{chat:{id:1001,type:'private'},new_chat_member:{status:'kicked'}}});await f.drain();assert.equal(f.calls.length,0);
});

test('90-day retention deletes mappings, jobs and tickets together; undelivered work expires with an explicit failure',async t=>{
 const f=await fixture(t);f.handle(message(1,'question'));await f.drain();f.advance(91*DAY);f.support.plan();assert.equal(f.mapped().length,0);assert.equal(f.jobs().length,0);assert.equal(f.store.db.prepare('SELECT count(*) n FROM telegram_support_tickets').get().n,0);
 f.handle(message(2,'late'));f.advance(2*DAY);await f.drain();assert.equal(f.calls.filter(c=>c.method==='copyMessage').length,1);assert.ok(f.calls.some(c=>c.body.text?.includes('Не удалось доставить')));
});

test('metadata, duplicate receipts and successful mappings survive process reopen without storing message content',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'telegram-support-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const path=join(dir,'private.sqlite');
 const f=await fixture(t,{path});f.handle(message(1,'private body never stored'));await f.drain();
 const reopened=new VpnStore(path);t.after(()=>reopened.close());new Accounts(reopened);new TelegramStore(reopened);const support=new TelegramSupport(reopened,{operatorAccountId:f.owner.accountId,botId:BOT});
 assert.equal(support.db.prepare('SELECT count(*) n FROM telegram_support_messages').get().n,2);
 const before=support.db.prepare('SELECT count(*) n FROM telegram_support_outbox').get().n;reopened.transaction(()=>support.handle(message(1,'private body never stored')));assert.equal(support.db.prepare('SELECT count(*) n FROM telegram_support_outbox').get().n,before);
 assert.doesNotMatch(JSON.stringify(support.db.prepare('SELECT * FROM telegram_support_outbox').all()),/private body never stored/);
});

test('legacy update transaction commits support enqueue with durable offset and /stop also unlinks owner reminders',async t=>{
 const f=await fixture(t);f.telegram.update(message(41,'guest request'));assert.equal(f.telegram.offset(),42);assert.equal(f.jobs().filter(j=>j.kind==='copy').length,1);
 f.telegram.update(message(41,'duplicate'));assert.equal(f.jobs().filter(j=>j.kind==='copy').length,1);
 f.telegram.update(message(42,'/status'));assert.equal(f.telegram.offset(),43);assert.match(f.store.db.prepare('SELECT text FROM telegram_outbox').get().text,/привяжи Telegram/);
 f.telegram.update(message(43,'/stop',OWNER));assert.equal(f.telegram.offset(),44);assert.equal(f.support.operator(),null);
 const original=f.support.handle.bind(f.support);f.support.handle=update=>{original(update);throw new Error('transaction fixture');};
 const count=f.jobs().length;assert.throws(()=>f.telegram.update(message(44,'must rollback')),/transaction fixture/);assert.equal(f.telegram.offset(),44);assert.equal(f.jobs().length,count);
});

test('unconfigured operator/bot ID gives contact fallback and never guesses another linked account',async t=>{
 const f=await fixture(t);const support=new TelegramSupport(f.store,{operatorAccountId:f.owner.accountId});f.store.transaction(()=>support.handle(message(1,'hello')));
 assert.equal(support.operator(),null);assert.ok(f.jobs().some(j=>j.text?.includes('support@family-pie.ru')));assert.equal(f.jobs().filter(j=>j.direction==='operator').length,0);
});

test('available Telegram support also offers published email and a copy action without routing email requests as tickets',async t=>{
 const f=await fixture(t);f.handle(message(1,'/help'));await f.drain();
 const intro=f.calls.find(call=>call.method==='sendMessage'&&call.body.chat_id==='1001').body;
 assert.match(intro.text,/Ответ поддержки придёт сюда/);assert.match(intro.text,/Можно также обратиться по email/);assert.match(intro.text,/support@family-pie\.ru/);assert.match(intro.text,/номер заказа/);assert.match(intro.text,/Не отправляй пароли/);
 assert.deepEqual(intro.reply_markup.inline_keyboard,[[{text:'Скопировать email',copy_text:{text:'support@family-pie.ru'}}]]);
 assert.equal(f.handle(message(2,'/email')),false);assert.equal(f.store.db.prepare('SELECT count(*) n FROM telegram_support_tickets').get().n,0);
 assert.doesNotMatch(JSON.stringify(intro.reply_markup),/mailto:|\/sub\/|token|password/);
});
