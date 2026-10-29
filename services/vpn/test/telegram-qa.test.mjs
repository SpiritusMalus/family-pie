import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,chmodSync,rmSync,realpathSync,symlinkSync,linkSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {VpnStore} from '../store.mjs';
import {Accounts} from '../auth.mjs';
import {TelegramStore,deliverOne} from '../telegram.mjs';
import {TelegramCommerce} from '../telegram-commerce.mjs';
import {TelegramUI,deliverUiOne} from '../telegram-ui.mjs';
import {TelegramSupport} from '../telegram-support.mjs';
import {createTelegramQa,readTelegramQaConfig,allowsSystemdQaCredential} from '../telegram-qa.mjs';

const OWNER=1001,OTHER=1002,PLANS=[{days:30,priceMinor:30000,devices:0}];
function fixture(t,{patch={},enabled='1',credentialText,ownerPin=String(OWNER)}={}){
 const root=mkdtempSync(join(realpathSync(tmpdir()),'vpn-qa-'));chmodSync(root,0o700);
 for(const dir of ['live','qa','credentials'])mkdirSync(join(root,dir),{mode:0o700});
 let now=Date.UTC(2026,9,28),sequence=0;const clock=()=>now,livePath=join(root,'live','cabinet.sqlite'),qaPath=join(root,'qa','cabinet.sqlite');
 const store=new VpnStore(livePath,{clock}),users=new Accounts(store,{clock}),telegram=new TelegramStore(store,{clock}),commerce=new TelegramCommerce(store,{users,clock}),ui=new TelegramUI(telegram,{commerce,clock,enabled:true});
 new VpnStore(qaPath,{clock}).close();
 const config={schema:1,caseId:'owner-qa-20261028',ownerId:OWNER,expiresAt:clock()+3600000,dbPath:qaPath,webOrigin:'http://localhost:8352',plans:PLANS,...patch};
 const path=join(root,'credentials','telegram-qa');writeFileSync(path,credentialText??JSON.stringify(config),{mode:0o600});
 const env={VPN_TELEGRAM_QA_ENABLED:enabled,VPN_TELEGRAM_QA_OWNER_ID:ownerPin,VPN_DATABASE_PATH:livePath,CREDENTIALS_DIRECTORY:join(root,'credentials'),VPN_TELEGRAM_BOT_USERNAME:'synthetic_qa_bot'},statuses=[],onStatus=message=>statuses.push(message);
 let qa=createTelegramQa(telegram,ui,{env,clock,onStatus});telegram.ui=qa?.proxy||ui;
 t.after(()=>{qa?.close();store.close();rmSync(root,{recursive:true,force:true});});
 const calls=[],client={call:async(method,data)=>{calls.push({method,data});return {message_id:calls.length,chat:{id:Number(data.chat_id)||OWNER,type:'private'}};}};
 const update=body=>{const value={update_id:++sequence,...body};telegram.update(value);return value;};
 const message=(text,{actor=OWNER,chat=actor,patch={}}={})=>update({message:{message_id:sequence+1,chat:{id:chat,type:'private'},from:{id:actor,is_bot:false},text,...patch}});
 const drain=async()=>{for(let n=0;n<60;n++){qa?.prepare();await qa?.controls(client);let sent=false;for(const send of [()=>deliverUiOne(ui,client),()=>deliverOne(telegram,client),...(qa?.deliveries(client)||[])])sent=await send()||sent;if(!sent)return;}assert.fail('QA test delivery backlog');};
 return {root,path,qaPath,livePath,store,users,telegram,ui,commerce,config,env,clock,calls,client,update,message,drain,statuses,
  get qa(){return qa;},advance:ms=>now+=ms,reopen:()=>{qa?.close();qa=createTelegramQa(telegram,ui,{env,clock,onStatus});telegram.ui=qa?.proxy||ui;return qa;},
  counts:target=>({accounts:target.db.prepare('SELECT count(*) n FROM accounts').get().n,orders:target.db.prepare('SELECT count(*) n FROM orders').get().n,grants:target.db.prepare('SELECT count(*) n FROM grants').get().n})};
}

test('QA default off reads no credential and preserves production navigation',async t=>{
 const f=fixture(t,{enabled:'0'});assert.equal(f.qa,null);rmSync(f.path);f.message('/terms');await f.drain();assert.equal(f.counts(f.store).accounts,0);assert.ok(f.calls.some(x=>x.data.text?.includes('Принимаю и продолжаю')));assert.ok(f.calls.every(x=>!x.data.text?.startsWith('TEST')));
});

test('same genuine notice and public text register only the allowlisted QA account, then render TEST RUB checkout',async t=>{
 const f=fixture(t);assert.equal(f.qa.failed,false);assert.deepEqual(f.counts(f.qa.store),{accounts:0,orders:0,grants:0});
 f.message('Принимаю и продолжаю');await f.drain();assert.equal(f.counts(f.qa.store).accounts,0);
 f.message('/terms');await f.drain();const notice=f.qa.store.db.prepare('SELECT * FROM telegram_registration_notices').get();assert.ok(notice.delivered_at);assert.equal(f.counts(f.qa.store).accounts,0);
 f.message('Принимаю и продолжаю');await f.drain();assert.equal(f.counts(f.qa.store).accounts,1);assert.equal(f.counts(f.store).accounts,0);
 assert.equal(f.qa.store.db.prepare('SELECT registered_chat FROM telegram_native_accounts').get().registered_chat,String(OWNER));
 f.message('/renew 30');await f.drain();const checkout=f.calls.at(-1).data;assert.match(checkout.text,/^TEST · без реальных списаний/);const link=checkout.reply_markup.inline_keyboard.flat().find(x=>x.text==='Перейти на сайт');assert.equal(new URL(link.url).origin,'http://localhost:8352');assert.equal(new URL(link.url).searchParams.get('period'),'30');
 assert.deepEqual(f.counts(f.qa.store),{accounts:1,orders:0,grants:0});assert.ok(!f.calls.some(x=>['sendInvoice','refundStarPayment'].includes(x.method)));
 const durable=JSON.stringify(f.qa.store.db.prepare('SELECT payload FROM telegram_ui_outbox').all());assert.ok(!durable.includes(link.url));
 assert.equal(f.qa.store.db.prepare('SELECT initial_accounts FROM telegram_qa_case').get().initial_accounts,0);
 f.reopen();assert.equal(f.qa.failed,false);assert.equal(f.counts(f.qa.store).accounts,1);
});

test('private actor isolation keeps other users production and rejects mismatched/chat/group/forwarded acceptance',async t=>{
 const f=fixture(t);f.message('/terms',{actor:OTHER});await f.drain();assert.equal(f.qa.qaTelegram.offset(),0);assert.ok(!f.calls.at(-1).data.text.startsWith('TEST'));
 f.message('/terms',{actor:OTHER,chat:OWNER});f.update({message:{message_id:3,chat:{id:OWNER,type:'group'},from:{id:OWNER,is_bot:false},text:'/terms'}});assert.equal(f.qa.qaTelegram.offset(),0);
 f.message('/terms');await f.drain();f.message('Принимаю и продолжаю',{patch:{forward_origin:{type:'user'}}});await f.drain();assert.equal(f.counts(f.qa.store).accounts,0);
});

test('financial precheckout, successful payment and refund always use production even for QA owner',t=>{
 const f=fixture(t),seen=[];f.commerce.preCheckout=query=>(seen.push('precheckout'),{pre_checkout_query_id:query.id,ok:false});f.commerce.successfulPayment=()=>{seen.push('paid');return {duplicate:false};};f.commerce.refundedPayment=()=>{seen.push('refund');return {duplicate:false};};
 f.update({pre_checkout_query:{id:'private-query',from:{id:OWNER},currency:'XTR'}});f.message('',{patch:{successful_payment:{currency:'XTR'}}});f.message('',{patch:{refunded_payment:{currency:'XTR'}}});
 assert.deepEqual(seen,['precheckout','paid','refund']);assert.equal(f.qa.qaTelegram.offset(),0);assert.equal(f.qa.store.db.prepare('SELECT count(*) n FROM telegram_ui_outbox').get().n,0);
 f.advance(3600001);f.message('',{patch:{refunded_payment:{currency:'XTR'}}});assert.equal(seen.at(-1),'refund');
});

test('recovery, email, binding, support commands and replies remain production',t=>{
 const f=fixture(t);let supportReplies=0;f.telegram.support={handle:()=>{supportReplies++;return true;},operator:()=>null};
 f.message('/recover');f.message('/email');f.message('/start bind_invalid');f.message('/help');f.message('operator response',{patch:{reply_to_message:{message_id:10}}});
 assert.equal(f.qa.qaTelegram.offset(),0);assert.equal(supportReplies,2);assert.equal(f.store.db.prepare("SELECT count(*) n FROM telegram_outbox WHERE stage IN ('recovery','support_email')").get().n,2);
 assert.equal(f.store.db.prepare("SELECT count(*) n FROM telegram_ui_outbox WHERE view='binding'").get().n,1);
 assert.equal(f.counts(f.store).accounts,0);assert.equal(f.counts(f.qa.store).accounts,0);
});

test('QA commit precedes production cursor and replay after a live rollback never duplicates the QA intent',t=>{
 const f=fixture(t),original=f.store.transaction.bind(f.store),actual={update_id:50,message:{message_id:50,chat:{id:OWNER,type:'private'},from:{id:OWNER,is_bot:false},text:'/terms'}};
 f.store.transaction=fn=>original(()=>{fn();assert.equal(f.qa.qaTelegram.offset(),51);throw new Error('Synthetic live commit failure');});
 assert.throws(()=>f.telegram.update(actual),/Synthetic live commit failure/);assert.equal(f.telegram.offset(),0);assert.equal(f.qa.qaTelegram.offset(),51);assert.equal(f.qa.store.db.prepare('SELECT count(*) n FROM telegram_ui_outbox').get().n,1);
 f.store.transaction=original;f.telegram.update(actual);assert.equal(f.telegram.offset(),51);assert.equal(f.qa.store.db.prepare('SELECT count(*) n FROM telegram_ui_outbox').get().n,1);
});

test('failed QA update is durably fenced and never falls through; financial polling remains usable',t=>{
 const f=fixture(t);f.qa.qaTelegram.update=()=>{throw new Error('PRIVATE synthetic diagnostic');};f.message('/terms');assert.equal(f.telegram.offset(),2);assert.equal(f.qa.failed,true);assert.equal(f.qa.qaTelegram.offset(),0);assert.equal(f.counts(f.store).accounts,0);
 const receipt=f.store.db.prepare('SELECT text FROM telegram_outbox').get().text;assert.match(receipt,/TEST сейчас недоступен/);assert.doesNotMatch(receipt,/PRIVATE/);
 let financial=false;f.commerce.preCheckout=()=>{financial=true;return {pre_checkout_query_id:'q',ok:false};};f.update({pre_checkout_query:{id:'q',from:{id:OWNER}}});assert.equal(financial,true);
});

test('expired case remains fenced across restart and cancels queued QA handoffs',async t=>{
 const f=fixture(t);f.message('/terms');assert.equal(f.qa.pending(),true);f.advance(3600001);f.qa.prepare();await f.drain();assert.equal(f.qa.pending(),false);assert.ok(!f.calls.some(x=>x.data.text?.includes('Принимаю и продолжаю')));
 f.reopen();assert.equal(f.qa.failed,false);f.message('/terms');await f.drain();assert.match(f.calls.at(-1).data.text,/TEST сейчас недоступен/);assert.deepEqual(f.counts(f.store),{accounts:0,orders:0,grants:0});
});

test('old live registration and checkout callbacks are fenced, while a production financial receipt is preserved',async t=>{
 const f=fixture(t),old=f.ui.button(String(OWNER),'Accept','accept_terms',{});f.ui.queue(String(OWNER),'old-terms','terms');f.ui.queue(String(OWNER),'old-paid','paid');f.qa.prepare();
 assert.equal(f.store.db.prepare("SELECT state FROM telegram_ui_outbox WHERE dedupe='old-terms'").get().state,'canceled');assert.equal(f.store.db.prepare("SELECT state FROM telegram_ui_outbox WHERE dedupe='old-paid'").get().state,'pending');
 f.update({callback_query:{id:'old',from:{id:OWNER,is_bot:false},message:{message_id:10,chat:{id:OWNER,type:'private'}},data:old.callback_data}});assert.equal(f.qa.qaTelegram.offset(),0);assert.equal(f.counts(f.store).accounts,0);assert.equal(f.counts(f.qa.store).accounts,0);
});

test('malformed or secret-bearing enabled credential fences UI without opening QA state or stopping finance',t=>{
 for(const credentialText of ['{',JSON.stringify({schema:1,merchantSecret:'NOT-A-REAL-SECRET'})]){
  const f=fixture(t,{credentialText});assert.equal(f.qa.failed,true);assert.equal(f.qa.store,null);f.message('/terms');assert.equal(f.store.db.prepare('SELECT text FROM telegram_outbox').get().text.includes('TEST'),true);assert.equal(f.counts(f.store).accounts,0);
 }
});

test('credential validation rejects loose modes, symlink/hardlink aliases, live DB and unapproved origins/plans/expiry',t=>{
 const f=fixture(t),read=()=>readTelegramQaConfig(f.path,{liveDbPath:f.livePath,ownerId:OWNER,clock:f.clock}),write=value=>writeFileSync(f.path,JSON.stringify({...f.config,...value}),{mode:0o600});
 assert.equal(read().ownerId,OWNER);chmodSync(f.path,0o644);assert.throws(read);chmodSync(f.path,0o600);
 for(const patch of [{dbPath:f.livePath},{webOrigin:'https://example.com'},{webOrigin:'http://127.0.0.1:8352'},{plans:[{days:30,priceMinor:1,devices:0}]},{expiresAt:f.clock()+10800001},{ownerId:0},{shopId:'not-real'}]){write(patch);assert.throws(read);}
 const alias=join(f.root,'qa','alias.sqlite');symlinkSync(f.qaPath,alias);write({dbPath:alias});assert.throws(read);rmSync(alias);linkSync(f.qaPath,alias);write({dbPath:alias});assert.throws(read);rmSync(alias);write({});
});

test('unmarked nonempty or changed-case QA DB is fenced before it can become a different account store',async t=>{
 const f=fixture(t);f.qa.close();const qaStore=new VpnStore(f.qaPath);qaStore.db.exec('DROP TABLE telegram_qa_case');qaStore.createAccount('synthetic@accounts.invalid');qaStore.close();f.reopen();assert.equal(f.qa.failed,true);assert.equal(f.qa.store,null);
 const g=fixture(t);g.message('/terms');await g.drain();g.message('Принимаю и продолжаю');await g.drain();writeFileSync(g.path,JSON.stringify({...g.config,caseId:'different-qa-case'}));g.reopen();assert.equal(g.qa.failed,true);assert.equal(g.qa.store,null);
});

test('worker wiring keeps exactly one getUpdates consumer and no merchant or QA provider constructor',()=>{
 const source=readFileSync(new URL('../telegram-worker.mjs',import.meta.url),'utf8');assert.equal((source.match(/client\.call\('getUpdates'/g)||[]).length,1);assert.match(source,/telegram\.ui=qa\?\.proxy\|\|ui/);assert.match(source,/qa\?\.controls\(client\)/);assert.match(source,/qa\.deliveries\(client\)/);assert.doesNotMatch(source,/YooKassa|SHOP_ID|SHOP_SECRET|secret-key/);
});

test('actual QA callbacks remain actor-bound, acknowledge via current delivery guard, and link Help into real production support',async t=>{
 const f=fixture(t);f.message('/menu');await f.drain();const buttons=f.calls.at(-1).data.reply_markup.inline_keyboard.flat(),help=buttons.find(x=>x.text.includes('Помощь'));assert.equal(help.url,'https://t.me/synthetic_qa_bot?start=support_vpn');assert.equal(help.callback_data,undefined);
 const create=buttons.find(x=>x.callback_data);assert.ok(create);const query={id:'qa-button',from:{id:OTHER,is_bot:false},message:{message_id:1,chat:{id:OWNER,type:'private'}},data:create.callback_data};f.update({callback_query:query});assert.equal(f.counts(f.qa.store).accounts,0);
 f.update({callback_query:{...query,id:'qa-own-button',from:{id:OWNER,is_bot:false}}});await f.drain();assert.ok(f.calls.some(x=>x.method==='answerCallbackQuery'&&x.data.callback_query_id==='qa-own-button'));
 assert.ok(f.calls.filter(x=>x.method==='sendMessage').every(x=>x.data.text.startsWith('TEST')));
});

test('QA DB failures in pending/planning/delivery cannot trap the live financial poller',async t=>{
 for(const method of ['pending','plan','recover','controls','delivery']){
  const f=fixture(t);if(method==='pending')f.qa.ui.next=()=>{throw new Error('Synthetic unavailable QA DB');};
  else if(method==='plan')f.qa.ui.plan=()=>{throw new Error('Synthetic unavailable QA DB');};
  else if(method==='recover')f.qa.ui.recover=()=>{throw new Error('Synthetic unavailable QA DB');};
  else f.qa.ui.next=()=>{throw new Error('Synthetic unavailable QA DB');};
  if(method==='controls')await f.qa.controls(f.client);else if(method==='delivery')await f.qa.deliveries(f.client)[0]();else f.qa[method]();
  assert.equal(f.qa.failed,true);let used=false;f.commerce.preCheckout=()=>{used=true;return {pre_checkout_query_id:'finance',ok:false};};f.update({pre_checkout_query:{id:'finance',from:{id:OWNER}}});assert.equal(used,true);
 }
});

test('invalid JSON, mismatched credential owner, or missing credential fence only the separately pinned owner',async t=>{
 for(const scenario of ['json','owner','missing']){
  const f=fixture(t,{credentialText:scenario==='json'?'{':undefined,patch:scenario==='owner'?{ownerId:OTHER}:{}});
  if(scenario==='missing'){rmSync(f.path);f.reopen();}
  assert.equal(f.qa.failed,true);assert.equal(f.qa.ownerId,OWNER);assert.ok(f.statuses.some(x=>x.includes('fenced for configured owner')));
  f.message('/terms',{actor:OTHER});await f.drain();assert.ok(f.calls.at(-1).data.text.includes('Принимаю и продолжаю'));assert.ok(!f.calls.at(-1).data.text.startsWith('TEST'));
  f.message('/terms');await f.drain();assert.match(f.calls.at(-1).data.text,/^TEST сейчас недоступен/);assert.equal(f.counts(f.store).accounts,0);
  f.ui.queue(String(OTHER),'other-pending','terms');f.qa.prepare();assert.equal(f.store.db.prepare("SELECT state FROM telegram_ui_outbox WHERE dedupe='other-pending'").get().state,'pending');
 }
});

test('missing or noncanonical independent owner pin cannot arm QA or suppress any customer navigation',async t=>{
 for(const ownerPin of [undefined,'','0','+1001','01001','1e3','1001 ',String(Number.MAX_SAFE_INTEGER+1)]){
  const f=fixture(t,{ownerPin:ownerPin===undefined?'':ownerPin});if(ownerPin===undefined){delete f.env.VPN_TELEGRAM_QA_OWNER_ID;f.reopen();}
  assert.equal(f.qa,null);assert.ok(f.statuses.some(x=>x.includes('not armed')));f.message('/terms');await f.drain();assert.ok(f.calls.at(-1).data.text.includes('Принимаю и продолжаю'));assert.ok(!f.calls.at(-1).data.text.startsWith('TEST'));
 }
});

test('deliberate owner QA terms/menu navigation exits stale live support UI context and typed consent creates only QA',async t=>{
 for(const navigation of ['/terms','/menu']){
  const f=fixture(t),support=new TelegramSupport(f.store,{clock:f.clock,botId:9999});f.telegram.support=support;support.operator=()=>({chat_id:'2000',generation:'synthetic-operator'});
  f.message('/help');assert.equal(f.store.db.prepare('SELECT mode FROM telegram_ui_state WHERE chat_id=?').get(String(OWNER)).mode,'support');
  f.message('ordinary support message');assert.equal(f.qa.qaTelegram.offset(),0);assert.equal(f.store.db.prepare('SELECT count(*) n FROM telegram_support_tickets').get().n,1);
  const supportSnapshot=()=>JSON.stringify(['telegram_support_customers','telegram_support_tickets','telegram_support_messages','telegram_support_receipts','telegram_support_outbox'].map(table=>f.store.db.prepare('SELECT * FROM '+table).all()));
  const before=supportSnapshot(),liveOutbox=f.store.db.prepare('SELECT count(*) n FROM telegram_ui_outbox').get().n;
  f.message(navigation);await f.drain();assert.equal(f.store.db.prepare('SELECT mode FROM telegram_ui_state WHERE chat_id=?').get(String(OWNER)).mode,'menu');
  if(navigation==='/menu'){f.message('/terms');await f.drain();}
  f.message('Принимаю и продолжаю');await f.drain();assert.equal(f.counts(f.qa.store).accounts,1);assert.equal(f.counts(f.store).accounts,0);assert.equal(supportSnapshot(),before);assert.equal(f.store.db.prepare('SELECT count(*) n FROM telegram_ui_outbox').get().n,liveOutbox);
 }
});

test('ordinary text, replies, forwarded navigation and precheckout/recovery do not clear production support context',t=>{
 const f=fixture(t),support=new TelegramSupport(f.store,{clock:f.clock,botId:9999});f.telegram.support=support;support.operator=()=>({chat_id:'2000',generation:'synthetic-operator'});f.message('/help');
 for(const [text,extra] of [['ordinary message',{}],['Принимаю и продолжаю',{}],['/terms',{reply_to_message:{message_id:5}}],['/terms',{forward_origin:{type:'user'}}],['/recover',{}]]){
  f.message(text,{patch:extra});assert.equal(f.store.db.prepare('SELECT mode FROM telegram_ui_state WHERE chat_id=?').get(String(OWNER)).mode,'support');assert.equal(f.counts(f.store).accounts,0);assert.equal(f.counts(f.qa.store).accounts,0);
 }
 f.commerce.preCheckout=()=>({pre_checkout_query_id:'support-finance',ok:false});f.update({pre_checkout_query:{id:'support-finance',from:{id:OWNER}}});assert.equal(f.store.db.prepare('SELECT mode FROM telegram_ui_state WHERE chat_id=?').get(String(OWNER)).mode,'support');
});

function systemdMetadata(){
 const credentialDirectory='/run/credentials/family-vpn-telegram.service';
 const parent={uid:0,gid:0,mode:0o40550,dev:17,ino:10,isDirectory:()=>true,isSymbolicLink:()=>false};
 const file={uid:0,gid:0,mode:0o100440,dev:17,ino:11,nlink:1,isFile:()=>true,isSymbolicLink:()=>false};
 return {path:credentialDirectory+'/telegram-qa',credentialDirectory,canonicalDirectory:credentialDirectory,canonicalPath:credentialDirectory+'/telegram-qa',parent,file,current:{...file},parentAfter:{...parent},platform:'linux',mountInfo:'12 8 0:17 / '+credentialDirectory+' ro,nosuid,nodev,noexec,relatime,nosymfollow - tmpfs tmpfs rw,size=1024k,mode=700\n'};
}

test('systemd root0550/root0440 credentials are accepted only in the exact per-service read-only mount',()=>{
 const value=systemdMetadata();assert.equal(allowsSystemdQaCredential(value),true);
 assert.equal(allowsSystemdQaCredential({...value,mountInfo:value.mountInfo.replace(' - tmpfs tmpfs ',' - ramfs ramfs ')}),true);
 // The manager's backing superblock is writable; the service's mount is read-only.
 assert.ok(value.mountInfo.includes(' - tmpfs tmpfs rw,'));
});

test('systemd credential exception rejects wrong namespace, ordinary group-readable files, aliases and non-Linux',()=>{
 const value=systemdMetadata();
 for(const change of [
  {credentialDirectory:undefined},{credentialDirectory:'/tmp/credentials/family-vpn-telegram.service'},
  {credentialDirectory:'/run/credentials/@system'},{credentialDirectory:'/run/credentials/../family-vpn-telegram.service'},
  {path:value.credentialDirectory+'/bot-token'},{canonicalPath:'/different/telegram-qa'},
  {canonicalDirectory:'/different/service'},{platform:'darwin'},
  {mountInfo:''},{mountInfo:value.mountInfo+value.mountInfo},
  {mountInfo:value.mountInfo.replace('ro,nosuid','rw,nosuid')},
  {mountInfo:value.mountInfo.replace('ro,nosuid,','ro,')},
  {mountInfo:value.mountInfo.replace(' - tmpfs tmpfs ',' - ext4 /dev/sda ')}
 ])assert.equal(allowsSystemdQaCredential({...value,...change}),false);
});

test('systemd credential exception rejects changed ownership, other access, writable masks, symlinks and inode swaps',()=>{
 const value=systemdMetadata();
 for(const [key,changes] of [
  ['parent',{uid:1001}],['parent',{gid:1001}],['parent',{mode:0o40551}],['parent',{mode:0o40570}],
  ['parent',{isSymbolicLink:()=>true}],['file',{uid:1001}],['file',{gid:1001}],
  ['file',{mode:0o100444}],['file',{mode:0o100460}],['file',{mode:0o100450}],
  ['file',{isSymbolicLink:()=>true}],['file',{nlink:2}],['file',{dev:18}],
  ['current',{ino:99}],['current',{mode:0o100660}],['parentAfter',{ino:99}],['parentAfter',{mode:0o40750}]
 ])assert.equal(allowsSystemdQaCredential({...value,[key]:{...value[key],...changes}}),false);
});

test('systemd loader context does not relax ordinary credential, QA directory or database permissions',t=>{
 const f=fixture(t),read=()=>readTelegramQaConfig(f.path,{liveDbPath:f.livePath,ownerId:OWNER,clock:f.clock,credentialDirectory:f.env.CREDENTIALS_DIRECTORY});
 assert.equal(read().ownerId,OWNER);
 chmodSync(f.path,0o440);chmodSync(f.env.CREDENTIALS_DIRECTORY,0o550);assert.throws(read);
 chmodSync(f.path,0o600);chmodSync(f.env.CREDENTIALS_DIRECTORY,0o700);
 chmodSync(f.qaPath,0o640);assert.throws(read);chmodSync(f.qaPath,0o600);
 chmodSync(join(f.root,'qa'),0o750);assert.throws(read);chmodSync(join(f.root,'qa'),0o700);
 assert.equal(read().ownerId,OWNER);
});
