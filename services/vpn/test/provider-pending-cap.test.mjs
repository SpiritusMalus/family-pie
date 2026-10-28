import {test} from 'node:test';
import assert from 'node:assert/strict';
import {VpnStore} from '../store.mjs';
import {createApp} from '../server.mjs';

async function fixture(t){
 const store=new VpnStore(':memory:',{plans:[{days:30,priceMinor:30000,devices:0}]}),calls=[];
 const app=createApp({store,origin:'https://family-spy.ru',secure:false,starsConfig:{enabled:true,approved:true,plans:[{days:30,stars:300}]},paymentConfig:{shopId:'fixture-shop',secret:'FICTIONAL_ONLY',testMode:true,request:async(url,options)=>{
  assert.equal(url,'https://api.yookassa.ru/v3/payments');assert.equal(options.method,'POST');const body=JSON.parse(options.body);calls.push(body);return {ok:true,json:async()=>({id:'fixture-yoo-'+calls.length,confirmation:{confirmation_url:'https://yoomoney.ru/checkout/fixture-'+calls.length}})};
 }}});
 t.after(async()=>{if(app.server.listening)await new Promise(resolve=>app.server.close(resolve));store.close();});
 const identity=app.commerce.ensure(1001,{acceptedTerms:true}),accountId=identity.account_id,session=app.users.newSession(accountId,{method:'telegram'});
 // An independent, already-confirmed purchase must survive every pending-order check.
 const paid=store.createOrder(accountId,30,'fixture-already-paid');store.bindPayment(accountId,paid.id,'fixture-paid-charge');store.confirmPayment({id:'fixture-paid-charge',status:'succeeded',paid:true,test:true,metadata:{order_id:paid.id},amount:{currency:'RUB',value:'300.00'}});
 const preserved=()=>({grants:store.db.prepare('SELECT * FROM grants ORDER BY order_id').all(),paid:store.order(accountId,paid.id),revision:store.account(accountId).revision});const before=preserved();
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+app.server.address().port+'/vpn/api/checkout';
 const checkout=key=>fetch(url,{method:'POST',headers:{Origin:'https://family-spy.ru','Content-Type':'application/json',Cookie:'vpn_session='+session.token,'X-CSRF-Token':session.csrf},body:JSON.stringify({days:30,requestKey:key,email:'fixture@example.invalid'})});
 const stars=key=>{const offer=app.commerce.preparePurchase(1001,30,key);app.commerce.acceptPurchase(1001,offer.token);return app.commerce.invoice(1001,30,key,offer.token);};
 return {store,app,accountId,calls,checkout,stars,preserved,before};
}

test('five abandoned Stars invoices do not block a new website RUB checkout or change paid grants',async t=>{
 const f=await fixture(t);for(let i=0;i<5;i++)f.stars('fixture-stars-'+i);
 assert.equal(f.store.db.prepare("SELECT count(*) n FROM orders WHERE provider='telegram-stars' AND state='pending'").get().n,5);
 const response=await f.checkout('fixture-web-after-stars');assert.equal(response.status,200);assert.match((await response.json()).url,/^https:\/\/yoomoney\.ru\//);assert.equal(f.calls.length,1);assert.deepEqual(f.calls[0].amount,{value:'300.00',currency:'RUB'});
 assert.equal(f.store.db.prepare("SELECT count(*) n FROM orders WHERE provider='yookassa' AND currency='RUB' AND state='pending'").get().n,1);assert.deepEqual(f.preserved(),f.before);
 // The original Stars hourly pending-invoice limit remains independent and enforced.
 assert.throws(()=>f.stars('fixture-stars-over-limit'),/предыдущий заказ/);assert.deepEqual(f.preserved(),f.before);
});

test('five own pending YooKassa orders still rate-limit new website orders while another account is isolated',async t=>{
 const f=await fixture(t),other=f.app.commerce.ensure(1002,{acceptedTerms:true});for(let i=0;i<5;i++)f.store.createOrder(other.account_id,30,'fixture-other-pending-'+i);
 for(let i=0;i<5;i++)assert.equal((await f.checkout('fixture-web-'+i)).status,200);
 assert.equal(f.calls.length,5);const blocked=await f.checkout('fixture-web-over-limit');assert.equal(blocked.status,429);assert.equal(f.calls.length,5);
 // An idempotent request for an already-owned order remains resumable at the cap.
 f.app.billing.resume=async(accountId,id)=>({order:f.store.order(accountId,id),url:'https://yoomoney.ru/checkout/fixture-resume'});
 assert.equal((await f.checkout('fixture-web-0')).status,200);assert.equal(f.calls.length,5);
 assert.deepEqual(f.preserved(),f.before);
 assert.equal((await f.checkout('fixture-still-own-cap')).status,429);assert.deepEqual(f.preserved(),f.before);
});
