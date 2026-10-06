import {test} from 'node:test';import assert from 'node:assert/strict';
import {VpnStore} from '../store.mjs';import {Accounts} from '../auth.mjs';import {TelegramStore,TelegramClient,TelegramApiError,deliverOne} from '../telegram.mjs';import {createApp} from '../server.mjs';
const DAY=86400_000;
async function fixture(t,overrides={}){let now=Date.UTC(2026,0,1);const clock=()=>now;const store=new VpnStore(':memory:',{clock});t.after(()=>store.close());const users=new Accounts(store,{clock}),telegram=new TelegramStore(store,{clock});const user=await users.add({login:'tg-fixture',expiresAt:now+2*DAY,...overrides});store.db.prepare('UPDATE identities SET must_change=0 WHERE account_id=?').run(user.accountId);const session=users.newSession(user.accountId);
 // Sessions are stored by hash, not by raw cookie.
 const sessionHash=users.session(session.token).token_hash;
 return {store,users,telegram,user,session,sessionHash,advance:ms=>now+=ms,link:(chat='1001')=>{const token=telegram.issue(user.accountId,sessionHash);assert.ok(telegram.candidate(token,chat,'@fixture'));telegram.confirm(user.accountId,sessionHash);},count:()=>store.db.prepare('SELECT count(*) n FROM telegram_outbox').get().n};}
test('one-use session-bound link requires same-session confirmation; no raw nonce stored',async t=>{
 const f=await fixture(t);const token=f.telegram.issue(f.user.accountId,f.sessionHash);assert.equal(token.length,43);
 assert.ok(!f.store.db.prepare('SELECT token_hash FROM telegram_challenges').get().token_hash.includes(token));
 f.telegram.update({update_id:10,message:{chat:{type:'private',id:1001},from:{id:1001,username:'fixture'},text:'/start bind_'+token}});
 assert.equal(f.telegram.state(f.user.accountId,f.sessionHash).linked,false);assert.equal(f.telegram.state(f.user.accountId,f.sessionHash).pending,true);
 assert.throws(()=>f.telegram.confirm(f.user.accountId,'another-session'));f.telegram.confirm(f.user.accountId,f.sessionHash);
 assert.equal(f.telegram.state(f.user.accountId,f.sessionHash).linked,true);assert.equal(f.telegram.candidate(token,'1002','@other'),false);
 const n=f.count();f.telegram.update({update_id:10,message:{chat:{type:'private',id:1001},from:{id:1001},text:'/status'}});assert.equal(f.count(),n);
});
test('expired/revoked sessions and first-password gate cannot link Telegram',async t=>{
 const f=await fixture(t);let token=f.telegram.issue(f.user.accountId,f.sessionHash);f.advance(600001);assert.equal(f.telegram.candidate(token,'1001','@fixture'),false);
 token=f.telegram.issue(f.user.accountId,f.sessionHash);f.users.logout(f.session.token);assert.equal(f.telegram.candidate(token,'1001','@fixture'),false);
 assert.equal(f.store.db.prepare('SELECT count(*) n FROM telegram_challenges').get().n,0);
 const next=f.users.newSession(f.user.accountId);f.store.db.prepare('UPDATE identities SET must_change=1 WHERE account_id=?').run(f.user.accountId);assert.throws(()=>f.telegram.issue(f.user.accountId,f.users.session(next.token).token_hash));
});
test('group messages never link/disclose; chat cannot be attached to two accounts',async t=>{
 const f=await fixture(t);const token=f.telegram.issue(f.user.accountId,f.sessionHash);f.telegram.update({update_id:1,message:{chat:{type:'group',id:-100},from:{id:1001},text:'/start bind_'+token}});assert.equal(f.count(),0);assert.equal(f.telegram.state(f.user.accountId,f.sessionHash).pending,false);f.link();
 const u=await f.users.add({login:'other-fixture',expiresAt:Date.now()+DAY});f.store.db.prepare('UPDATE identities SET must_change=0 WHERE account_id=?').run(u.accountId);const session=f.users.newSession(u.accountId),h=f.users.session(session.token).token_hash;const second=f.telegram.issue(u.accountId,h);f.telegram.candidate(second,'1001','@fixture');assert.throws(()=>f.telegram.confirm(u.accountId,h),/already linked/);
});
test('reminders are once per expiry/stage and catch up only the most urgent stage',async t=>{
 const f=await fixture(t);f.link();f.telegram.plan();f.telegram.plan();assert.equal(f.count(),1);assert.equal(f.telegram.next().stage,'3d');
 const sent=[];await deliverOne(f.telegram,{call:async(m,b)=>sent.push(b)});f.telegram.plan();assert.equal(f.telegram.next(),null);
 f.advance(1.5*DAY);f.telegram.plan();assert.equal(f.telegram.next().stage,'1d');await deliverOne(f.telegram,{call:async()=>{}});
 f.advance(DAY);f.store.db.prepare('UPDATE managed_subscriptions SET enabled=0 WHERE account_id=?').run(f.user.accountId);f.telegram.plan();assert.equal(f.telegram.next().stage,'expired');await deliverOne(f.telegram,{call:async()=>{}});f.telegram.plan();assert.equal(f.telegram.next(),null);assert.ok(sent.every(x=>!x.text.includes('password')&&!x.text.includes('sub/')));
});
test('renewal cancels queued old reminder; later period gets its own reminder',async t=>{
 const f=await fixture(t);f.link();f.telegram.plan();f.store.db.prepare('UPDATE managed_subscriptions SET expires_at=expires_at+? WHERE account_id=?').run(30*DAY,f.user.accountId);assert.equal(f.telegram.next(),null);f.telegram.plan();assert.equal(f.telegram.next(),null);f.advance(30*DAY);f.telegram.plan();assert.equal(f.telegram.next().stage,'3d');
});
test('unlimited subscriptions never get expiry reminders',async t=>{
 const f=await fixture(t,{unlimited:true,allowUnlimited:true,expiresAt:0});f.link();f.telegram.plan();assert.equal(f.count(),0);f.advance(365*DAY);f.telegram.plan();assert.equal(f.count(),0);
});
test('unlink, stop and blocking cancel reminders; superseded link is not reused',async t=>{
 const f=await fixture(t);f.link();f.telegram.plan();f.telegram.update({update_id:3,message:{chat:{type:'private',id:1001},from:{id:1001},text:'/stop'}});assert.equal(f.telegram.state(f.user.accountId,f.sessionHash).linked,false);const row=f.telegram.next();assert.ok(row&&!row.account_id);await deliverOne(f.telegram,{call:async()=>{}});assert.equal(f.telegram.next(),null);
 f.link();f.telegram.plan();f.telegram.disconnect(f.user.accountId);assert.equal(f.telegram.next(),null);
});
test('ambiguous delivery and process interruption do not automatically resend',async t=>{
 const f=await fixture(t);f.link();f.telegram.plan();let calls=0;await deliverOne(f.telegram,{call:async()=>{calls++;throw new Error('timeout');}});await deliverOne(f.telegram,{call:async()=>{calls++;}});assert.equal(calls,1);assert.equal(f.store.db.prepare('SELECT state FROM telegram_outbox').get().state,'uncertain');
 f.advance(1.5*DAY);f.telegram.plan();const row=f.telegram.next();f.store.db.prepare("UPDATE telegram_outbox SET state='sending' WHERE id=?").run(row.id);f.telegram.recover();assert.equal(f.telegram.next(),null);
});
test('explicit rate-limit rejection retries later; blocked recipient is muted',async t=>{
 const f=await fixture(t);f.link();f.telegram.plan();await deliverOne(f.telegram,{call:async()=>{throw new TelegramApiError(429,10);}});assert.equal(f.telegram.next(),null);f.advance(10001);assert.ok(f.telegram.next());await deliverOne(f.telegram,{call:async()=>{throw new TelegramApiError(403);}});assert.equal(f.telegram.state(f.user.accountId,f.sessionHash).enabled,false);assert.equal(f.telegram.next(),null);
});
test('Telegram transport restricts methods, credentials, redirects and conceals token on failure',async()=>{
 assert.throws(()=>new TelegramClient('bad'));const token='123456:FICTIONAL_TOKEN_NOT_A_REAL_SECRET';let seen;
 const client=new TelegramClient(token,{request:async(u,o)=>{seen={u,o};return {ok:true,json:async()=>({ok:true,result:{id:1}})}}});assert.deepEqual(await client.call('getMe'),{id:1});assert.equal(seen.o.redirect,'error');await assert.rejects(client.call('deleteWebhook'));
 const fail=new TelegramClient(token,{request:async()=>{throw new Error(token)}});await assert.rejects(fail.call('sendMessage',{}),e=>!e.message.includes(token));
});
test('HTTP linking is authenticated, CSRF protected, isolated by account and unavailable without bot config',async t=>{
 const store=new VpnStore(':memory:');const {server,users}=createApp({store,origin:'http://localhost',secure:false});const a=await users.add({login:'http-telegram-fixture'});store.db.prepare('UPDATE identities SET must_change=0 WHERE account_id=?').run(a.accountId);const session=users.newSession(a.accountId);await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>server.close(r));store.close();});const url='http://127.0.0.1:'+server.address().port+'/vpn/api/telegram';
 assert.equal((await fetch(url)).status,401);const h={Origin:'http://localhost','Content-Type':'application/json',Cookie:'vpn_session='+session.token};assert.equal((await fetch(url+'/link',{method:'POST',headers:h,body:'{}'})).status,403);const response=await fetch(url+'/link',{method:'POST',headers:{...h,'X-CSRF-Token':session.csrf},body:'{}'});assert.equal(response.status,503);const state=await(await fetch(url,{headers:h})).json();assert.deepEqual(state,{available:false,linked:false,enabled:false,pending:false,candidate:null});
});
test('configured HTTP flow requires authenticated website confirmation and isolates other accounts',async t=>{
 const store=new VpnStore(':memory:');const {server,users}=createApp({store,origin:'http://localhost',secure:false,botUsername:'fictional_fixture_bot'});const tg=new TelegramStore(store);
 const a=await users.add({login:'link-owner-fixture'}),b=await users.add({login:'other-link-fixture'});for(const u of [a,b])store.db.prepare('UPDATE identities SET must_change=0 WHERE account_id=?').run(u.accountId);
 const sa=users.newSession(a.accountId),sb=users.newSession(b.accountId);await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>server.close(r));store.close();});const base='http://127.0.0.1:'+server.address().port+'/vpn/api/telegram';
 const req=(s,path='',method='GET')=>fetch(base+path,{method,headers:{Origin:'http://localhost','Content-Type':'application/json',Cookie:'vpn_session='+s.token,'X-CSRF-Token':s.csrf},...(method==='GET'?{}:{body:'{}'})});
 const response=await req(sa,'/link','POST');assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');const link=(await response.json()).url;
 const nonce=new URL(link).searchParams.get('start').slice(5);assert.equal(tg.candidate(nonce,'1001','@fixture'),true);
 assert.equal((await req(sb,'/confirm','POST')).status,400);assert.equal((await(await req(sb)).json()).pending,false);
 assert.equal((await req(sa,'/confirm','POST')).status,200);assert.equal((await(await req(sa)).json()).linked,true);
 assert.equal((await req(sb,'','DELETE')).status,200);assert.equal((await(await req(sa)).json()).linked,true);
 assert.equal((await req(sa,'','DELETE')).status,200);assert.equal((await(await req(sa)).json()).linked,false);
});
test('durable offsets, linkage and sent dedupe survive disk reopen',async t=>{
 const {mkdtempSync,rmSync}=await import('node:fs');const {tmpdir}=await import('node:os');const {join}=await import('node:path');const dir=mkdtempSync(join(tmpdir(),'telegram-vpn-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const path=join(dir,'private.sqlite');let store=new VpnStore(path),users=new Accounts(store),tg=new TelegramStore(store);const u=await users.add({login:'persistent-tg-fixture',expiresAt:Date.now()+2*DAY});store.db.prepare('UPDATE identities SET must_change=0 WHERE account_id=?').run(u.accountId);const session=users.newSession(u.accountId),sid=users.session(session.token).token_hash;const token=tg.issue(u.accountId,sid);tg.candidate(token,'1001','@fixture');tg.confirm(u.accountId,sid);tg.update({update_id:42});tg.plan();await deliverOne(tg,{call:async()=>{}});store.close();
 store=new VpnStore(path);t.after(()=>store.close());users=new Accounts(store);tg=new TelegramStore(store);assert.equal(tg.offset(),43);assert.equal(tg.state(u.accountId,sid).linked,true);tg.plan();assert.equal(tg.next(),null);
});
test('stale expired reminder after long downtime is canceled rather than sent weeks late',async t=>{
 const f=await fixture(t);f.link();f.advance(3*DAY);f.telegram.plan();assert.equal(f.telegram.next().stage,'expired');f.advance(8*DAY);assert.equal(f.telegram.next(),null);f.telegram.plan();assert.equal(f.telegram.next(),null);
});
