import {test} from 'node:test';
import assert from 'node:assert/strict';
import {VpnStore} from '../store.mjs';
import {createApp} from '../server.mjs';

const origin='https://family-spy.ru',oldPassword='OldForgottenFixturePassword123',nextPassword='NewRecoveredFixturePassword456';
async function fixture(t,{email=true}={}){
 let now=Date.now();const sent=[],store=new VpnStore(':memory:',{clock:()=>now}),app=createApp({store,origin,botUsername:'fictional_fixture_bot',sendEmail:email?async(to,code,options)=>{sent.push({to,code,options});}:null});app.users.clock=()=>now;
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>app.server.close(r));await app.recovery.shutdown();store.close();});
 const base='http://127.0.0.1:'+app.server.address().port+'/vpn/api/';
 const request=(path,body={},headers={})=>fetch(base+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
 const get=path=>fetch(base+path);
 const add=async(login,{verifiedEmail=null,role='user',gated=true}={})=>{const a=await app.users.add({login,password:oldPassword,panelLogin:'panel-'+login,profileUrl:'https://sub.family-spy.ru/sub/fictional-'+login,unlimited:true,allowUnlimited:true,role});if(!gated)store.db.prepare('UPDATE identities SET must_change=0 WHERE account_id=?').run(a.accountId);if(verifiedEmail)store.db.prepare('INSERT INTO verified_emails VALUES(?,?)').run(a.accountId,verifiedEmail);return a;};
 const flush=()=>Promise.allSettled([...app.recovery.deliveries]);
 return {...app,store,sent,request,get,add,flush,advance:ms=>now+=ms,now:()=>now};
}
function tokenOf(link){const url=new URL(link);assert.equal(url.search,'');return new URLSearchParams(url.hash.slice(1)).get('recovery');}
function rights(f,accountId){return JSON.stringify({account:f.store.account(accountId),subscription:f.store.db.prepare('SELECT * FROM managed_subscriptions WHERE account_id=?').get(accountId),orders:f.store.db.prepare('SELECT * FROM orders WHERE account_id=?').all(accountId),grants:f.store.db.prepare('SELECT * FROM grants WHERE account_id=?').all(accountId),jobs:f.store.db.prepare('SELECT * FROM jobs WHERE account_id=?').all(accountId)});}

test('generic recovery acknowledgements do not treat receipt, account email or names as verified ownership',async t=>{
 const f=await fixture(t),known=await f.add('recovery-known',{verifiedEmail:'verified@example.invalid'}),legacy=await f.add('recovery-legacy');
 await f.add('ambiguous@example.invalid',{verifiedEmail:'owned-alternative@example.invalid'});await f.add('another-ambiguous-fixture',{verifiedEmail:'ambiguous@example.invalid'});
 f.cabinet.updateProfile(legacy.accountId,{receiptEmail:'receipt@example.invalid'});f.store.db.prepare('UPDATE accounts SET email=? WHERE id=?').run('raw-account@example.invalid',legacy.accountId);
 const results=[];
 for(const identifier of ['recovery-known','recovery-legacy','receipt@example.invalid','raw-account@example.invalid','unknown-person','ambiguous@example.invalid']){
  const response=await f.request('recovery/request',{identifier});assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('set-cookie'),null);results.push(await response.json());
 }
 await f.flush();assert.equal(f.sent.length,1);assert.equal(f.sent[0].to,'verified@example.invalid');assert.equal(f.sent[0].options.purpose,'recovery');
 for(const result of results){assert.deepEqual(Object.keys(result).sort(),['accepted','challengeId','expiresIn','retryAfter']);assert.equal(result.accepted,true);assert.equal(result.expiresIn,600);assert.equal(result.retryAfter,60);assert.match(result.challengeId,/^[A-Za-z0-9_-]{32}$/);}
 assert.equal(f.users.identity(known.accountId).must_change,1);assert.equal(await f.users.login('recovery-known',nextPassword),null);
 const options=await(await f.get('auth-options')).json();assert.equal(options.recoveryEmail,true);assert.equal(options.recoveryTelegram,true);
});
test('email recovery clears forced password change without the forgotten password or automatic login, preserving VPN rights',async t=>{
 const f=await fixture(t),a=await f.add('legacy-email-fixture',{verifiedEmail:'legacy@example.invalid'}),before=rights(f,a.accountId),one=await f.users.login(a.login,oldPassword),two=await f.users.login(a.login,oldPassword);
 const challenge=await(await f.request('recovery/request',{identifier:a.login})).json();await f.flush();const code=f.sent[0].code;
 assert.equal(f.store.db.prepare('SELECT code_hash FROM recovery_challenges WHERE id=?').get(challenge.challengeId).code_hash.includes(code),false);
 assert.equal((await f.request('email/login/confirm',{challengeId:challenge.challengeId,code})).status,400);
 assert.equal((await f.request('recovery/confirm',{challengeId:challenge.challengeId,code,password:'short'})).status,400);
 const response=await f.request('recovery/confirm',{challengeId:challenge.challengeId,code,password:nextPassword});assert.equal(response.status,200);assert.equal(response.headers.get('set-cookie'),null);assert.deepEqual(await response.json(),{ok:true,login:a.login});
 assert.equal(f.users.session(one.token),null);assert.equal(f.users.session(two.token),null);assert.equal(f.users.identity(a.accountId).must_change,0);assert.equal(f.users.identity(a.accountId).enabled,1);
 assert.equal(await f.users.login(a.login,oldPassword),null);assert.equal((await f.users.login(a.login,nextPassword)).identity.account_id,a.accountId);assert.equal(rights(f,a.accountId),before);
 assert.equal((await f.request('recovery/confirm',{challengeId:challenge.challengeId,code,password:'AnotherRecoveredFixturePassword789'})).status,400);
});
test('recovery codes expire, limit guesses, and resends rotate only the supplied owned challenge',async t=>{
 const f=await fixture(t),a=await f.add('resend-first',{verifiedEmail:'first@example.invalid'});await f.add('resend-second',{verifiedEmail:'second@example.invalid'});
 const first=f.recovery.request('resend-first'),second=f.recovery.request('resend-second');await f.flush();const firstCode=f.sent.find(x=>x.to==='first@example.invalid').code;
 const repeat=f.recovery.request('resend-first',{challengeId:first.challengeId});assert.equal(repeat.challengeId,first.challengeId);await f.flush();assert.equal(f.sent.length,2);
 f.advance(61000);assert.throws(()=>f.recovery.request('resend-first',{challengeId:second.challengeId}),/не подходят/);
 const rotated=f.recovery.request('resend-first',{challengeId:first.challengeId});await f.flush();assert.notEqual(rotated.challengeId,first.challengeId);assert.ok(f.store.db.prepare('SELECT 1 FROM recovery_challenges WHERE id=?').get(second.challengeId));
 await assert.rejects(()=>f.recovery.confirm(first.challengeId,firstCode,nextPassword),/не подходят/);
 const latest=f.sent.filter(x=>x.to==='first@example.invalid').at(-1).code;
 // An unaffiliated same-login request does not invalidate another browser's proof.
 f.recovery.request('resend-first');assert.ok(f.store.db.prepare('SELECT 1 FROM recovery_challenges WHERE id=?').get(rotated.challengeId));
 for(let n=0;n<5;n++)await assert.rejects(()=>f.recovery.confirm(rotated.challengeId,'xxxxxxxx',nextPassword),/не подходят/);
 await assert.rejects(()=>f.recovery.confirm(rotated.challengeId,latest,nextPassword),/не подходят/);assert.ok(await f.users.login(a.login,oldPassword));
 f.advance(600001);await assert.rejects(()=>f.recovery.confirm(second.challengeId,'00000000',nextPassword),/не подходят/);
});
test('recovery cannot use a changed email/password or overwrite a different valid current account',async t=>{
 const f=await fixture(t),a=await f.add('conflict-first',{verifiedEmail:'conflict@example.invalid'}),other=await f.add('conflict-other',{gated:false});
 const session=f.users.newSession(other.accountId),challenge=f.recovery.request(a.login);await f.flush();const code=f.sent[0].code;
 const conflict=await f.request('recovery/confirm',{challengeId:challenge.challengeId,code,password:nextPassword},{Cookie:'vpn_session='+session.token});assert.equal(conflict.status,409);assert.equal(conflict.headers.get('set-cookie'),null);assert.equal(f.users.session(session.token).account_id,other.accountId);assert.equal(f.store.db.prepare('SELECT attempts FROM recovery_challenges WHERE id=?').get(challenge.challengeId).attempts,0);
 f.store.db.prepare('UPDATE verified_emails SET email=? WHERE account_id=?').run('changed@example.invalid',a.accountId);await assert.rejects(()=>f.recovery.confirm(challenge.challengeId,code,nextPassword),/не подходят/);
 assert.ok(await f.users.login(a.login,oldPassword));
});
test('admin-assisted legacy recovery requires current admin, CSRF, recent proof and explicit ownership check',async t=>{
 const f=await fixture(t),admin=await f.add('recovery-admin',{role:'admin',gated:false}),legacy=await f.add('legacy-no-channel'),user=await f.add('ordinary-user',{gated:false});
 const auth=f.users.newSession(admin.accountId),userAuth=f.users.newSession(user.accountId),headers={Cookie:'vpn_session='+auth.token,'X-CSRF-Token':auth.csrf},body={accountId:legacy.accountId,requestKey:'request-admin-recovery',ownershipVerified:true};
 assert.equal((await f.request('admin/recovery-links',body)).status,401);assert.equal((await f.request('admin/recovery-links',body,{Cookie:'vpn_session='+userAuth.token,'X-CSRF-Token':userAuth.csrf})).status,403);assert.equal((await f.request('admin/recovery-links',body,{Cookie:headers.Cookie})).status,403);
 assert.equal((await f.request('admin/recovery-links',{...body,ownershipVerified:false},headers)).status,400);
 f.store.db.prepare('UPDATE session_auth SET verified_at=0 WHERE token_hash=?').run(f.users.session(auth.token).token_hash);assert.equal((await f.request('admin/recovery-links',body,headers)).status,400);
 f.store.db.prepare('UPDATE session_auth SET verified_at=? WHERE token_hash=?').run(f.now(),f.users.session(auth.token).token_hash);
 assert.equal((await f.request('admin/recovery-links',{...body,accountId:admin.accountId},headers)).status,400);
 const oldSession=await f.users.login(legacy.login,oldPassword),before=rights(f,legacy.accountId),issued=await f.request('admin/recovery-links',body,headers);assert.equal(issued.status,201);const result=await issued.json(),token=tokenOf(result.url);assert.match(token,/^[A-Za-z0-9_-]{43}$/);assert.equal(result.expiresIn,900);
 assert.ok(f.users.session(oldSession.token));assert.equal(f.users.identity(legacy.accountId).must_change,1);assert.equal(rights(f,legacy.accountId),before);assert.doesNotMatch(JSON.stringify(f.store.db.prepare('SELECT * FROM recovery_tokens').all()),new RegExp(token));
 const repeated=await(await f.request('admin/recovery-links',body,headers)).json();assert.equal(repeated.alreadyIssued,true);assert.equal(repeated.url,undefined);
 for(let n=0;n<2;n++){const preview=await f.request('recovery/preview',{token});assert.equal(preview.status,200);assert.equal(preview.headers.get('set-cookie'),null);assert.equal((await preview.json()).login,legacy.login);}
 const wrong=await f.request('recovery/reset',{token,password:nextPassword},{Cookie:'vpn_session='+userAuth.token});assert.equal(wrong.status,409);assert.ok(f.users.session(userAuth.token));
 const done=await f.request('recovery/reset',{token,password:nextPassword});assert.equal(done.status,200);assert.equal(done.headers.get('set-cookie'),null);assert.deepEqual(await done.json(),{ok:true,login:legacy.login});assert.equal(f.users.session(oldSession.token),null);assert.equal(rights(f,legacy.accountId),before);assert.ok(await f.users.login(legacy.login,nextPassword));
 assert.equal((await f.request('recovery/reset',{token,password:'AnotherFixtureNewPassword789'})).status,400);
 const oldRetry=await(await f.request('admin/recovery-links',body,headers)).json();assert.equal(oldRetry.alreadyIssued,true);assert.equal(oldRetry.url,undefined);
});
test('admin reset links rotate without reviving older request keys and reject revoked issuers, expired or changed proof',async t=>{
 const f=await fixture(t),admin=await f.add('token-admin',{role:'admin',gated:false}),a=await f.add('token-legacy'),session=f.users.session(f.users.newSession(admin.accountId).token),options={ownershipVerified:true,requestKey:'admin-request-one'};
 const one=f.recovery.issueAdmin(session,a.accountId,options),two=f.recovery.issueAdmin(session,a.accountId,{...options,requestKey:'admin-request-two'});
 assert.throws(()=>f.recovery.preview(tokenOf(one.url)),/не подходят/);assert.equal(f.recovery.issueAdmin(session,a.accountId,options).alreadyIssued,true);assert.equal(f.recovery.preview(tokenOf(two.url)).login,a.login);
 f.store.db.prepare('UPDATE identities SET enabled=0 WHERE account_id=?').run(admin.accountId);assert.throws(()=>f.recovery.preview(tokenOf(two.url)),/не подходят/);
 f.store.db.prepare('UPDATE identities SET enabled=1 WHERE account_id=?').run(admin.accountId);f.advance(900001);assert.throws(()=>f.recovery.preview(tokenOf(two.url)),/не подходят/);
});
test('linked Telegram recovery works for must_change without granting login or VPN access and invalidates on rebind',async t=>{
 const f=await fixture(t),a=await f.add('telegram-gated'),before=rights(f,a.accountId);
 f.store.db.prepare('INSERT INTO telegram_links VALUES(?,?,NULL,0,?,?)').run(a.accountId,'123','confirmed-generation',f.now());assert.equal(f.commerce.accountForChat(123),null);
 const link=f.commerce.recoveryHandoff(123);assert.equal(link.expiresIn,300);assert.equal(f.users.identity(a.accountId).must_change,1);assert.equal(f.store.db.prepare('SELECT count(*) n FROM sessions').get().n,0);
 const token=tokenOf(link.url);assert.equal(f.recovery.preview(token).login,a.login);assert.throws(()=>f.commerce.consume(token,'login'),/недействительна/);
 f.store.db.prepare("UPDATE telegram_links SET generation='replacement-generation' WHERE chat_id='123'").run();assert.throws(()=>f.recovery.preview(token),/не подходят/);
 const fresh=f.commerce.recoveryHandoff(123);assert.deepEqual(await f.recovery.reset(tokenOf(fresh.url),nextPassword),{ok:true,login:a.login});assert.equal(f.store.db.prepare('SELECT count(*) n FROM sessions').get().n,0);assert.ok(await f.users.login(a.login,nextPassword));assert.equal(rights(f,a.accountId),before);
 assert.throws(()=>f.commerce.recoveryHandoff(999),e=>e.code==='INVALID_RECOVERY');
});
test('recovery SMTP is asynchronous, send failure is generic, unavailable transport is explicit, and Origin is enforced',async t=>{
 const f=await fixture(t);await f.add('async-recovery',{verifiedEmail:'async@example.invalid'});let release;f.recovery.send=()=>new Promise(resolve=>{release=resolve;});
 const response=await f.request('recovery/request',{identifier:'async-recovery'});assert.equal(response.status,200);assert.equal((await response.json()).accepted,true);assert.equal(typeof release,'function');release();await f.flush();
 assert.equal((await f.request('recovery/request',{identifier:'async-recovery'},{Origin:'https://evil.invalid'})).status,403);
 f.advance(61000);f.recovery.send=async()=>{throw new Error('synthetic SMTP failure');};const failed=await f.request('recovery/request',{identifier:'async-recovery'});assert.equal(failed.status,200);assert.equal((await failed.json()).accepted,true);await f.flush();assert.equal(f.store.db.prepare("SELECT count(*) n FROM recovery_challenges WHERE delivery='failed'").get().n,1);
 const off=await fixture(t,{email:false});assert.equal((await(await off.get('auth-options')).json()).recoveryEmail,false);assert.equal((await off.request('recovery/request',{identifier:'any-user'})).status,503);
});
test('simultaneous token resets produce one winner, revoke old sessions and cannot create duplicate accounts',async t=>{
 const f=await fixture(t),a=await f.add('concurrent-reset');f.store.db.prepare('INSERT INTO telegram_links VALUES(?,?,NULL,1,?,?)').run(a.accountId,'123','concurrent-generation',f.now());
 const token=tokenOf(f.commerce.recoveryHandoff(123).url),results=await Promise.allSettled([f.recovery.reset(token,nextPassword),f.recovery.reset(token,'OtherConcurrentFixturePassword123')]);
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(results.filter(x=>x.status==='rejected').length,1);assert.equal(f.store.db.prepare('SELECT count(*) n FROM accounts').get().n,1);assert.equal(f.store.db.prepare('SELECT count(*) n FROM sessions').get().n,0);assert.equal(f.store.db.prepare('SELECT count(*) n FROM recovery_tokens').get().n,0);
});
test('ordinary verified-email login can set a gated user new password without asking for the forgotten old one',async t=>{
 const f=await fixture(t),a=await f.add('alternate-email-gated',{verifiedEmail:'alternate@example.invalid'});
 const passwordSession=await f.users.login(a.login,oldPassword),passwordCookie='vpn_session='+passwordSession.token;
 const me=await(await fetch('http://127.0.0.1:'+f.server.address().port+'/vpn/api/me',{headers:{Cookie:passwordCookie}})).json();assert.equal(me.authMethod,'password');assert.equal(me.passwordSetupAllowed,false);assert.equal(me.subscription,null);
 assert.equal((await f.request('password/set',{next:nextPassword},{Cookie:passwordCookie,'X-CSRF-Token':passwordSession.csrf})).status,400);
 const issued=await(await f.request('email/login/request',{email:'alternate@example.invalid'})).json();const code=f.sent.find(x=>x.to==='alternate@example.invalid').code;
 const signed=await f.request('email/login/confirm',{challengeId:issued.challengeId,code}),data=await signed.json(),cookie=signed.headers.get('set-cookie').split(';')[0];assert.equal(data.user.must_change,1);
 const verified=await(await fetch('http://127.0.0.1:'+f.server.address().port+'/vpn/api/me',{headers:{Cookie:cookie}})).json();assert.equal(verified.authMethod,'email');assert.equal(verified.passwordSetupAllowed,true);assert.equal(verified.subscription,null);
 assert.equal((await f.request('profile',{}, {Cookie:cookie,'X-CSRF-Token':data.csrf})).status,403);
 const changed=await f.request('password/set',{next:nextPassword},{Cookie:cookie,'X-CSRF-Token':data.csrf});assert.equal(changed.status,200);assert.equal(f.users.identity(a.accountId).must_change,0);assert.equal(f.users.session(passwordSession.token),null);assert.ok(await f.users.login(a.login,nextPassword));
});
test('known and unknown recovery requests share public shape while verified-recipient mail is rate limited',async t=>{
 const f=await fixture(t);await f.add('rate-limited-recovery',{verifiedEmail:'limited@example.invalid'});
 for(let n=0;n<6;n++){
  const known=f.recovery.request('rate-limited-recovery'),unknown=f.recovery.request('not-a-customer');
  assert.deepEqual(Object.keys(known),Object.keys(unknown));assert.equal(known.accepted,true);assert.equal(unknown.accepted,true);await f.flush();f.advance(61000);
 }
 assert.equal(f.sent.length,5);assert.ok(f.sent.every(item=>item.to==='limited@example.invalid'));
});
