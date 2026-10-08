import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VpnStore } from '../store.mjs';
import { YooKassaReader } from '../yookassa.mjs';
const DAY=86_400_000;
function fixture(t) {
  let now=1_700_000_000_000;
  const store=new VpnStore(':memory:',{clock:()=>now,plans:[{days:30,priceMinor:10000,devices:2},{days:90,priceMinor:25000,devices:2}]});
  t.after(()=>store.close());
  const user=store.createAccount('test@example.invalid');
  function payment(days=30,key='request-one') {
    const order=store.createOrder(user.id,days,key); store.bindPayment(user.id,order.id,'pay-'+order.id);
    return { id:'pay-'+order.id,status:'succeeded',paid:true,test:true,metadata:{order_id:order.id},amount:{currency:'RUB',value:(order.price_minor/100).toFixed(2)} };
  }
  return {store,user,payment,advance:x=>{now+=x},time:()=>now};
}
test('without approved tariff no order or entitlement exists',t=>{
 const s=new VpnStore(':memory:');t.after(()=>s.close());const a=s.createAccount('user@example.invalid');
 assert.throws(()=>s.createOrder(a.id,30,'request-one'),/unavailable/);assert.equal(s.subscription(a.id).active,false);
});
test('retry checkout returns same immutable order; reused key cannot change period',t=>{
 const {store,user}=fixture(t);const a=store.createOrder(user.id,30,'same-request');
 assert.equal(store.createOrder(user.id,30,'same-request').id,a.id);
 assert.throws(()=>store.createOrder(user.id,90,'same-request'),/already used/);
 store.plans.set('30',{days:30,priceMinor:99000,devices:8});
 assert.equal(store.createOrder(user.id,30,'same-request').price_minor,10000);
});
test('payment is bound to exactly one order',t=>{
 const {store,user}=fixture(t);const a=store.createOrder(user.id,30,'request-one'),b=store.createOrder(user.id,30,'request-two');
 store.bindPayment(user.id,a.id,'provider-id');assert.throws(()=>store.bindPayment(user.id,b.id,'provider-id'));
 assert.throws(()=>store.bindPayment(user.id,a.id,'other-provider-id'),/already bound/);
});
test('repeated successful notification creates one grant and one provisioning job',t=>{
 const {store,user,payment,time}=fixture(t);const p=payment();const first=store.confirmPayment(p);
 assert.equal(first.expiresAt,time()+30*DAY);assert.equal(store.confirmPayment(p).expiresAt,first.expiresAt);
 assert.equal(store.db.prepare('SELECT COUNT(*) n FROM grants').get().n,1);
 assert.equal(store.db.prepare('SELECT COUNT(*) n FROM jobs').get().n,1);
 assert.equal(store.subscription(user.id).devices,0);
});
test('renewal extends remaining days and retains same profile identity',t=>{
 const {store,payment,advance}=fixture(t);const a=store.confirmPayment(payment());advance(10*DAY);
 const b=store.confirmPayment(payment(90,'request-two'));assert.equal(b.expiresAt,a.expiresAt+90*DAY);
 assert.equal(a.profileRef,b.profileRef);
});
test('expired subscription starts new period from confirmed payment time',t=>{
 const {store,payment,advance,time}=fixture(t);store.confirmPayment(payment());advance(40*DAY);
 assert.equal(store.confirmPayment(payment(30,'request-two')).expiresAt,time()+30*DAY);
});
for (const [name,patch] of [
 ['wrong amount',{amount:{value:'99.99',currency:'RUB'}}],['wrong currency',{amount:{value:'100.00',currency:'USD'}}],
 ['pending',{status:'pending'}],['not captured',{paid:false}],['live/test mismatch',{test:false}],
 ['wrong order',{metadata:{order_id:'other-order'}}],['missing test mode',{test:undefined}]
]) test(`reject ${name} without changing subscription or job queue`,t=>{
 const {store,user,payment}=fixture(t);assert.throws(()=>store.confirmPayment({...payment(),...patch}),/verification failed/);
 assert.equal(store.subscription(user.id).active,false);assert.equal(store.db.prepare('SELECT COUNT(*) n FROM jobs').get().n,0);
});
test('unknown payment cannot purchase any account',t=>{
 const {store,payment}=fixture(t);assert.throws(()=>store.confirmPayment({...payment(),id:'unknown'}),/Unknown/);
});
test('full refund is idempotent; delayed success cannot restore canceled grant',t=>{
 const {store,user,payment}=fixture(t);const p=payment();store.confirmPayment(p);
 const refund={id:'refund-one',payment_id:p.id,status:'succeeded',amount:p.amount};
 const a=store.confirmFullRefund(refund);assert.equal(a.active,false);
 assert.equal(store.confirmFullRefund(refund).revision,a.revision);
 assert.equal(store.confirmPayment(p).active,false);assert.equal(store.subscription(user.id).active,false);
});
test('partial/unconfirmed refund fails closed, preserving paid access',t=>{
 const {store,payment}=fixture(t);const p=payment();store.confirmPayment(p);
 assert.throws(()=>store.confirmFullRefund({id:'r',payment_id:p.id,status:'succeeded',amount:{value:'1.00',currency:'RUB'}}));
 assert.throws(()=>store.confirmFullRefund({id:'r',payment_id:p.id,status:'pending',amount:p.amount}));
});
test('refund removes only refunded grant, preserving later renewal',t=>{
 const {store,payment,time}=fixture(t);const p=payment();store.confirmPayment(p);store.confirmPayment(payment(90,'request-two'));
 const s=store.confirmFullRefund({id:'r',payment_id:p.id,status:'succeeded',amount:p.amount});assert.equal(s.expiresAt,time()+90*DAY);
});
test('another account cannot read order/ticket or bind payment',t=>{
 const {store,user}=fixture(t);const other=store.createAccount('other@example.invalid');const order=store.createOrder(user.id,30,'request-one');
 const ticket=store.createTicket(user.id,'Connection test');assert.throws(()=>store.order(other.id,order.id),/not found/);
 assert.throws(()=>store.ticket(other.id,ticket.id),/not found/);assert.throws(()=>store.bindPayment(other.id,order.id,'p'),/not found/);
});
test('provisioning job survives failure and stale lease cannot complete newer attempt',t=>{
 const {store,payment,advance}=fixture(t);store.confirmPayment(payment());const a=store.claimJob({leaseMs:1000});
 assert.equal(store.claimJob(),null);advance(1001);const b=store.claimJob();assert.equal(a.id,b.id);
 assert.equal(b.attempts,2);assert.throws(()=>store.finishJob(a.id,a.attempts),/lease lost/);
 store.finishJob(b.id,b.attempts);assert.equal(store.claimJob(),null);
});
test('old provisioning job indicates superseded revision after refund',t=>{
 const {store,payment}=fixture(t);const p=payment();store.confirmPayment(p);
 store.confirmFullRefund({id:'r',payment_id:p.id,status:'succeeded',amount:p.amount});
 const job=store.claimJob();assert.equal(job.superseded,true);assert.equal(job.current.active,false);
});
test('provider adapter re-fetches fixed authenticated endpoint; forged webhook cannot grant access',async t=>{
 const {store,user,payment}=fixture(t);const p=payment();let url,options;
 const reader=new YooKassaReader({shopId:'test-shop',secret:'test-fixture-secret',request:async(u,o)=>{
  url=u;options=o;return {ok:true,json:async()=>({...p,status:'pending',recipient:{account_id:'test-shop'}})};
 }});
 await assert.rejects(reader.confirmPayment(store,p.id));assert.equal(store.subscription(user.id).active,false);
 assert.ok(url.startsWith('https://api.yookassa.ru/v3/payments/'));assert.equal(options.redirect,'error');
 assert.ok(options.headers.Authorization.startsWith('Basic '));assert.ok(options.signal);
});
for(const patch of [{recipient:{account_id:'wrong-shop'}},{test:false},{id:'other-payment'}])
 test('provider reader rejects merchant, mode or ID mismatch',async t=>{
  const {store,payment}=fixture(t);const p=payment();const reader=new YooKassaReader({shopId:'test-shop',secret:'fixture',request:async()=>({ok:true,json:async()=>({...p,recipient:{account_id:'test-shop'},...patch})})});
  await assert.rejects(reader.confirmPayment(store,p.id));
 });
test('provider failure is retryable and changes no access',async t=>{
 const {store,user,payment}=fixture(t);const p=payment();const reader=new YooKassaReader({shopId:'test-shop',secret:'fixture',request:async()=>({ok:false})});
 await assert.rejects(reader.confirmPayment(store,p.id),/unavailable/);assert.equal(store.subscription(user.id).active,false);
});

test('failed job insert rolls back payment and grant atomically',t=>{
 const {store,user,payment}=fixture(t);const p=payment();
 store.db.exec("CREATE TRIGGER fail_job BEFORE INSERT ON jobs BEGIN SELECT RAISE(ABORT,'fixture failure'); END;");
 assert.throws(()=>store.confirmPayment(p),/fixture failure/);
 assert.equal(store.subscription(user.id).active,false);
 assert.equal(store.db.prepare('SELECT state FROM orders WHERE payment_id=?').get(p.id).state,'pending');
 store.db.exec('DROP TRIGGER fail_job');assert.equal(store.confirmPayment(p).active,true);
});
test('state and idempotency survive restart in private database',async t=>{
 const {mkdtempSync,rmSync,statSync}=await import('node:fs');
 const {tmpdir}=await import('node:os');const {join}=await import('node:path');
 const dir=mkdtempSync(join(tmpdir(),'family-vpn-core-test-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const path=join(dir,'service.sqlite');const options={plans:[{days:30,priceMinor:10000,devices:2}],clock:()=>1_700_000_000_000};
 let s=new VpnStore(path,options);const a=s.createAccount('restore@example.invalid');
 const o=s.createOrder(a.id,30,'restore-request');s.bindPayment(a.id,o.id,'restore-payment');
 const p={id:'restore-payment',status:'succeeded',paid:true,test:true,metadata:{order_id:o.id},amount:{value:'100.00',currency:'RUB'}};
 const first=s.confirmPayment(p);s.close();assert.equal(statSync(path).mode&0o777,0o600);
 s=new VpnStore(path,options);t.after(()=>s.close());
 assert.equal(s.confirmPayment(p).expiresAt,first.expiresAt);assert.equal(s.createOrder(a.id,30,'restore-request').id,o.id);
 assert.equal(s.claimJob().current.profileRef,first.profileRef);
});
test('provider refund verification rechecks the originating merchant payment',async t=>{
 const {store,user,payment}=fixture(t);const p=payment();store.confirmPayment(p);const fetched=[];
 const reader=new YooKassaReader({shopId:'test-shop',secret:'fixture',request:async u=>{
  fetched.push(u);return {ok:true,json:async()=>u.includes('/refunds/') ? {id:'refund-id',payment_id:p.id,status:'succeeded',amount:p.amount} : {...p,recipient:{account_id:'test-shop'}}};
 }});
 await reader.confirmRefund(store,'refund-id');assert.equal(fetched.length,2);assert.equal(store.subscription(user.id).active,false);
});
test('invalid refund identifier cannot revoke a paid grant',t=>{
 const {store,user,payment}=fixture(t);const p=payment();store.confirmPayment(p);
 assert.throws(()=>store.confirmFullRefund({id:'',payment_id:p.id,status:'succeeded',amount:p.amount}),/Invalid/);
 assert.equal(store.subscription(user.id).active,true);
});
