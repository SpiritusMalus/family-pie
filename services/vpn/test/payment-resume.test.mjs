import {test} from 'node:test';
import assert from 'node:assert/strict';
import {VpnStore} from '../store.mjs';
import {createApp} from '../server.mjs';

const plans=[{days:30,priceMinor:30000,devices:0},{days:90,priceMinor:80000,devices:0},{days:180,priceMinor:140000,devices:0},{days:365,priceMinor:250000,devices:0}];
async function fixture(t){
 let now=Date.now(),posts=0,reads=0;
 const store=new VpnStore(':memory:',{plans,clock:()=>now}),payments=new Map();
 const app=createApp({store,origin:'https://family-spy.ru',secure:false,paymentConfig:{shopId:'fixture-shop',secret:'FICTIONAL',testMode:true,request:async(url,options)=>{
  if(options?.method==='POST'){
   posts++;const body=JSON.parse(options.body),id='fixture-payment-'+posts;
   const payment={id,status:'pending',paid:false,test:true,recipient:{account_id:'fixture-shop'},metadata:body.metadata,amount:body.amount,confirmation:{confirmation_url:'https://yoomoney.ru/checkout/'+id},expires_at:new Date(now+3600000).toISOString()};
   payments.set(id,{payment,body});return {ok:true,json:async()=>payment};
  }
  reads++;const payment=payments.get(url.split('/').at(-1))?.payment;
  return {ok:Boolean(payment),json:async()=>payment};
 }}});
 t.after(async()=>{if(app.server.listening)await new Promise(r=>app.server.close(r));store.close();});
 const owner=await app.users.add({login:'resume-owner',password:'LongFixturePassword123!'}),other=await app.users.add({login:'resume-other',password:'LongFixturePassword123!'});
 store.db.prepare('UPDATE identities SET must_change=0').run();
 const create=async(days=180,key='resume-order-key',lang='en',promo)=>{app.cabinet.createOrder(owner.accountId,days,key,promo);const result=await app.billing.checkout(owner.accountId,days,key,'receipt@example.invalid',{lang});const order=store.order(owner.accountId,result.orderId);return {...result,order,...payments.get(order.payment_id)};};
 return {store,app,owner,other,payments,create,counts:()=>({posts,reads}),advance:ms=>now+=ms};
}

test('provider return keeps every immutable period and optional valid locale',async t=>{
 const f=await fixture(t);
 for(const [index,plan] of plans.entries()){
  const lang=index%2?'ru':'en',created=await f.create(plan.days,'locale-return-'+plan.days,lang);
  const expected=new URL('https://family-spy.ru/vpn/cabinet/?lang='+lang+'#plans?order='+created.orderId+'&period='+plan.days);
  assert.equal(created.body.confirmation.return_url,expected.href);
  assert.equal(created.body.amount.value,(plan.priceMinor/100).toFixed(2));
 }
 const ignored=await f.create(30,'locale-untrusted','en&next=https://evil.invalid');
 assert.equal(ignored.body.confirmation.return_url,'https://family-spy.ru/vpn/cabinet/#plans?order='+ignored.orderId+'&period=30');
 assert.equal(f.store.db.prepare('SELECT count(*) n FROM grants').get().n,0);
});

test('resume rechecks the owned payment and reuses its discounted immutable amount without another charge',async t=>{
 const f=await fixture(t);
 f.app.cabinet.setPromo({code:'FIXTURE',percent:20,maxUses:3,expires:f.store.clock()+86400000});
 const created=await f.create(180,'discounted-resume','en','FIXTURE');
 f.app.cabinet.setPlans(plans.map(p=>({...p,priceMinor:p.priceMinor+10000})));
 const before=f.counts(),resumed=await f.app.billing.resume(f.owner.accountId,created.orderId);
 assert.deepEqual(resumed.order,{id:created.orderId,state:'pending',days:180,price_minor:112000});
 assert.equal(resumed.url,created.url);assert.equal(f.counts().posts,before.posts);assert.equal(f.counts().reads,before.reads+1);
 assert.equal(f.store.db.prepare('SELECT count(*) n FROM orders').get().n,1);
 assert.equal(f.store.db.prepare('SELECT count(*) n FROM grants').get().n,0);
 assert.equal(f.store.order(f.owner.accountId,created.orderId).promo_code,'FIXTURE');
});

test('resume observes provider cancellation, success and refund before offering any payment URL',async t=>{
 const f=await fixture(t),canceled=await f.create(180,'canceled-resume');
 canceled.payment.status='canceled';
 const stopped=await f.app.billing.resume(f.owner.accountId,canceled.orderId);
 assert.equal(stopped.order.state,'canceled');assert.equal(stopped.url,undefined);
 await assert.rejects(f.app.billing.checkout(f.owner.accountId,180,'canceled-resume','receipt@example.invalid'),/завершён/);
 const paid=await f.create(180,'paid-resume');paid.payment.status='succeeded';paid.payment.paid=true;
 const confirmed=await f.app.billing.resume(f.owner.accountId,paid.orderId);
 assert.equal(confirmed.order.state,'paid');assert.equal(confirmed.url,undefined);assert.equal(f.store.subscription(f.owner.accountId).active,true);
 await f.app.billing.resume(f.owner.accountId,paid.orderId);
 assert.equal(f.store.db.prepare('SELECT count(*) n FROM grants').get().n,1);
 f.store.confirmFullRefund({id:'fixture-refund',payment_id:paid.payment.id,status:'succeeded',amount:paid.payment.amount});
 const refunded=await f.app.billing.resume(f.owner.accountId,paid.orderId);assert.equal(refunded.order.state,'refunded');assert.equal(refunded.url,undefined);
 assert.equal(f.counts().posts,2);
});

test('missing, unsafe and expired payment links never create or expose another payment',async t=>{
 const f=await fixture(t);
 const unsafe=['https://yoomoney.ru.evil.invalid/checkout','https://user:password@yoomoney.ru/checkout','http://yoomoney.ru/checkout','javascript:alert(1)','https://yoomoney.ru:8443/checkout'];
 for(const [i,url] of unsafe.entries()){
  const created=await f.create(180,'unsafe-resume-'+i);created.payment.confirmation.confirmation_url=url;
  const result=await f.app.billing.resume(f.owner.accountId,created.orderId);assert.equal(result.resumeReason,'unsafe');assert.equal(result.url,undefined);
 }
 const missing=await f.create(180,'missing-resume');delete missing.payment.confirmation;
 f.store.db.prepare('UPDATE orders SET confirmation_url=NULL WHERE id=?').run(missing.orderId);
 const absent=await f.app.billing.resume(f.owner.accountId,missing.orderId);assert.equal(absent.resumeReason,'missing');assert.equal(absent.url,undefined);
 const expired=await f.create(180,'expired-resume');f.advance(3600001);
 const old=await f.app.billing.resume(f.owner.accountId,expired.orderId);assert.equal(old.resumeReason,'expired');assert.equal(old.url,undefined);
 const noPayment=f.app.cabinet.createOrder(f.owner.accountId,180,'no-provider-payment');
 assert.equal((await f.app.billing.resume(f.owner.accountId,noPayment.id)).resumeReason,'missing');
 assert.equal(f.counts().posts,unsafe.length+2);assert.equal(f.store.db.prepare('SELECT count(*) n FROM grants').get().n,0);
});

test('only a verified pending unpaid provider payment can be resumed',async t=>{
 const f=await fixture(t),created=await f.create(),original=structuredClone(created.payment);
 for(const change of [p=>p.status='waiting_for_capture',p=>p.paid=true,p=>delete p.paid,p=>p.expires_at='invalid-provider-time']){
  change(created.payment);const result=await f.app.billing.resume(f.owner.accountId,created.orderId);
  assert.equal(result.resumeReason,'unavailable');assert.equal(result.url,undefined);Object.assign(created.payment,structuredClone(original));
 }
 f.app.billing.reader=null;const unavailable=await f.app.billing.resume(f.owner.accountId,created.orderId);
 assert.equal(unavailable.resumeReason,'unavailable');assert.equal(unavailable.url,undefined);
 assert.equal(f.counts().posts,1);assert.equal(f.store.db.prepare('SELECT count(*) n FROM grants').get().n,0);
});

test('resume cannot read another account payment or unverified merchant, metadata or amount',async t=>{
 const f=await fixture(t),created=await f.create();const before=f.counts();
 await assert.rejects(f.app.billing.resume(f.other.accountId,created.orderId),/not found/);
 assert.deepEqual(f.counts(),before);
 for(const alter of [p=>p.metadata.product='another-product',p=>p.metadata.order_id='another-order',p=>p.amount.value='1.00',p=>p.recipient.account_id='another-shop']){
  const original=structuredClone(created.payment);alter(created.payment);
  await assert.rejects(f.app.billing.resume(f.owner.accountId,created.orderId));
  Object.assign(created.payment,original);
 }
 assert.equal(f.store.subscription(f.owner.accountId).active,false);
 assert.equal(f.counts().posts,1);
});

test('HTTP resume and check require current owner session, origin, CSRF and purchase eligibility',async t=>{
 const f=await fixture(t),created=await f.create();
 await new Promise(r=>f.app.server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+f.app.server.address().port+'/vpn/api/';
 const owner=f.app.users.newSession(f.owner.accountId),other=f.app.users.newSession(f.other.accountId);
 const request=(action,session=owner,extra={})=>fetch(base+'orders/'+created.orderId+'/'+action,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://family-spy.ru',Cookie:'vpn_session='+session.token,'X-CSRF-Token':session.csrf,...extra},body:JSON.stringify({days:30,price_minor:1,accountId:f.other.accountId})});
 assert.equal((await request('resume',owner,{Origin:'https://evil.invalid'})).status,403);
 assert.equal((await request('resume',owner,{'X-CSRF-Token':'wrong'})).status,403);
 assert.equal((await request('resume',owner,{Cookie:''})).status,401);
 const before=f.counts();assert.equal((await request('resume',other)).status,400);assert.deepEqual(f.counts(),before);
 const response=await request('resume');assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
 const data=await response.json();assert.deepEqual(data.order,{id:created.orderId,state:'pending',days:180,price_minor:140000});assert.equal(data.url,created.url);
 for(const secret of ['receipt_email','payment_id','request_key','confirmation_url','account_id'])assert.equal(Object.hasOwn(data.order,secret),false);
 const checked=await(await request('check')).json();assert.deepEqual(checked.order,data.order);assert.equal(checked.url,undefined);
 f.store.db.prepare('UPDATE identities SET must_change=1 WHERE account_id=?').run(f.owner.accountId);
 assert.equal((await request('resume')).status,403);
 f.store.db.prepare("UPDATE identities SET must_change=0,role='admin' WHERE account_id=?").run(f.owner.accountId);
 assert.equal((await request('resume')).status,409);
 f.store.db.prepare("UPDATE identities SET role='user' WHERE account_id=?").run(f.owner.accountId);
 f.store.db.prepare('UPDATE managed_subscriptions SET allow_unlimited=1 WHERE account_id=?').run(f.owner.accountId);
 assert.equal((await request('resume')).status,409);
 f.store.db.prepare('UPDATE managed_subscriptions SET allow_unlimited=0,deleted=1 WHERE account_id=?').run(f.owner.accountId);
 assert.equal((await request('resume')).status,409);
 assert.equal(f.counts().posts,1);
});

test('provider transport failures return retryable 503 while integrity failures remain 400',async t=>{
 const f=await fixture(t),created=await f.create();
 await new Promise(r=>f.app.server.listen(0,'127.0.0.1',r));
 const session=f.app.users.newSession(f.owner.accountId),base='http://127.0.0.1:'+f.app.server.address().port+'/vpn/api/orders/'+created.orderId+'/';
 const request=action=>fetch(base+action,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://family-spy.ru',Cookie:'vpn_session='+session.token,'X-CSRF-Token':session.csrf},body:'{}'});
 const original=f.app.billing.reader.request;
 for(const failure of [async()=>{throw new Error('synthetic timeout');},async()=>({ok:false}),async()=>({ok:true,json:async()=>{throw new SyntaxError('synthetic invalid JSON');}})]){
  f.app.billing.reader.request=failure;
  for(const action of ['check','resume']){
   const failed=await request(action);assert.equal(failed.status,503);
   assert.equal((await failed.json()).error,'Проверка платежа временно недоступна. Повтори позже.');
   assert.equal(f.store.order(f.owner.accountId,created.orderId).state,'pending');
  }
 }
 f.app.billing.reader.request=original;
 created.payment.recipient.account_id='wrong-merchant';assert.equal((await request('check')).status,400);assert.equal((await request('resume')).status,400);
 created.payment.recipient.account_id='fixture-shop';created.payment.status='succeeded';created.payment.paid=true;
 const recovered=await request('check');assert.equal(recovered.status,200);assert.equal((await recovered.json()).order.state,'paid');
 assert.equal((await request('check')).status,200);assert.equal(f.store.db.prepare('SELECT count(*) n FROM grants').get().n,1);assert.equal(f.counts().posts,1);
});
