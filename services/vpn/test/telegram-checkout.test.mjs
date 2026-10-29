import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {VpnStore} from '../store.mjs';
import {Accounts} from '../auth.mjs';
import {Cabinet} from '../cabinet.mjs';
import {TelegramStore} from '../telegram.mjs';
import {TelegramCommerce} from '../telegram-commerce.mjs';
import {TelegramUI,deliverUiOne} from '../telegram-ui.mjs';
import {TelegramSupport} from '../telegram-support.mjs';

const CHAT=1001,OTHER=1002,ACCEPT='Принимаю и продолжаю',ORIGIN='https://family-spy.ru';
const PLANS=[{days:30,priceMinor:30000,devices:0},{days:90,priceMinor:80000,devices:0},{days:180,priceMinor:150000,devices:0},{days:365,priceMinor:270000,devices:0}];
const sha=value=>createHash('sha256').update(value).digest('hex');
function fixture(t,{persisted=true,sendOutcome='sent'}={}){
 let now=Date.UTC(2026,9,28),sequence=0;
 const clock=()=>now,store=new VpnStore(':memory:',{clock}),users=new Accounts(store,{clock}),cabinet=new Cabinet(store,{origin:ORIGIN});
 if(persisted)cabinet.setPlans(PLANS);
 const telegram=new TelegramStore(store,{clock}),commerce=new TelegramCommerce(store,{users,clock,origin:ORIGIN,stars:{enabled:false,approved:false,plans:[]}}),ui=new TelegramUI(telegram,{commerce,clock,enabled:true,origin:ORIGIN});telegram.ui=ui;t.after(()=>store.close());
 const calls=[],client={call:async(method,data)=>{
  calls.push({method,data});
  if(method==='sendMessage'&&data.text?.includes(ACCEPT)){
   if(sendOutcome==='failed')throw new Error('Synthetic send outcome unknown');
   if(sendOutcome==='missing-id')return {};
  }
  return {message_id:calls.length,chat:{id:Number(data.chat_id)||CHAT,type:'private'}};
 }};
 const update=body=>telegram.update({update_id:++sequence,...body});
 const message=(text,patch={})=>update({message:{message_id:sequence+1,chat:{type:'private',id:CHAT},from:{id:CHAT,is_bot:false},text,...patch}});
 const drain=async()=>{for(let i=0;i<60;i++)if(!await deliverUiOne(ui,client))return;assert.fail('Synthetic UI backlog did not drain');};
 const last=()=>calls.filter(call=>['sendMessage','sendPhoto','sendAnimation'].includes(call.method)).at(-1)?.data;
 const press=async label=>{const button=last()?.reply_markup?.inline_keyboard?.flat().find(row=>row.text.replace(/\s/g,'')===label.replace(/\s/g,''));assert.ok(button?.callback_data,'Actual rendered button missing: '+label);update({callback_query:{id:'fixture-callback-'+sequence,from:{id:CHAT,is_bot:false},message:{message_id:1,chat:{id:CHAT,type:'private'}},data:button.callback_data}});await drain();};
 const identities=()=>store.db.prepare('SELECT count(*) n FROM identities').get().n;
 const notices=()=>store.db.prepare('SELECT * FROM telegram_registration_notices WHERE chat_id=?').all(String(CHAT));
 const notice=async()=>{message('/terms');await drain();assert.match(last()?.text??'',/Принимаю и продолжаю/);};
 return {store,users,cabinet,telegram,commerce,ui,calls,client,update,message,drain,last,press,identities,notices,notice,clock,advance:ms=>now+=ms};
}
function checkoutToken(url,period){
 const value=new URL(url);assert.equal(value.origin,ORIGIN);assert.equal(value.pathname,'/vpn/cabinet/auth/');assert.equal(value.username,'');assert.equal(value.password,'');
 const fragment=new URLSearchParams(value.hash.slice(1)),token=fragment.get('telegram');assert.match(token,/^[A-Za-z0-9_-]{43}$/);assert.ok(!value.search.includes(token));
 if(period!==null){assert.equal(value.searchParams.get('period'),String(period));const next=value.searchParams.get('next');assert.ok(next?.startsWith('/vpn/cabinet/'));const fallback=new URL(next,ORIGIN);assert.equal(fallback.origin,ORIGIN);assert.ok((fallback.search+fallback.hash).includes(String(period)));}
 return token;
}
function noFinancialWrites(f){assert.equal(f.store.db.prepare('SELECT count(*) n FROM orders').get().n,0);assert.equal(f.store.db.prepare('SELECT count(*) n FROM grants').get().n,0);assert.ok(!f.calls.some(call=>call.method==='sendInvoice'));}

test('bot RUB catalogue reads persisted Cabinet plans, independently of transient or Stars price maps',t=>{
 const f=fixture(t,{persisted:false});assert.deepEqual(f.commerce.checkoutPlans(),{available:false,plans:[]});
 f.store.plans=new Map(PLANS.map(plan=>[String(plan.days),plan]));assert.deepEqual(f.commerce.checkoutPlans(),{available:false,plans:[]});
 f.cabinet.setPlans(PLANS);f.store.plans=new Map([['30',{days:30,priceMinor:123,devices:0}]]);
 assert.deepEqual(f.commerce.checkoutPlans(),{available:true,plans:PLANS});
 f.cabinet.setPlans([]);assert.deepEqual(f.commerce.checkoutPlans(),{available:false,plans:[]});noFinancialWrites(f);
});

test('each chosen RUB term reaches an owned one-use website handoff without Stars invoice or payment writes',async t=>{
 for(const plan of PLANS){
  const f=fixture(t),identity=f.commerce.ensure(CHAT,{acceptedTerms:true});f.message('/renew');await f.drain();
  assert.doesNotMatch(f.last().text,/Telegram Stars|⭐|XTR/);
  await f.press(plan.days+' дней · '+plan.priceMinor/100+' ₽');
  const link=f.last().reply_markup.inline_keyboard.flat().find(button=>button.text==='Перейти на сайт');assert.ok(link?.url);assert.doesNotMatch(link.url,/t\.me\/|oauth/);
  const token=checkoutToken(link.url,plan.days),preview=f.commerce.previewLogin(token);assert.equal(preview.target,'plans');assert.equal(preview.period,plan.days);
  const result=f.commerce.consume(token,'login');assert.equal(result.identity.account_id,identity.account_id);assert.equal(result.target,'plans');assert.equal(result.period,plan.days);assert.equal(f.identities(),1);
  assert.throws(()=>f.commerce.consume(token,'login'));noFinancialWrites(f);
  const durable=JSON.stringify({outbox:f.store.db.prepare('SELECT payload FROM telegram_ui_outbox').all(),callbacks:f.store.db.prepare('SELECT data FROM telegram_ui_callbacks').all(),handoffs:f.store.db.prepare('SELECT * FROM telegram_handoffs').all()});assert.ok(!durable.includes(token));assert.ok(!durable.includes(link.url));
 }
});

test('a confirmed website account checks out on the same identity without creating a native duplicate',async t=>{
 const f=fixture(t),existing=await f.users.add({login:'synthetic-existing-web-buyer'});f.store.db.prepare('UPDATE identities SET must_change=0 WHERE account_id=?').run(existing.accountId);
 const session=f.users.newSession(existing.accountId),sessionHash=f.users.session(session.token).token_hash,nonce=f.telegram.issue(existing.accountId,sessionHash);f.telegram.candidate(nonce,String(CHAT),null);f.telegram.confirm(existing.accountId,sessionHash);
 f.message('/renew');await f.drain();await f.press('180 дней · 1500 ₽');const link=f.last().reply_markup.inline_keyboard.flat().find(button=>button.text==='Перейти на сайт'),token=checkoutToken(link.url,180),result=f.commerce.consume(token,'login');
 assert.equal(result.identity.account_id,existing.accountId);assert.equal(result.period,180);assert.equal(f.identities(),1);assert.equal(f.store.db.prepare('SELECT count(*) n FROM telegram_native_accounts').get().n,0);noFinancialWrites(f);
});

test('new buyer can accept a delivered registration notice by its exact public text and continue to chosen RUB checkout',async t=>{
 const f=fixture(t);await f.notice();assert.equal(f.identities(),0);assert.equal(f.notices().filter(row=>row.delivered_at!==null&&row.delivered_at!==undefined).length,1);
 f.message(ACCEPT);await f.drain();assert.equal(f.identities(),1);assert.equal(f.store.db.prepare('SELECT count(*) n FROM telegram_native_accounts').get().n,1);
 const accepted=f.notices().filter(row=>row.accepted_at!==null);assert.equal(accepted.length,1);assert.ok(accepted[0].terms_version);assert.match(accepted[0].notice_hash,/^[a-f0-9]{64}$/);
 await f.press('90 дней · 800 ₽');const link=f.last().reply_markup.inline_keyboard.flat().find(button=>button.text==='Перейти на сайт');const token=checkoutToken(link.url,90);assert.equal(f.commerce.consume(token,'login').period,90);
 f.message(ACCEPT);await f.drain();assert.equal(f.identities(),1);assert.equal(f.notices().filter(row=>row.accepted_at!==null).length,1);noFinancialWrites(f);
});

test('guest /renew90 intent survives the visible registration notice and exact text consent',async t=>{
 const f=fixture(t);f.message('/renew 90');await f.drain();assert.equal(f.identities(),0);noFinancialWrites(f);
 await f.press('Создать аккаунт');assert.match(f.last().text,/Принимаю и продолжаю/);assert.equal(f.identities(),0);
 f.message(ACCEPT);await f.drain();const link=f.last().reply_markup.inline_keyboard.flat().find(button=>button.text==='Перейти на сайт');assert.ok(link?.url);
 const token=checkoutToken(link.url,90);assert.equal(f.commerce.previewLogin(token).period,90);assert.equal(f.commerce.consume(token,'login').period,90);assert.equal(f.identities(),1);noFinancialWrites(f);
});

test('documented /renew and /plans term commands preserve every allowed RUB term without making orders',async t=>{
 for(const command of ['/renew','/plans'])for(const plan of PLANS){
  const f=fixture(t);f.commerce.ensure(CHAT,{acceptedTerms:true});f.message(command+' '+plan.days);await f.drain();
  const link=f.last().reply_markup.inline_keyboard.flat().find(button=>button.text==='Перейти на сайт');assert.ok(link?.url);assert.equal(f.commerce.consume(checkoutToken(link.url,plan.days),'login').period,plan.days);noFinancialWrites(f);
 }
 const invalid=fixture(t);invalid.commerce.ensure(CHAT,{acceptedTerms:true});invalid.message('/renew 91');await invalid.drain();assert.ok(!invalid.last().reply_markup.inline_keyboard.flat().some(button=>button.url));noFinancialWrites(invalid);
});

test('registration text without a notice or before notice delivery creates no identity',async t=>{
 const noNotice=fixture(t);noNotice.message(ACCEPT);await noNotice.drain();assert.equal(noNotice.identities(),0);noFinancialWrites(noNotice);
 const queued=fixture(t);queued.message('/terms');queued.message(ACCEPT);assert.equal(queued.identities(),0);await queued.drain();assert.equal(queued.identities(),0);noFinancialWrites(queued);
});

test('failed or unconfirmed notice sends never authorize typed registration',async t=>{
 for(const sendOutcome of ['failed','missing-id']){
  const f=fixture(t,{sendOutcome});f.message('/terms');await f.drain();f.message(ACCEPT);await f.drain();assert.equal(f.identities(),0,sendOutcome);assert.equal(f.notices().filter(row=>row.accepted_at!==null).length,0);noFinancialWrites(f);
 }
});

test('expired, changed-version and changed-notice registration proofs reject acceptance',async t=>{
 for(const scenario of ['expiry','version','notice']){
  const f=fixture(t);await f.notice();
  if(scenario==='expiry')f.advance(600001);
  else f.store.db.prepare('UPDATE telegram_registration_notices SET '+(scenario==='version'?'terms_version':'notice_hash')+'=? WHERE chat_id=?').run('synthetic-outdated',String(CHAT));
  f.message(ACCEPT);await f.drain();assert.equal(f.identities(),0,scenario);assert.equal(f.notices().filter(row=>row.accepted_at!==null).length,0);noFinancialWrites(f);
 }
});

test('only exact unforwarded same-actor private acceptance can consume a delivered guest notice',async t=>{
 for(const patch of [
  {text:'принимаю и продолжаю'},
  {text:ACCEPT+' за другого человека'},
  {forward_origin:{type:'user',date:1,sender_user:{id:OTHER,is_bot:false}}},
  {forward_from:{id:OTHER}},
  {via_bot:{id:OTHER,is_bot:true}},
  {from:{id:OTHER,is_bot:false}},
  {chat:{id:CHAT,type:'group'}},
 ]){
  const f=fixture(t);await f.notice();f.message(ACCEPT,patch);await f.drain();assert.equal(f.identities(),0);assert.equal(f.notices().filter(row=>row.accepted_at!==null).length,0);noFinancialWrites(f);
 }
});

test('entering support cancels registration intent and operator text cannot create a buyer',async t=>{
 const f=fixture(t);await f.notice();f.message('/help');await f.drain();f.message(ACCEPT);await f.drain();assert.equal(f.identities(),0);noFinancialWrites(f);
 const operator=fixture(t),admin=await operator.users.add({login:'synthetic-checkout-operator',role:'admin'});operator.store.db.prepare('UPDATE identities SET must_change=0 WHERE account_id=?').run(admin.accountId);
 const session=operator.users.newSession(admin.accountId),sessionHash=operator.users.session(session.token).token_hash,nonce=operator.telegram.issue(admin.accountId,sessionHash);operator.telegram.candidate(nonce,String(CHAT),null);operator.telegram.confirm(admin.accountId,sessionHash);
 operator.telegram.support=new TelegramSupport(operator.store,{operatorAccountId:admin.accountId,botId:99999,clock:operator.clock});
 operator.message('/terms');await operator.drain();operator.message(ACCEPT);await operator.drain();assert.equal(operator.identities(),1);assert.equal(operator.store.db.prepare('SELECT count(*) n FROM telegram_native_accounts').get().n,0);assert.equal(operator.notices().filter(row=>row.accepted_at!==null).length,0);noFinancialWrites(operator);
});

test('checkout handoffs retain account-switch proof, binding generation and expiration checks',t=>{
 const f=fixture(t),one=f.commerce.ensure(CHAT,{acceptedTerms:true}),two=f.commerce.ensure(OTHER,{acceptedTerms:true});
 const first=checkoutToken(f.commerce.handoff(CHAT,{purpose:'login',target:'plans',period:90}),90);
 assert.throws(()=>f.commerce.previewLogin(first,{accountId:two.account_id}),error=>error.code==='LOGIN_ACCOUNT_CONFLICT');assert.throws(()=>f.commerce.consume(first,'login',{accountId:two.account_id}),error=>error.code==='LOGIN_ACCOUNT_CONFLICT');assert.equal(f.commerce.previewLogin(first).period,90);
 f.store.db.prepare('UPDATE telegram_links SET generation=? WHERE account_id=?').run('synthetic-new-generation',one.account_id);assert.throws(()=>f.commerce.consume(first,'login'));
 const expiring=checkoutToken(f.commerce.handoff(CHAT,{purpose:'login',target:'plans',period:180}),180);f.advance(300001);assert.throws(()=>f.commerce.consume(expiring,'login'));noFinancialWrites(f);
});

test('default device handoffs remain compatible and unknown checkout targets/terms fail before creating proof',t=>{
 const f=fixture(t);f.commerce.ensure(CHAT,{acceptedTerms:true});const url=new URL(f.commerce.handoff(CHAT,{purpose:'login',device:'ios'})),token=new URLSearchParams(url.hash.slice(1)).get('telegram');
 assert.equal(f.commerce.previewLogin(token).target,'devices');assert.equal(f.commerce.previewLogin(token).period,null);const result=f.commerce.consume(token,'login');assert.equal(result.device,'ios');assert.equal(result.target,'devices');assert.equal(result.period,null);
 for(const target of ['https://outside.invalid','//outside.invalid','admin'])assert.throws(()=>f.commerce.handoff(CHAT,{purpose:'login',target,period:90}));
 for(const period of [0,-90,31,90.5])assert.throws(()=>f.commerce.handoff(CHAT,{purpose:'login',target:'plans',period}));noFinancialWrites(f);
});

test('additive handoff migration preserves old outstanding tokens and defaults their destination to devices',t=>{
 const clock=()=>Date.UTC(2026,9,28),store=new VpnStore(':memory:',{clock}),users=new Accounts(store,{clock});new TelegramStore(store,{clock});t.after(()=>store.close());
 const identity=users.addTelegramInternal(),generation='synthetic-old-link',token=randomBytes(32).toString('base64url');
 store.db.prepare('INSERT INTO telegram_links(account_id,chat_id,generation,bound_at) VALUES(?,?,?,?)').run(identity.account_id,String(CHAT),generation,clock());
 store.db.exec('CREATE TABLE telegram_handoffs(token_hash TEXT PRIMARY KEY,account_id TEXT NOT NULL REFERENCES identities(account_id),chat_id TEXT NOT NULL,generation TEXT NOT NULL,purpose TEXT NOT NULL,device TEXT NOT NULL,expires INTEGER NOT NULL)');
 store.db.prepare('INSERT INTO telegram_handoffs VALUES(?,?,?,?,?,?,?)').run(sha(token),identity.account_id,String(CHAT),generation,'login','android',clock()+300000);
 const before=store.db.prepare('SELECT * FROM telegram_handoffs').get(),commerce=new TelegramCommerce(store,{users,clock,origin:ORIGIN,stars:{enabled:false,approved:false,plans:[]}});
 const after=store.db.prepare('SELECT * FROM telegram_handoffs').get();for(const [key,value] of Object.entries(before))assert.equal(after[key],value);
 const preview=commerce.previewLogin(token);assert.equal(preview.target,'devices');assert.equal(preview.period,null);const result=commerce.consume(token,'login');assert.equal(result.identity.account_id,identity.account_id);assert.equal(result.target,'devices');assert.equal(result.period,null);assert.equal(store.db.prepare('SELECT count(*) n FROM grants').get().n,0);
});

test('operational registration failure rolls back account, link, consent and offset before the identical update retries once',async t=>{
 const f=fixture(t);await f.notice();const original=f.commerce.ensure.bind(f.commerce),beforeOffset=f.telegram.offset(),notice=f.notices()[0];
 const incoming={update_id:beforeOffset,message:{message_id:501,chat:{id:CHAT,type:'private'},from:{id:CHAT,is_bot:false},text:ACCEPT}};
 f.commerce.ensure=(...args)=>{original(...args);throw new Error('Synthetic registration transaction failure');};
 assert.throws(()=>f.telegram.update(incoming),/Synthetic registration transaction failure/);
 assert.equal(f.telegram.offset(),beforeOffset);assert.equal(f.identities(),0);assert.equal(f.store.db.prepare('SELECT count(*) n FROM telegram_links').get().n,0);assert.equal(f.store.db.prepare('SELECT count(*) n FROM telegram_native_accounts').get().n,0);assert.deepEqual(f.notices()[0],notice);
 assert.equal(f.store.db.prepare('SELECT used FROM telegram_ui_callbacks WHERE token_hash=?').get(notice.callback_hash).used,0);
 f.commerce.ensure=original;f.telegram.update(incoming);await f.drain();assert.equal(f.identities(),1);assert.equal(f.telegram.offset(),beforeOffset+1);assert.notEqual(f.notices()[0].accepted_at,null);assert.equal(f.store.db.prepare('SELECT count(*) n FROM telegram_links').get().n,1);
 f.telegram.update(incoming);await f.drain();assert.equal(f.identities(),1);assert.equal(f.store.db.prepare('SELECT count(*) n FROM telegram_native_accounts').get().n,1);noFinancialWrites(f);
});

test('a second delivered terms notice supersedes the old callback and only the current callback or exact text accepts',async t=>{
 for(const source of ['callback','text']){
  const f=fixture(t);await f.notice();const old=f.last().reply_markup.inline_keyboard.flat().find(button=>button.text===ACCEPT).callback_data;
  f.advance(1000);await f.notice();const current=f.last().reply_markup.inline_keyboard.flat().find(button=>button.text===ACCEPT).callback_data,currentNotice=f.notices()[0];assert.notEqual(old,current);
  const callback=(data,suffix)=>f.update({callback_query:{id:'synthetic-current-notice-'+source+'-'+suffix,from:{id:CHAT,is_bot:false},message:{message_id:currentNotice.message_id,chat:{id:CHAT,type:'private'}},data}});
  callback(old,'old');await f.drain();assert.equal(f.identities(),0);assert.deepEqual(f.notices()[0],currentNotice);assert.equal(f.store.db.prepare('SELECT used FROM telegram_ui_callbacks WHERE token_hash=?').get(sha(current.slice(2))).used,0);
  if(source==='callback')callback(current,'current');else f.message(ACCEPT);
  await f.drain();assert.equal(f.identities(),1);assert.notEqual(f.notices()[0].accepted_at,null);assert.equal(f.store.db.prepare('SELECT used FROM telegram_ui_callbacks WHERE token_hash=?').get(sha(current.slice(2))).used,1);noFinancialWrites(f);
 }
});
