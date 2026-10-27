import {test} from 'node:test';
import assert from 'node:assert/strict';
import {VpnStore} from '../store.mjs';
import {Accounts} from '../auth.mjs';
import {TelegramStore} from '../telegram.mjs';
import {TelegramCommerce} from '../telegram-commerce.mjs';
import {Billing} from '../billing.mjs';
import {createApp} from '../server.mjs';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

function purchase(commerce,chatId,days,key){const offer=commerce.preparePurchase(chatId,days,key);commerce.acceptPurchase(chatId,offer.token);return commerce.invoice(chatId,days,key,offer.token);}
const DAY=86400000,origin='https://family-spy.ru';
function fixture(t,{enabled=true}={}){
 let now=Date.now();const store=new VpnStore(':memory:',{clock:()=>now,plans:[{days:30,priceMinor:30000,devices:0}]}),users=new Accounts(store,{clock:()=>now});new TelegramStore(store,{clock:()=>now});
 const commerce=new TelegramCommerce(store,{users,clock:()=>now,stars:{enabled,approved:true,plans:[{days:30,stars:150},{days:90,stars:400}]}});
 t.after(()=>store.close());return {store,users,commerce,advance:n=>now+=n,now:()=>now};
}
function paid(commerce,chatId,days,key,charge){
 const invoice=purchase(commerce,chatId,days,key),query={id:'query-'+key,from:{id:chatId},invoice_payload:invoice.payload,currency:'XTR',total_amount:invoice.prices[0].amount};
 assert.equal(commerce.preCheckout(query).ok,true);
 const message={chat:{id:chatId,type:'private'},from:{id:chatId},successful_payment:{currency:'XTR',total_amount:query.total_amount,invoice_payload:invoice.payload,telegram_payment_charge_id:charge}};
 return {invoice,query,message,result:commerce.successfulPayment(message)};
}
function ready(f,chatId){
 const a=f.commerce.accountForChat(chatId),s=f.store.subscription(a.account_id);
 f.store.db.prepare("UPDATE managed_subscriptions SET profile_url=?,panel_login='fixture-panel',expires_at=?,enabled=1,sync_state='synced',entitlement_revision=? WHERE account_id=?").run('https://sub.family-spy.ru/fictional-test-profile',s.expiresAt,s.revision,a.account_id);
 return a;
}
test('provider schema migration preserves historical RUB order and confirmation semantics',t=>{
 const dir=mkdtempSync(join(tmpdir(),'vpn-provider-migration-')),file=join(dir,'fixture.sqlite'),old=new DatabaseSync(file);
 old.exec("CREATE TABLE accounts(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,profile_ref TEXT UNIQUE NOT NULL,revision INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL);CREATE TABLE orders(id TEXT PRIMARY KEY,account_id TEXT NOT NULL REFERENCES accounts(id),request_key TEXT NOT NULL,days INTEGER NOT NULL,price_minor INTEGER NOT NULL,devices INTEGER NOT NULL,payment_id TEXT UNIQUE,state TEXT NOT NULL DEFAULT 'pending',created_at INTEGER NOT NULL,UNIQUE(account_id,request_key));INSERT INTO accounts VALUES('existing','fixture@example.invalid','profile-existing',0,1);INSERT INTO orders VALUES('historical','existing','request-historical',30,25000,0,'payment-historical','pending',1)");old.close();
 const store=new VpnStore(file);t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});
 const migrated=store.order('existing','historical');assert.equal(migrated.price_minor,25000);assert.equal(migrated.payment_amount,25000);assert.equal(migrated.currency,'RUB');assert.equal(migrated.provider,'yookassa');
 assert.equal(store.confirmPayment({id:'payment-historical',status:'succeeded',paid:true,test:true,metadata:{order_id:'historical'},amount:{value:'250.00',currency:'RUB'}}).active,true);
});
test('Telegram-first registration is explicit, idempotent, passwordless, and has a last-method guard',async t=>{
 const f=fixture(t),{commerce,store,users}=f;
 assert.throws(()=>commerce.ensure(123),/условия/);assert.equal(store.db.prepare('SELECT count(*) n FROM accounts').get().n,0);
 assert.throws(()=>commerce.ensure(-123,{acceptedTerms:true}),/личный чат/);
 const a=commerce.ensure(123,{acceptedTerms:true});assert.equal(commerce.ensure(123,{acceptedTerms:true}).account_id,a.account_id);
 const i=store.db.prepare('SELECT * FROM identities WHERE account_id=?').get(a.account_id);
 assert.equal(i.password_hash,'');assert.equal(i.password_set,0);assert.equal(i.must_change,0);assert.equal(commerce.canUnlink(123),false);
 assert.equal(await users.login(i.login,'NoSecretWasGenerated123'),null);assert.equal(users.subscription(a.account_id).active,false);
 assert.equal(store.db.prepare('SELECT count(*) n FROM accounts').get().n,1);
 store.db.prepare('UPDATE identities SET must_change=1 WHERE account_id=?').run(a.account_id);
 assert.equal(commerce.accountForChat(123),null);assert.throws(()=>commerce.ensure(123,{acceptedTerms:true}),/вход/);
 assert.equal(store.db.prepare('SELECT count(*) n FROM accounts').get().n,1);
});
test('Stars sales are disabled until explicitly approved; invoice retries preserve currency and immutable prices',t=>{
 const f=fixture(t,{enabled:false});f.commerce.ensure(123,{acceptedTerms:true});assert.equal(f.commerce.plans().available,false);assert.throws(()=>purchase(f.commerce,123,30,'request-key-1'),/недоступна/);
 const c=new TelegramCommerce(f.store,{users:f.users,stars:{enabled:true,approved:false,plans:[{days:30,stars:150}]}});assert.equal(c.plans().available,false);
 f.commerce.enabled=true;const invoice=purchase(f.commerce,123,30,'request-key-1');assert.equal(invoice.currency,'XTR');assert.equal(invoice.provider_token,undefined);assert.equal(invoice.prices.length,1);assert.equal(invoice.prices[0].amount,150);
 f.commerce.starPlans.set(30,{days:30,stars:999});assert.deepEqual(purchase(f.commerce,123,30,'request-key-1'),invoice);
 const order=f.store.db.prepare('SELECT * FROM orders').get();assert.equal(order.provider,'telegram-stars');assert.equal(order.currency,'XTR');assert.equal(order.price_minor,0);assert.equal(order.payment_amount,150);
 assert.throws(()=>f.store.createOrder(order.account_id,30,'request-key-1'),/already used/);assert.throws(()=>purchase(f.commerce,123,90,'request-key-1'),/сохранены/);
 assert.equal(f.store.subscription(order.account_id).active,false);
});
test('pre-checkout binds actor, amount, XTR, expiry and one query; only successful payment grants exactly once',t=>{
 const f=fixture(t),c=f.commerce;c.ensure(123,{acceptedTerms:true});c.ensure(456,{acceptedTerms:true});
 const invoice=purchase(c,123,30,'request-one'),q={id:'pre-one',from:{id:123},invoice_payload:invoice.payload,currency:'XTR',total_amount:150};
 for(const patch of [{from:{id:456}},{currency:'RUB'},{total_amount:151},{invoice_payload:'forged'}])assert.equal(c.preCheckout({...q,...patch}).ok,false);
 assert.equal(c.preCheckout(q).ok,true);assert.equal(c.preCheckout(q).ok,true);assert.equal(c.preCheckout({...q,id:'other-query'}).ok,false);
 assert.equal(f.store.db.prepare('SELECT count(*) n FROM grants').get().n,0);
 const message={chat:{id:123,type:'private'},from:{id:123},successful_payment:{currency:'XTR',total_amount:150,invoice_payload:invoice.payload,telegram_payment_charge_id:'charge-one'}};
 for(const changed of [{...message,chat:{id:123,type:'group'}},{...message,from:{id:456}},{...message,successful_payment:{...message.successful_payment,total_amount:149}}])assert.throws(()=>c.successfulPayment(changed),e=>e.code==='INVALID_PAYMENT');
 const result=c.successfulPayment(message);assert.equal(result.duplicate,false);assert.equal(result.subscription.active,true);assert.equal(c.successfulPayment(message).duplicate,true);
 assert.equal(f.store.db.prepare('SELECT count(*) n FROM grants').get().n,1);assert.equal(f.store.db.prepare('SELECT count(*) n FROM jobs').get().n,1);
 assert.throws(()=>c.successfulPayment({...message,successful_payment:{...message.successful_payment,telegram_payment_charge_id:'charge-other'}}),e=>e.code==='INVALID_PAYMENT');
 const next=purchase(c,123,90,'request-next'),q2={...q,id:'pre-next',invoice_payload:next.payload,total_amount:400};assert.equal(c.preCheckout(q2).ok,true);
 assert.throws(()=>c.successfulPayment({...message,successful_payment:{...message.successful_payment,invoice_payload:next.payload,total_amount:400}}),e=>e.code==='INVALID_PAYMENT');
 assert.equal(f.store.db.prepare('SELECT count(*) n FROM grants').get().n,1);
});
test('payment processing participates in update transaction and late paid events survive sales shutdown',t=>{
 const f=fixture(t),c=f.commerce;c.ensure(123,{acceptedTerms:true});const p=paid(c,123,30,'request-atomic','charge-atomic');
 const before=f.store.subscription(p.result.accountId);assert.equal(before.revision,1);
 const next=purchase(c,123,90,'request-rollback'),q={id:'query-rollback',from:{id:123},invoice_payload:next.payload,currency:'XTR',total_amount:400};assert.equal(c.preCheckout(q).ok,true);
 const message={...p.message,successful_payment:{...p.message.successful_payment,invoice_payload:next.payload,total_amount:400,telegram_payment_charge_id:'charge-rollback'}};
 assert.throws(()=>f.store.transaction(()=>{c.successfulPayment(message);throw new Error('offset write failed');}),/offset/);
 assert.equal(f.store.subscription(p.result.accountId).revision,1);c.enabled=false;f.advance(2*DAY);
 assert.equal(c.successfulPayment(message).duplicate,false);assert.equal(f.store.subscription(p.result.accountId).revision,2);
});
test('Stars refunds revoke one grant, preserve later web purchases, and ambiguous requests never replay',async t=>{
 const f=fixture(t),c=f.commerce;c.ensure(123,{acceptedTerms:true});const first=paid(c,123,30,'request-refund','charge-refund');f.advance(1000);
 const web=f.store.createOrder(first.result.accountId,30,'request-web');f.store.bindPayment(first.result.accountId,web.id,'web-payment');f.store.confirmPayment({id:'web-payment',status:'succeeded',paid:true,test:true,metadata:{order_id:web.id},amount:{currency:'RUB',value:'300.00'}});
 const expected=f.now()+30*DAY;let calls=0;
 assert.equal(c.queueRefund(first.result.accountId,first.result.orderId).state,'pending');
 await c.deliverRefundOne({call:async(method,data)=>{calls++;assert.equal(method,'refundStarPayment');assert.equal(data.telegram_payment_charge_id,'charge-refund');throw new Error('unknown send');}});
 assert.equal(c.queueRefund(first.result.accountId,first.result.orderId).state,'uncertain');assert.equal(await c.deliverRefundOne({call:async()=>{calls++;}}),false);assert.equal(calls,1);
 const message={...first.message,refunded_payment:first.message.successful_payment};delete message.successful_payment;
 assert.equal(c.refundedPayment(message).duplicate,false);assert.equal(c.refundedPayment(message).duplicate,true);
 assert.equal(f.store.subscription(first.result.accountId).expiresAt,expected);assert.equal(f.store.order(first.result.accountId,web.id).state,'paid');
 assert.equal(c.queueRefund(first.result.accountId,first.result.orderId).alreadyRefunded,true);
 const billing=new Billing(f.store,{shopId:'fixture',secret:'FICTIONAL',request:async()=>{throw new Error('Stars must not call YooKassa');}});
 assert.equal((await billing.resume(first.result.accountId,first.result.orderId)).resumeReason,'provider');await assert.rejects(()=>billing.refund(first.result.accountId,first.result.orderId,'request-refund'),/не найден/);
});
test('confirmed Stars refund queue invokes the matching charge once and reverses exactly that grant',async t=>{
 const f=fixture(t),c=f.commerce;c.ensure(123,{acceptedTerms:true});const p=paid(c,123,30,'request-refund-ok','charge-refund-ok');let calls=0;
 const client={call:async(method,data)=>{calls++;assert.equal(method,'refundStarPayment');assert.deepEqual(data,{user_id:123,telegram_payment_charge_id:'charge-refund-ok'});return true;}};
 assert.equal((await c.refund(p.result.accountId,p.result.orderId,client)).state,'confirmed');assert.equal(f.store.subscription(p.result.accountId).active,false);
 assert.equal((await c.refund(p.result.accountId,p.result.orderId,client)).state,'confirmed');assert.equal(calls,1);
});
test('login/import handoffs are hashed, one-use, purpose-bound and revoked on link generation or stale entitlement',t=>{
 const f=fixture(t),c=f.commerce,a=c.ensure(123,{acceptedTerms:true});paid(c,123,30,'request-handoff','charge-handoff');ready(f,123);
 const url=new URL(c.handoff(123,{purpose:'import',device:'ios'})),token=new URLSearchParams(url.hash.slice(1)).get('token');
 assert.equal(url.pathname,'/vpn/connect/');assert.equal(url.search,'');assert.equal(f.store.db.prepare('SELECT token_hash FROM telegram_handoffs').get().token_hash.includes(token),false);
 assert.throws(()=>c.consume(token,'login'),/недействительна/);assert.equal(c.consume(token,'import').device,'ios');assert.throws(()=>c.consume(token,'import'),/недействительна/);
 const login=new URL(c.handoff(123,{device:'windows'})),loginToken=new URLSearchParams(login.hash.slice(1)).get('telegram'),session=c.consume(loginToken,'login');assert.equal(session.identity.account_id,a.account_id);assert.equal(session.device,'windows');assert.equal(f.store.db.prepare('SELECT method FROM session_auth WHERE token_hash=?').get(f.users.session(session.token).token_hash).method,'telegram');
 const revoked=new URLSearchParams(new URL(c.handoff(123)).hash.slice(1)).get('telegram');f.store.db.prepare("UPDATE telegram_links SET generation='different' WHERE chat_id='123'").run();assert.throws(()=>c.consume(revoked,'login'),/недействительна/);
 const expired=new URLSearchParams(new URL(c.handoff(123)).hash.slice(1)).get('telegram');f.advance(300001);assert.throws(()=>c.consume(expired,'login'),/недействительна/);
 f.store.db.prepare('UPDATE accounts SET revision=revision+1 WHERE id=?').run(a.account_id);assert.equal(c.subscription(123).active,false);assert.equal(c.subscription(123).profile_url,null);assert.throws(()=>c.handoff(123,{purpose:'import'}),/не готово/);
});
test('real HTTP handoff requires same origin, rotates into a Telegram session and can add independent recovery',async t=>{
 const store=new VpnStore(':memory:'),app=createApp({store,origin,botUsername:'fictional_fixture_bot'});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 t.after(async()=>{await new Promise(r=>app.server.close(r));store.close();});
 const identity=app.commerce.ensure(123,{acceptedTerms:true}),url=new URL(app.commerce.handoff(123,{device:'ios'})),token=new URLSearchParams(url.hash.slice(1)).get('telegram'),base='http://127.0.0.1:'+app.server.address().port+'/vpn/api/';
 const post=(path,data,headers={})=>fetch(base+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...headers},body:JSON.stringify(data)});
 assert.equal((await post('telegram/login',{token},{Origin:'https://evil.invalid'})).status,403);
 const preview=await post('telegram/login/preview',{token});assert.equal(preview.status,200);assert.equal(preview.headers.get('set-cookie'),null);assert.equal((await preview.json()).login,identity.login);
 const other=app.commerce.ensure(456,{acceptedTerms:true}),otherSession=app.users.newSession(other.account_id,{method:'telegram'}),otherCookie='vpn_session='+otherSession.token;
 const beforeSessions=store.db.prepare('SELECT count(*) n FROM sessions').get().n;
 for(const path of ['telegram/login/preview','telegram/login']){const conflict=await post(path,{token},{Cookie:otherCookie});assert.equal(conflict.status,409);assert.equal(conflict.headers.get('set-cookie'),null);assert.match((await conflict.json()).error,/другой аккаунт/);}
 assert.equal(app.users.session(otherSession.token).account_id,other.account_id);assert.equal(store.db.prepare('SELECT count(*) n FROM sessions').get().n,beforeSessions);
 const response=await post('telegram/login',{token});assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('referrer-policy'),'no-referrer');
 const data=await response.json();assert.equal(data.user.account_id,identity.account_id);assert.equal(data.device,'ios');const cookie=response.headers.get('set-cookie').split(';')[0];assert.match(response.headers.get('set-cookie'),/HttpOnly/);
 assert.equal((await post('telegram/login',{token})).status,400);
 assert.equal((await fetch(base+'telegram',{method:'DELETE',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json','X-CSRF-Token':data.csrf},body:'{}'})).status,400);
 const recover=await post('password/set',{next:'IndependentRecoveryPassword123'},{Cookie:cookie,'X-CSRF-Token':data.csrf});assert.equal(recover.status,200);assert.equal(app.commerce.canUnlink(123),true);
 assert.ok(await app.users.login(identity.login,'IndependentRecoveryPassword123'));assert.equal(app.users.session(cookie.slice('vpn_session='.length)),null);
 assert.equal((await post('telegram/payment',{chatId:123,currency:'XTR',total_amount:1,paid:true})).status,401);assert.equal(store.db.prepare('SELECT count(*) n FROM grants').get().n,0);
});
test('HTTP private import consumes only the proper purpose once and requires current paid access',async t=>{
 const store=new VpnStore(':memory:'),app=createApp({store,origin,starsConfig:{enabled:true,approved:true,plans:[{days:30,stars:150}]}});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 t.after(async()=>{await new Promise(r=>app.server.close(r));store.close();});
 app.commerce.ensure(123,{acceptedTerms:true});paid(app.commerce,123,30,'request-http-import','charge-http-import');ready({store,commerce:app.commerce},123);
 const url=new URL(app.commerce.handoff(123,{purpose:'import',device:'android'})),token=new URLSearchParams(url.hash.slice(1)).get('token'),base='http://127.0.0.1:'+app.server.address().port+'/vpn/api/';
 const post=(path,requestOrigin=origin)=>fetch(base+path,{method:'POST',headers:{Origin:requestOrigin,'Content-Type':'application/json'},body:JSON.stringify({token})});
 assert.equal((await post('telegram/import','https://evil.invalid')).status,403);assert.equal((await post('telegram/login')).status,400);
 const response=await post('telegram/import');assert.equal(response.status,200);assert.equal(response.headers.get('set-cookie'),null);assert.equal(response.headers.get('cache-control'),'no-store');assert.match((await response.json()).profileUrl,/fictional-test-profile/);
 assert.equal((await post('telegram/import')).status,400);
});
test('confirmed Telegram identity is a real alternative auth method even when reminders are off',t=>{
 const store=new VpnStore(':memory:'),app=createApp({store,origin});t.after(()=>store.close());const a=app.commerce.ensure(123,{acceptedTerms:true});
 store.db.prepare("UPDATE telegram_links SET enabled=0 WHERE chat_id='123'").run();
 store.db.prepare('INSERT INTO verified_emails VALUES(?,?)').run(a.account_id,'fixture@example.invalid');app.emailLogin.disconnect(a.account_id);assert.equal(app.emailLogin.state(a.account_id).email,null);
 store.db.prepare('INSERT INTO google_identities VALUES(?,?,?)').run('fictional-subject',a.account_id,'fixture@example.invalid');app.google.unlink(a.account_id);assert.equal(app.google.state(a.account_id).linked,false);
 store.db.prepare('INSERT INTO passkeys VALUES(?,?,?,?,?,?,?)').run('fictional-passkey',a.account_id,Buffer.from('fixture'),0,'[]','Fixture',Date.now());app.passkeys.remove(a.account_id,'fictional-passkey');assert.equal(app.passkeys.list(a.account_id).length,0);
 assert.equal(app.commerce.canUnlink(123),false);store.db.prepare('DELETE FROM telegram_links WHERE account_id=?').run(a.account_id);
 store.db.prepare('INSERT INTO verified_emails VALUES(?,?)').run(a.account_id,'fixture@example.invalid');assert.throws(()=>app.emailLogin.disconnect(a.account_id),/способ входа/);
 assert.ok(store.db.prepare('SELECT 1 FROM verified_emails WHERE account_id=?').get(a.account_id));
});
test('all channels report pending on a new grant until its exact entitlement revision is provisioned',t=>{
 const f=fixture(t),c=f.commerce,a=c.ensure(123,{acceptedTerms:true});paid(c,123,30,'request-first-revision','charge-first-revision');ready(f,123);assert.equal(f.users.subscription(a.account_id).active,true);
 paid(c,123,90,'request-next-revision','charge-next-revision');
 for(const s of [f.users.subscription(a.account_id),c.subscription(123)]){assert.equal(s.active,false);assert.equal(s.sync_state,'pending');assert.equal(s.profile_url,null);assert.equal(s.payment_confirmed,true);}
 ready(f,123);assert.equal(f.users.subscription(a.account_id).active,true);assert.equal(c.subscription(123).active,true);
});
