import {test} from 'node:test';
import assert from 'node:assert/strict';
import {VpnStore} from '../store.mjs';
import {createApp} from '../server.mjs';
const origin='https://family-spy.ru';
test('onboarding accepts authenticated CSRF enum events only and stores daily aggregates without identities or URLs',async t=>{
 const store=new VpnStore(':memory:'),app=createApp({store,origin});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>app.server.close(r));store.close();});
 const account=app.commerce.ensure(123,{acceptedTerms:true}),session=app.users.newSession(account.account_id,{method:'telegram'}),base='http://127.0.0.1:'+app.server.address().port+'/vpn/api/onboarding/events';
 const post=(body,{authenticated=true,csrf=session.csrf,requestOrigin=origin}={})=>fetch(base,{method:'POST',headers:{Origin:requestOrigin,'Content-Type':'application/json',...(authenticated?{Cookie:'vpn_session='+session.token,'X-CSRF-Token':csrf}:{})},body:JSON.stringify(body)});
 const event={event:'setup_open',platform:'ios'};
 assert.equal((await post(event,{authenticated:false})).status,401);assert.equal((await post(event,{csrf:'wrong'})).status,403);assert.equal((await post(event,{requestOrigin:'https://evil.invalid'})).status,403);
 assert.equal((await post({...event,event:'https://private.invalid/secret'})).status,400);assert.equal((await post({...event,platform:'unknown'})).status,400);assert.equal((await post({...event,accountId:account.account_id,url:'https://private.invalid/secret'})).status,400);
 assert.equal(store.db.prepare('SELECT count(*) n FROM onboarding_daily').get().n,0);
 for(let n=0;n<30;n++)assert.equal((await post(event)).status,200);assert.equal((await post(event)).status,429);
 const rows=store.db.prepare('SELECT * FROM onboarding_daily').all();assert.equal(rows.length,1);assert.deepEqual(Object.keys(rows[0]),['day','event','platform','count']);assert.equal(rows[0].count,30);assert.equal(rows[0].event,'setup_open');assert.equal(rows[0].platform,'ios');assert.doesNotMatch(JSON.stringify(rows),/accounts|private|secret|telegram|123/);
});
test('onboarding retention is bounded and daily counts are independent of customer identity',t=>{
 let now=Date.UTC(2026,9,27);const store=new VpnStore(':memory:',{clock:()=>now});t.after(()=>store.close());
 store.recordOnboardingEvent('manual_copy','windows');store.recordOnboardingEvent('manual_copy','windows');store.recordOnboardingEvent('help_click','ios');
 assert.equal(store.db.prepare('SELECT count FROM onboarding_daily WHERE event=?').get('manual_copy').count,2);
 now+=92*86400000;store.recordOnboardingEvent('install_open','android');assert.equal(store.db.prepare('SELECT count(*) n FROM onboarding_daily').get().n,1);
 assert.throws(()=>store.recordOnboardingEvent('a URL','ios'),/Неизвестный/);assert.equal(store.db.prepare('SELECT count(*) n FROM onboarding_daily').get().n,1);
});
