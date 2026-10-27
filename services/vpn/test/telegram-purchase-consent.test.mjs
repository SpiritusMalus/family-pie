import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {VpnStore} from '../store.mjs';
import {Accounts} from '../auth.mjs';
import {TelegramStore} from '../telegram.mjs';
import {TelegramCommerce,TELEGRAM_STARS_TERMS} from '../telegram-commerce.mjs';

const CHAT=1001,OTHER=1002;
function domain(path=':memory:'){
 let now=Date.UTC(2026,9,27);const clock=()=>now,store=new VpnStore(path,{clock}),users=new Accounts(store,{clock}),telegram=new TelegramStore(store,{clock});
 const commerce=new TelegramCommerce(store,{users,clock,stars:{enabled:true,approved:true,plans:[{days:30,stars:150},{days:90,stars:400}]}});
 return {store,users,telegram,commerce,advance:ms=>now+=ms};
}
function fixture(t){const f=domain();t.after(()=>f.store.close());return f;}
function accept(f,key='purchase-request',days=30){const offer=f.commerce.preparePurchase(CHAT,days,key);f.commerce.acceptPurchase(CHAT,offer.token);return offer;}
function invoice(f,key='purchase-request',days=30){const offer=accept(f,key,days);return {offer,invoice:f.commerce.invoice(CHAT,days,key,offer.token)};}
function checkout(data,id='precheckout-consent'){return {id,from:{id:CHAT},invoice_payload:data.payload,currency:'XTR',total_amount:data.prices[0].amount};}
function payment(data){return {chat:{id:CHAT,type:'private'},from:{id:CHAT},successful_payment:{invoice_payload:data.payload,currency:'XTR',total_amount:data.prices[0].amount,telegram_payment_charge_id:'synthetic-consent-charge'}};}

test('signup acceptance never substitutes for a current explicit purchase consent bound to one invoice',t=>{
 const f=fixture(t),c=f.commerce;c.ensure(CHAT,{acceptedTerms:true});
 assert.equal(f.store.db.prepare('SELECT count(*) n FROM telegram_purchase_consents').get().n,0);
 assert.throws(()=>c.invoice(CHAT,30,'purchase-request'),/прими условия/);
 const offer=c.preparePurchase(CHAT,30,'purchase-request');assert.equal(offer.stars,150);assert.equal(offer.version,TELEGRAM_STARS_TERMS.version);assert.match(offer.termsUrl,/\/vpn\/terms\/$/);assert.match(offer.privacyUrl,/\/vpn\/privacy\/$/);
 assert.equal(f.store.db.prepare('SELECT count(*) n FROM orders').get().n,0);assert.throws(()=>c.invoice(CHAT,30,'purchase-request',offer.token),/прими условия/);
 c.acceptPurchase(CHAT,offer.token);const accepted=f.store.db.prepare('SELECT accepted_at FROM telegram_purchase_consents').get().accepted_at;f.advance(1000);c.acceptPurchase(CHAT,offer.token);
 assert.equal(f.store.db.prepare('SELECT accepted_at FROM telegram_purchase_consents').get().accepted_at,accepted);
 const first=c.invoice(CHAT,30,'purchase-request',offer.token);assert.deepEqual(c.invoice(CHAT,30,'purchase-request',offer.token),first);
 const row=f.store.db.prepare('SELECT * FROM telegram_purchase_consents').get();assert.equal(row.order_id,f.store.db.prepare('SELECT id FROM orders').get().id);assert.equal(row.terms_version,TELEGRAM_STARS_TERMS.version);assert.equal(row.terms_json,JSON.stringify(TELEGRAM_STARS_TERMS));assert.match(row.terms_hash,/^[a-f0-9]{64}$/);assert.ok(!JSON.stringify(row).includes(offer.token));
 assert.equal(f.store.db.prepare('SELECT count(*) n FROM orders').get().n,1);assert.equal(f.store.db.prepare('SELECT count(*) n FROM grants').get().n,0);
 assert.throws(()=>c.invoice(CHAT,90,'purchase-request',offer.token),/условия/);assert.throws(()=>c.invoice(CHAT,30,'another-request',offer.token),/условия/);
});

test('returning confirmed website accounts must accept purchase terms without creating a Telegram-native account',async t=>{
 const f=fixture(t),a=await f.users.add({login:'returning-consent-fixture'});f.store.db.prepare('UPDATE identities SET must_change=0 WHERE account_id=?').run(a.accountId);
 const session=f.users.newSession(a.accountId),sessionHash=f.users.session(session.token).token_hash,nonce=f.telegram.issue(a.accountId,sessionHash);f.telegram.candidate(nonce,String(CHAT),null);f.telegram.confirm(a.accountId,sessionHash);
 assert.throws(()=>f.commerce.invoice(CHAT,30,'purchase-request'),/прими условия/);const result=invoice(f);assert.equal(result.invoice.prices[0].amount,150);
 assert.equal(f.store.db.prepare('SELECT count(*) n FROM telegram_native_accounts').get().n,0);assert.equal(f.store.db.prepare('SELECT account_id FROM telegram_purchase_consents').get().account_id,a.accountId);
});

test('purchase proof rejects other actors, changed bindings, expired quotes and altered terms without creating orders',t=>{
 for(const scenario of ['other-chat','rebind','expired','version','snapshot','hash']){
  const f=fixture(t),c=f.commerce;c.ensure(CHAT,{acceptedTerms:true});c.ensure(OTHER,{acceptedTerms:true});const offer=c.preparePurchase(CHAT,30,'purchase-request');
  if(scenario==='rebind')f.store.db.prepare("UPDATE telegram_links SET generation='new-binding' WHERE chat_id=?").run(String(CHAT));
  if(scenario==='expired')f.advance(600001);
  if(['version','snapshot','hash'].includes(scenario)){const field={version:'terms_version',snapshot:'terms_json',hash:'terms_hash'}[scenario];f.store.db.prepare('UPDATE telegram_purchase_consents SET '+field+"='outdated'").run();}
  assert.throws(()=>c.acceptPurchase(scenario==='other-chat'?OTHER:CHAT,offer.token),e=>e.code==='INVALID_PAYMENT',scenario);assert.equal(f.store.db.prepare('SELECT count(*) n FROM orders').get().n,0,scenario);assert.equal(f.store.db.prepare('SELECT accepted_at FROM telegram_purchase_consents').get().accepted_at,null,scenario);
 }
});

test('catalogue changes invalidate unissued quotes but issued orders retain their immutable price and proof',t=>{
 const f=fixture(t),c=f.commerce;c.ensure(CHAT,{acceptedTerms:true});const quote=accept(f);c.starPlans.set(30,{days:30,stars:175});
 assert.throws(()=>c.invoice(CHAT,30,'purchase-request',quote.token),/Цена изменилась/);assert.equal(f.store.db.prepare('SELECT count(*) n FROM orders').get().n,0);
 const next=invoice(f);assert.equal(next.invoice.prices[0].amount,175);c.starPlans.set(30,{days:30,stars:200});f.advance(600001);
 assert.deepEqual(c.invoice(CHAT,30,'purchase-request',next.offer.token),next.invoice);assert.equal(c.preCheckout(checkout(next.invoice)).ok,true);
 const reaccept=accept(f);assert.equal(reaccept.stars,175);assert.deepEqual(c.invoice(CHAT,30,'purchase-request',reaccept.token),next.invoice);assert.equal(f.store.db.prepare('SELECT count(*) n FROM orders').get().n,1);
});

test('pre-checkout requires matching current durable terms even after invoice delivery',t=>{
 const f=fixture(t),c=f.commerce;c.ensure(CHAT,{acceptedTerms:true});const data=invoice(f).invoice;
 f.store.db.prepare("UPDATE telegram_purchase_consents SET terms_version='previous-version'").run();const denied=c.preCheckout(checkout(data));assert.equal(denied.ok,false);assert.match(denied.error_message,/подтверди условия/);assert.equal(f.store.db.prepare('SELECT precheckout_id FROM telegram_orders').get().precheckout_id,null);
 const fresh=accept(f);assert.deepEqual(c.invoice(CHAT,30,'purchase-request',fresh.token),data);assert.equal(c.preCheckout(checkout(data)).ok,true);
 f.store.db.prepare("UPDATE telegram_links SET generation='replaced-after-invoice' WHERE chat_id=?").run(String(CHAT));assert.equal(c.preCheckout(checkout(data)).ok,false);assert.equal(f.store.db.prepare('SELECT count(*) n FROM grants').get().n,0);
});

test('unused offers are bounded and rotated while expired order-linked acceptance evidence is retained',t=>{
 const f=fixture(t),c=f.commerce;c.ensure(CHAT,{acceptedTerms:true});const issued=invoice(f),old=c.preparePurchase(CHAT,30,'rotated-request'),next=c.preparePurchase(CHAT,30,'rotated-request');
 assert.notEqual(old.token,next.token);assert.throws(()=>c.acceptPurchase(CHAT,old.token),/прими условия/);
 for(let i=0;i<4;i++)c.preparePurchase(CHAT,30,'bounded-request-'+i);assert.throws(()=>c.preparePurchase(CHAT,30,'bounded-overflow'),/10 минут/);
 assert.equal(f.store.db.prepare('SELECT count(*) n FROM telegram_purchase_consents WHERE order_id IS NULL').get().n,5);f.advance(600001);c.preparePurchase(CHAT,30,'after-expiry-request');
 assert.equal(f.store.db.prepare('SELECT count(*) n FROM telegram_purchase_consents WHERE order_id IS NULL').get().n,1);assert.equal(f.store.db.prepare('SELECT count(*) n FROM telegram_purchase_consents WHERE order_id IS NOT NULL').get().n,1);assert.deepEqual(c.invoice(CHAT,30,'purchase-request',issued.offer.token),issued.invoice);
});

test('additive migration does not accept legacy pending invoices or change legacy rows; late financial events remain valid',t=>{
 const f=fixture(t),c=f.commerce;c.ensure(CHAT,{acceptedTerms:true});const data=invoice(f).invoice;assert.equal(c.preCheckout(checkout(data)).ok,true);
 const before={orders:f.store.db.prepare('SELECT * FROM orders').all(),identities:f.store.db.prepare('SELECT * FROM identities').all(),native:f.store.db.prepare('SELECT * FROM telegram_native_accounts').all()};
 // Simulate a database created before purchase-consent schema existed.
 f.store.db.exec('DROP TABLE telegram_purchase_consents');const migrated=new TelegramCommerce(f.store,{users:f.users,stars:{enabled:true,approved:true,plans:[{days:30,stars:150}]}});
 assert.equal(f.store.db.prepare('SELECT count(*) n FROM telegram_purchase_consents').get().n,0);for(const [table,rows] of Object.entries(before))assert.deepEqual(f.store.db.prepare('SELECT * FROM '+({native:'telegram_native_accounts'}[table]||table)).all(),rows);
 assert.equal(migrated.preCheckout(checkout(data)).ok,false);migrated.enabled=false;
 assert.equal(migrated.successfulPayment(payment(data)).duplicate,false);assert.equal(migrated.successfulPayment(payment(data)).duplicate,true);
 const refund={...payment(data),refunded_payment:payment(data).successful_payment};delete refund.successful_payment;assert.equal(migrated.refundedPayment(refund).duplicate,false);assert.equal(f.store.db.prepare('SELECT reversed FROM grants').get().reversed,1);
});

test('accepted purchase survives process reopening and consent/order mutations roll back with the surrounding update',t=>{
 const dir=mkdtempSync(join(tmpdir(),'telegram-consent-')),path=join(dir,'sandbox.sqlite');let f=domain(path);f.commerce.ensure(CHAT,{acceptedTerms:true});const offer=f.commerce.preparePurchase(CHAT,30,'purchase-request');
 assert.throws(()=>f.store.transaction(()=>{f.commerce.acceptPurchase(CHAT,offer.token);throw new Error('offset failed');}),/offset failed/);assert.equal(f.store.db.prepare('SELECT accepted_at FROM telegram_purchase_consents').get().accepted_at,null);
 f.commerce.acceptPurchase(CHAT,offer.token);f.store.close();f=domain(path);t.after(()=>{f.store.close();rmSync(dir,{recursive:true,force:true});});
 assert.throws(()=>f.store.transaction(()=>{f.commerce.invoice(CHAT,30,'purchase-request',offer.token);throw new Error('offset failed');}),/offset failed/);assert.equal(f.store.db.prepare('SELECT count(*) n FROM orders').get().n,0);assert.equal(f.store.db.prepare('SELECT order_id FROM telegram_purchase_consents').get().order_id,null);
 assert.equal(f.commerce.invoice(CHAT,30,'purchase-request',offer.token).prices[0].amount,150);assert.equal(f.store.db.prepare('SELECT count(*) n FROM orders').get().n,1);
});
