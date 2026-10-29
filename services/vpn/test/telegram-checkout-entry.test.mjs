import {test} from 'node:test';
import assert from 'node:assert/strict';
import {VpnStore} from '../store.mjs';
import {createApp} from '../server.mjs';

const origin='https://family-spy.ru';
const plans=[30,90,180,365].map(days=>({days,priceMinor:days*1000,devices:0}));
async function fixture(t){
 let providerCalls=0;
 const store=new VpnStore(':memory:'),app=createApp({store,origin,secure:false,botUsername:'fictional_checkout_bot',paymentConfig:{shopId:'fictional',secret:'FICTIONAL',request:async()=>{providerCalls++;throw new Error('No provider call is expected during an entry handoff');}}});
 app.cabinet.setPlans(plans);
 const identity=app.commerce.ensure(123,{acceptedTerms:true});
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{await new Promise(resolve=>app.server.close(resolve));store.close();});
 const base='http://127.0.0.1:'+app.server.address().port+'/vpn/api/';
 const post=(path,data,headers={})=>fetch(base+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...headers},body:JSON.stringify(data)});
 const entry=options=>new URLSearchParams(new URL(app.commerce.handoff(123,options)).hash.slice(1)).get('telegram');
 const noPurchase=()=>{
  for(const table of ['orders','grants','jobs','telegram_purchase_consents'])assert.equal(store.db.prepare('SELECT count(*) n FROM '+table).get().n,0,table+' must remain empty');
  assert.equal(providerCalls,0);
 };
 return {store,app,identity,post,entry,noPurchase};
}

test('HTTP checkout preview and explicit login return the stored term while ignoring caller redirect/payment hints',async t=>{
 const f=await fixture(t);
 for(const period of [30,90,180,365]){
  const token=f.entry({target:'plans',period,device:'macos'}),sessions=f.store.db.prepare('SELECT count(*) n FROM sessions').get().n;
  const injected={token,target:'https://evil.invalid',period:period===30?365:30,device:'tv',next:'//evil.invalid',paid:true};
  const preview=await f.post('telegram/login/preview?period=365&next=https://evil.invalid',injected);
  assert.equal(preview.status,200);assert.equal(preview.headers.get('set-cookie'),null);assert.equal(preview.headers.get('cache-control'),'no-store');assert.equal(preview.headers.get('referrer-policy'),'no-referrer');
  assert.deepEqual(await preview.json(),{login:f.identity.login,device:'macos',target:'plans',period});
  assert.equal(f.store.db.prepare('SELECT count(*) n FROM sessions').get().n,sessions);f.noPurchase();
  const response=await f.post('telegram/login?target=devices&period=30',injected);
  assert.equal(response.status,200);assert.equal(response.headers.get('location'),null);assert.equal(response.headers.get('cache-control'),'no-store');
  const result=await response.json();assert.equal(result.user.account_id,f.identity.account_id);assert.equal(result.target,'plans');assert.equal(result.period,period);assert.equal(result.device,'macos');
  assert.ok(result.csrf);assert.match(response.headers.get('set-cookie'),/HttpOnly/);
  assert.equal((await f.post('telegram/login',{token})).status,400);f.noPurchase();
 }
});

test('checkout handoff cannot replace a different account session or burn the token on conflict',async t=>{
 const f=await fixture(t),other=f.app.commerce.ensure(456,{acceptedTerms:true});
 const otherSession=f.app.users.newSession(other.account_id,{method:'telegram'}),cookie='vpn_session='+otherSession.token,token=f.entry({target:'plans',period:90});
 const before=f.store.db.prepare('SELECT count(*) n FROM sessions').get().n;
 for(const path of ['telegram/login/preview','telegram/login']){
  const response=await f.post(path,{token,target:'devices',period:30},{Cookie:cookie});
  assert.equal(response.status,409);assert.equal(response.headers.get('set-cookie'),null);assert.match((await response.json()).error,/другой аккаунт/);
 }
 assert.equal(f.app.users.session(otherSession.token).account_id,other.account_id);assert.equal(f.store.db.prepare('SELECT count(*) n FROM sessions').get().n,before);
 const rightful=f.app.users.newSession(f.identity.account_id,{method:'telegram'});
 const response=await f.post('telegram/login',{token},{Cookie:'vpn_session='+rightful.token});assert.equal(response.status,200);assert.equal((await response.json()).period,90);f.noPurchase();
});

test('removed checkout terms are rejected before session creation without consuming the recoverable intent',async t=>{
 const f=await fixture(t),token=f.entry({target:'plans',period:180});f.app.cabinet.setPlans(plans.filter(plan=>plan.days!==180));
 const before=f.store.db.prepare('SELECT count(*) n FROM sessions').get().n;
 for(const path of ['telegram/login/preview','telegram/login']){
  const response=await f.post(path,{token,period:30});assert.equal(response.status,400);assert.equal(response.headers.get('set-cookie'),null);
 }
 assert.equal(f.store.db.prepare('SELECT count(*) n FROM sessions').get().n,before);f.noPurchase();
 f.app.cabinet.setPlans(plans);const response=await f.post('telegram/login',{token});assert.equal(response.status,200);assert.equal((await response.json()).period,180);f.noPurchase();
});

test('ordinary device handoffs keep their default destination and never promote query hints into a purchase',async t=>{
 const f=await fixture(t),token=f.entry({device:'ios'});
 const preview=await f.post('telegram/login/preview',{token,target:'plans',period:365});assert.equal(preview.status,200);
 assert.deepEqual(await preview.json(),{login:f.identity.login,device:'ios',target:'devices',period:null});
 const response=await f.post('telegram/login?target=plans&period=365',{token,target:'plans',period:365});assert.equal(response.status,200);
 const result=await response.json();assert.equal(result.target,'devices');assert.equal(result.period,null);assert.equal(result.device,'ios');f.noPurchase();
});
