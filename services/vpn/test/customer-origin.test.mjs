import {test} from 'node:test';
import assert from 'node:assert/strict';
import {VpnStore} from '../store.mjs';
import {createApp} from '../server.mjs';
import {Accounts} from '../auth.mjs';
import {Passkeys} from '../passkeys.mjs';
import {Billing} from '../billing.mjs';

const current='https://family-spy.ru',legacy='https://family-pie.ru';
test('existing identity signs in on both explicit origins; hostile/missing origins and CSRF are rejected',async t=>{
 const store=new VpnStore(':memory:');
 const app=createApp({store,origin:current,additionalOrigins:[legacy]});
 const account=await app.users.add({login:'origin-fixture',password:'LongFixturePassword123!'});
 store.db.prepare('UPDATE identities SET must_change=0 WHERE account_id=?').run(account.accountId);
 const identity=store.db.prepare('SELECT * FROM identities').all();
 const subscription=store.db.prepare('SELECT * FROM managed_subscriptions').all();
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 t.after(async()=>{await new Promise(r=>app.server.close(r));store.close();});
 const base='http://127.0.0.1:'+app.server.address().port+'/vpn/api/';
 const login=origin=>fetch(base+'login',{method:'POST',headers:{...(origin?{Origin:origin}:{}),'Content-Type':'application/json'},body:JSON.stringify({login:'origin-fixture',password:'LongFixturePassword123!'})});
 for(const origin of [current,legacy]){
  const response=await login(origin);assert.equal(response.status,200);
  const data=await response.json();assert.equal(data.user.account_id,account.accountId);
  const cookie=response.headers.get('set-cookie');assert.match(cookie,/Secure/);assert.match(cookie,/HttpOnly/);assert.doesNotMatch(cookie,/Domain=/);
  const denied=await fetch(base+'logout',{method:'POST',headers:{Origin:origin,Cookie:cookie.split(';')[0],'Content-Type':'application/json'},body:'{}'});
  assert.equal(denied.status,403);
 }
 for(const origin of ['https://evil.invalid',current+'.evil.invalid',null])assert.equal((await login(origin)).status,403);
 assert.deepEqual(store.db.prepare('SELECT * FROM identities').all(),identity);
 assert.deepEqual(store.db.prepare('SELECT * FROM managed_subscriptions').all(),subscription);
 assert.match(app.cabinet.friends(account.accountId).url,/^https:\/\/family-spy.ru\//);
});

test('legacy key records survive unchanged, new challenges bind to one origin, and old schema inserts still work',async t=>{
 const store=new VpnStore(':memory:');t.after(()=>store.close());const users=new Accounts(store);
 const account=await users.add({login:'key-origin-fixture'});
 const old=new Passkeys(store,users,legacy),fresh=new Passkeys(store,users,current);
 store.db.prepare('INSERT INTO passkeys VALUES(?,?,?,?,?,?,?)').run('old-key',account.accountId,Buffer.from('fixture'),0,'[]','Existing key',123);
 const before=store.db.prepare('SELECT * FROM passkeys').all();
 assert.equal(old.list(account.accountId)[0].rp_id,'family-pie.ru');
 const challenge=await fresh.options();assert.equal(challenge.options.rpId,'family-spy.ru');
 assert.throws(()=>old.take(challenge.challengeId,'login'),/устарел/);
 assert.equal(fresh.take(challenge.challengeId,'login'),challenge.options.challenge);
 assert.throws(()=>fresh.take(challenge.challengeId,'login'),/устарел/);
 assert.equal(store.db.prepare('SELECT count(*) n FROM passkey_challenge_sites').get().n,0);
 assert.deepEqual(store.db.prepare('SELECT * FROM passkeys').all(),before);
});

test('new provider checkout returns to customer cabinet without changing price, metadata or granting unpaid access',async t=>{
 const store=new VpnStore(':memory:',{plans:[{days:30,priceMinor:30000,devices:0}]});t.after(()=>store.close());
 const users=new Accounts(store),account=await users.add({login:'payment-origin-fixture'});let payload;
 const billing=new Billing(store,{origin:current,shopId:'fixture',secret:'FICTIONAL',request:async(_url,options)=>{
  payload=JSON.parse(options.body);return {ok:true,json:async()=>({id:'fixture-payment',confirmation:{confirmation_url:'https://yoomoney.ru/fixture'}})};
 }});
 const result=await billing.checkout(account.accountId,30,'request-fixture','receipt@example.invalid');
 assert.equal(payload.confirmation.return_url,current+'/vpn/cabinet/#plans?order='+result.orderId);
 assert.equal(payload.amount.value,'300.00');assert.equal(payload.metadata.product,'family-vpn');
 assert.equal(store.subscription(account.accountId).active,false);
});
