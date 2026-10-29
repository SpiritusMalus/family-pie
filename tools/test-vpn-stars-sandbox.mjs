import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,lstat,rm,access,symlink,chmod} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openSandbox,readSandboxConfig,SandboxError} from './vpn-stars-sandbox.mjs';
import {Cabinet} from '../services/vpn/cabinet.mjs';
const TOKEN='123456:FICTIONAL_TOKEN_FOR_SYNTHETIC_TESTS_ONLY',BOT=987654321,USER=123456789;
async function fixture(t,patch={}){
 const dir=await mkdtemp(join(tmpdir(),'stars-sandbox-fixture-')),sessions=[];t.after(async()=>{for(const session of sessions)await session.close();await rm(dir,{recursive:true,force:true});});
 const credentialFile=join(dir,'test.token'),configPath=join(dir,'test.json'),stateDir=join(dir,'state'),lockRoot=join(dir,'locks');await writeFile(credentialFile,TOKEN,{mode:0o600});
 const config={environment:'test',credentialFile,expectedBot:{id:BOT,username:'fictional_test_bot'},allowedUserIds:[USER],stateDir,plans:[{days:30,stars:1}],maxRunSeconds:60,...patch};
 await writeFile(configPath,JSON.stringify(config),{mode:0o600});const calls=[];
 const request=async(url,options)=>{calls.push({url,body:options.body instanceof FormData?options.body:JSON.parse(options.body)});const method=url.split('/').at(-1);return {ok:true,json:async()=>({ok:true,result:method==='getMe'?{is_bot:true,id:BOT,username:'fictional_test_bot'}:method==='getWebhookInfo'?{url:''}:method==='getUpdates'?[]:method==='refundStarPayment'?true:{message_id:calls.length}})};};
 return {dir,sessions,credentialFile,configPath,stateDir,lockRoot,config,calls,request,options:{environment:{},lockRoot,request}};
}
const missing=path=>assert.rejects(()=>access(path),error=>error.code==='ENOENT');
test('sandbox requires explicit test config, private credentials and a fresh directory without reading production environment values',async t=>{
 const f=await fixture(t);await readSandboxConfig(f.configPath,{environment:{}});await missing(f.stateDir);
 for(const environment of [{VPN_DATABASE_PATH:'/never/open'}, {CREDENTIALS_DIRECTORY:'/never/open'}])await assert.rejects(()=>readSandboxConfig(f.configPath,{environment}),error=>error.code==='PRODUCTION_ENVIRONMENT_REJECTED');
 for(const patch of [{environment:'production'},{allowedUserIds:[]},{expectedBot:{id:BOT}},{plans:[]},{maxRunSeconds:0}]){
  await writeFile(f.configPath,JSON.stringify({...f.config,...patch}));await assert.rejects(()=>openSandbox(f.configPath,f.options),SandboxError);assert.equal(f.calls.length,0);await missing(f.stateDir);
 }
 await writeFile(f.configPath,JSON.stringify(f.config));await mkdir(f.stateDir,{mode:0o700});await writeFile(join(f.stateDir,'sentinel'),'preserve');
 await assert.rejects(()=>openSandbox(f.configPath,f.options),error=>error.code==='NEW_STATE_DIRECTORY_REQUIRED');assert.equal(await readFile(join(f.stateDir,'sentinel'),'utf8'),'preserve');
});
test('credential symlinks and public permissions fail before any API or local state creation',async t=>{
 const f=await fixture(t);await chmod(f.credentialFile,0o644);await assert.rejects(()=>openSandbox(f.configPath,f.options),error=>error.code==='PRIVATE_TEST_CREDENTIAL_UNAVAILABLE');assert.equal(f.calls.length,0);await missing(f.stateDir);
 await chmod(f.credentialFile,0o600);const linked=join(f.dir,'linked.token');await symlink(f.credentialFile,linked);await writeFile(f.configPath,JSON.stringify({...f.config,credentialFile:linked}));
 await assert.rejects(()=>openSandbox(f.configPath,f.options),error=>error.code==='PRIVATE_TEST_CREDENTIAL_UNAVAILABLE');assert.equal(f.calls.length,0);
});
test('oversized credentials and an unsafe writable state parent fail before preflight',async t=>{
 const f=await fixture(t);await writeFile(f.credentialFile,'X'.repeat(4097));await assert.rejects(()=>openSandbox(f.configPath,f.options),error=>error.code==='PRIVATE_TEST_CREDENTIAL_UNAVAILABLE');assert.equal(f.calls.length,0);
 await writeFile(f.credentialFile,TOKEN);const parent=join(f.dir,'unsafe');await mkdir(parent);await chmod(parent,0o777);await writeFile(f.configPath,JSON.stringify({...f.config,stateDir:join(parent,'state')}));
 await assert.rejects(()=>openSandbox(f.configPath,f.options),error=>error.code==='SAFE_STATE_PARENT_REQUIRED');assert.equal(f.calls.length,0);
});
test('wrong bot, existing webhook and rejected test token never create state or send/poll',async t=>{
 for(const failure of ['identity','webhook','unauthorized']){
  const f=await fixture(t);const calls=[];const request=async url=>{calls.push(url);const method=url.split('/').at(-1);return {ok:failure!=='unauthorized',status:401,json:async()=>failure==='unauthorized'?{ok:false,error_code:401}:{ok:true,result:method==='getMe'?{id:failure==='identity'?BOT+1:BOT,is_bot:true,username:'fictional_test_bot'}:{url:failure==='webhook'?'https://example.invalid/webhook':''}}};};
  await assert.rejects(()=>openSandbox(f.configPath,{...f.options,request}),SandboxError);assert.ok(calls.length<=2&&calls.every(url=>url.includes('/test/')));await missing(f.stateDir);await missing(f.lockRoot);
 }
});
test('a verified test identity creates only private fresh state, and one lock covers two different state directories',async t=>{
 const f=await fixture(t),session=await openSandbox(f.configPath,f.options);f.sessions.push(session);
 assert.equal((await lstat(f.stateDir)).mode&0o777,0o700);for(const file of ['sandbox.sqlite','sandbox.json','events.jsonl'])assert.equal((await lstat(join(f.stateDir,file))).mode&0o777,0o600);
 assert.deepEqual(f.calls.map(call=>call.url.split('/').at(-1)),['getMe','getWebhookInfo']);
 await writeFile(f.configPath,JSON.stringify({...f.config,stateDir:join(f.dir,'second')}));
 await assert.rejects(()=>openSandbox(f.configPath,f.options),error=>error.code==='TEST_BOT_ALREADY_LOCKED');await missing(join(f.dir,'second'));
});
test('main UI stays RUB while isolated legacy Stars fixtures retain financial replay/refund idempotency and no panel provisioning',async t=>{
 const f=await fixture(t),session=await openSandbox(f.configPath,f.options);f.sessions.push(session);let update=0,messageId=1;
 const send=(text,user=USER)=>session.acceptUpdates([{update_id:update++,message:{message_id:messageId++,chat:{id:user,type:'private'},from:{id:user,is_bot:false},text}}]);
 const drain=async()=>{for(let n=0;n<30;n++)if(!await session.deliver())return;assert.fail('Unexpected test backlog');};
 await send('PRIVATE_UNALLOWLISTED_MESSAGE',USER+1);await drain();assert.equal(session.store.db.prepare('SELECT count(*) n FROM identities').get().n,0);assert.equal(f.calls.length,2);
 await send('/menu');await drain();const last=()=>f.calls.filter(call=>call.url.endsWith('/sendMessage')).at(-1).body;
 const click=async label=>{const button=last().reply_markup.inline_keyboard.flat().find(button=>button.text===label);assert.ok(button,'Expected real-handler button');await session.acceptUpdates([{update_id:update++,callback_query:{id:'callback-'+update,from:{id:USER,is_bot:false},message:{chat:{id:USER,type:'private'}},data:button.callback_data}}]);await drain();};
 // Only the test seeds a website catalogue. The sandbox runtime receives no merchant configuration.
 new Cabinet(session.store).setPlans([{days:30,priceMinor:30000,devices:0}]);
 await click('💳 Купить / продлить');await click('Создать аккаунт');await click('Принимаю и продолжаю');
 assert.match(last().text,/Оплата в рублях на сайте через ЮKassa/);assert.doesNotMatch(last().text,/Stars|⭐/);
 await click('30 дней · 300 ₽');const checkout=last().reply_markup.inline_keyboard.flat().find(button=>button.text==='Перейти на сайт');
 assert.equal(new URL(checkout.url).origin,'https://sandbox.invalid');assert.equal(new URL(checkout.url).searchParams.get('period'),'30');
 assert.equal(session.store.db.prepare('SELECT count(*) n FROM orders').get().n,0);assert.equal(session.store.db.prepare('SELECT count(*) n FROM grants').get().n,0);
 assert.ok(!f.calls.some(call=>call.url.endsWith('/sendInvoice')));
 // Construct an old-order fixture through the preserved commerce adapter, never through current bot navigation.
 const offer=session.commerce.preparePurchase(USER,30,'historical-stars-test-fixture');session.commerce.acceptPurchase(USER,offer.token);
 const invoice=session.commerce.invoice(USER,30,'historical-stars-test-fixture',offer.token);assert.equal(invoice.currency,'XTR');assert.equal(invoice.prices[0].amount,1);
 assert.deepEqual(session.commerce.invoice(USER,30,'historical-stars-test-fixture',offer.token),invoice);
 await session.acceptUpdates([{update_id:update++,pre_checkout_query:{id:'synthetic-precheckout',from:{id:USER},invoice_payload:invoice.payload,currency:'XTR',total_amount:1}}]);
 const payment={currency:'XTR',total_amount:1,invoice_payload:invoice.payload,telegram_payment_charge_id:'SYNTHETIC-CHARGE'};
 for(let n=0;n<2;n++)await session.acceptUpdates([{update_id:update++,message:{message_id:messageId++,chat:{id:USER,type:'private'},from:{id:USER},successful_payment:payment}}]);
 await drain();assert.equal(session.store.db.prepare('SELECT count(*) n FROM grants').get().n,1);
 const order=session.store.db.prepare('SELECT * FROM orders').get();assert.equal(session.store.subscription(order.account_id).active,true);assert.equal(session.store.db.prepare('SELECT profile_url FROM managed_subscriptions').get().profile_url,null);
 assert.equal(session.store.db.prepare("SELECT count(*) n FROM jobs WHERE state='pending'").get().n,1);
 await session.queueRefund(order.id);await drain();assert.equal(session.store.subscription(order.account_id).active,false);assert.equal(f.calls.filter(call=>call.url.endsWith('/refundStarPayment')).length,1);
 assert.equal(session.store.db.prepare('SELECT count(*) n FROM orders').get().n,1);assert.equal(session.store.db.prepare('SELECT reversed FROM grants').get().reversed,1);assert.ok(!f.calls.some(call=>call.url.endsWith('/sendInvoice')));
 assert.ok(f.calls.every(call=>call.url.startsWith('https://api.telegram.org/bot'+TOKEN+'/test/')));
 const logs=await readFile(join(f.stateDir,'events.jsonl'),'utf8');assert.ok(!logs.includes(TOKEN)&&!logs.includes(String(USER))&&!logs.includes(String(BOT))&&!logs.includes('PRIVATE_UNALLOWLISTED_MESSAGE')&&!logs.includes(invoice.payload));
});
