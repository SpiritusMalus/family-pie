import {test} from 'node:test';
import assert from 'node:assert/strict';
import QRCode from 'qrcode';
import {subscriptionURL,subscriptionOrigin} from '../subscription-url.mjs';
import {VpnStore} from '../store.mjs';
import {createApp} from '../server.mjs';

const origin='https://sub.family-spy.ru';
test('subscription delivery changes only the known legacy host and retains path, query and fragment',()=>{
 for(const port of ['',':443',':2096'])
  assert.equal(subscriptionURL('https://sub.family-pie.ru'+port+'/sub/fictional_fixture-123?format=auto#happ',origin),origin+'/sub/fictional_fixture-123?format=auto#happ');
 for(const value of [null,'not a URL','http://sub.family-pie.ru/sub/fixture','https://sub.family-pie.ru:9443/sub/fixture','https://sub.family-pie.ru.evil.invalid/sub/fixture','https://evil.invalid/sub/fixture','https://user@sub.family-pie.ru/sub/fixture','https://sub.family-pie.ru/other/fixture','https://sub.family-pie.ru/sub/a/b'])
  assert.equal(subscriptionURL(value,origin),value);
 assert.equal(subscriptionURL('https://sub.family-pie.ru/sub/fixture',null),'https://sub.family-pie.ru/sub/fixture');
});

test('subscription origin rejects credentials, paths, unencrypted URLs and malformed configuration',()=>{
 assert.equal(subscriptionOrigin(origin),origin);
 assert.equal(subscriptionOrigin(null),null);
 for(const value of ['http://sub.family-spy.ru','https://user@sub.family-spy.ru','https://sub.family-spy.ru/','https://sub.family-spy.ru/path','https://sub.family-spy.ru?query','not a URL'])assert.throws(()=>subscriptionOrigin(value));
});

test('real authenticated subscription and QR use the new host without modifying stored keys or identity',async t=>{
 const store=new VpnStore(':memory:');
 const app=createApp({store,origin:'https://family-spy.ru',publicSubscriptionOrigin:origin});
 const old='https://sub.family-pie.ru:2096/sub/fictional_fixture';
 const account=await app.users.add({login:'subscription-origin-fixture',password:'FixturePassword-12345!',profileUrl:old,panelLogin:'fixture-only',unlimited:true,allowUnlimited:true});
 store.db.prepare('UPDATE identities SET must_change=0 WHERE account_id=?').run(account.accountId);
 const before={identity:store.db.prepare('SELECT * FROM identities').all(),subscription:store.db.prepare('SELECT * FROM managed_subscriptions').all()};
 const session=app.users.newSession(account.accountId);
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 t.after(async()=>{await new Promise(r=>app.server.close(r));store.close();});
 const base='http://127.0.0.1:'+app.server.address().port+'/vpn/api/';
 const headers={Cookie:'vpn_session='+session.token};
 const response=await fetch(base+'me',{headers}),me=await response.json();
 assert.equal(response.status,200);assert.equal(me.subscription.active,true);
 assert.equal(me.subscription.profile_url,origin+'/sub/fictional_fixture');
 const qr=await fetch(base+'subscription/qr',{headers});
 assert.equal(qr.status,200);assert.equal(qr.headers.get('cache-control'),'no-store');
 assert.equal(await qr.text(),await QRCode.toString(me.subscription.profile_url,{type:'svg',errorCorrectionLevel:'M',margin:2,width:240}));
 assert.deepEqual(store.db.prepare('SELECT * FROM identities').all(),before.identity);
 assert.deepEqual(store.db.prepare('SELECT * FROM managed_subscriptions').all(),before.subscription);
 const rollback=createApp({store,origin:'https://family-spy.ru'});
 assert.equal(rollback.users.subscription(account.accountId).profile_url,old);
});
