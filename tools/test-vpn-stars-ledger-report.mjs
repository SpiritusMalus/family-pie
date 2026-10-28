import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtemp,writeFile,readFile,rm,lstat,access,symlink,chmod,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {createLedgerReport,readLedgerReportConfig,LedgerReportError,main} from './vpn-stars-ledger-report.mjs';
const TOKEN='123456:FICTIONAL_TOKEN_FOR_SYNTHETIC_TESTS_ONLY',BOT=987654321,USER=123456789,NOW=1_800_000_000_000;
const payload='a'.repeat(32),paidPayload='b'.repeat(32);
const hash=value=>createHash('sha256').update(value).digest('hex');
const transaction=(patch={})=>({id:'SYNTHETIC-CHARGE-PENDING',amount:10,date:NOW/1000-129600,source:{type:'user',transaction_type:'invoice_payment',user:{id:USER,is_bot:false},invoice_payload:payload},...patch});
async function fixture(t,{environment='test',pages=[[]],patch={}}={}){
 const dir=await mkdtemp(join(tmpdir(),'stars-ledger-fixture-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const credentialFile=join(dir,'fictional.token'),databaseSnapshotFile=join(dir,'consistent.sqlite.bak'),outputFile=join(dir,'report.json'),configPath=join(dir,'config.json');
 await writeFile(credentialFile,TOKEN,{mode:0o600});const db=new DatabaseSync(databaseSnapshotFile);db.exec(`
 CREATE TABLE orders(id TEXT PRIMARY KEY,provider_charge_id TEXT,payment_actor TEXT,payment_amount INTEGER,state TEXT,created_at INTEGER,provider TEXT,currency TEXT);
 CREATE TABLE telegram_orders(order_id TEXT PRIMARY KEY,payload TEXT,precheckout_id TEXT);
 CREATE TABLE telegram_refunds(order_id TEXT PRIMARY KEY,state TEXT);
 CREATE TABLE grants(order_id TEXT PRIMARY KEY,reversed INTEGER);
 `);
 const insert=db.prepare('INSERT INTO orders VALUES(?,?,?,?,?,?,?,?)');insert.run('own-pending',null,String(USER),10,'pending',NOW-172800000,'telegram-stars','XTR');insert.run('own-paid','SYNTHETIC-CHARGE-PAID',String(USER),20,'paid',NOW-172800000,'telegram-stars','XTR');
 db.prepare('INSERT INTO telegram_orders VALUES(?,?,?)').run('own-pending',payload,'synthetic-precheckout');db.prepare('INSERT INTO telegram_orders VALUES(?,?,?)').run('own-paid',paidPayload,'synthetic-paid-precheckout');db.prepare('INSERT INTO grants VALUES(?,0)').run('own-paid');db.prepare('INSERT INTO telegram_refunds VALUES(?,?)').run('own-paid','uncertain');db.close();await chmod(databaseSnapshotFile,0o600);
 const config={mode:'report',environment,credentialFile,expectedBot:{id:BOT,username:'fictional_test_bot'},databaseSnapshotFile,outputFile,pageSize:100,maxPages:5,...patch};await writeFile(configPath,JSON.stringify(config),{mode:0o600});const calls=[];
 const request=async(url,options)=>{const method=url.split('/').at(-1),data=JSON.parse(options.body);calls.push({url,method,data});assert.ok(['getMe','getStarTransactions'].includes(method),'Forbidden API method');return {ok:true,json:async()=>({ok:true,result:method==='getMe'?{id:BOT,is_bot:true,username:'fictional_test_bot'}:{transactions:pages[Math.floor(data.offset/config.pageSize)]??[]}})};};
 return {dir,configPath,config,credentialFile,databaseSnapshotFile,outputFile,calls,request,options:{request,clock:()=>NOW}};
}
const missing=path=>assert.rejects(()=>access(path),error=>error.code==='ENOENT');
test('explicit report environment has no default or apply mode; bad private config makes no API or output',async t=>{
 const f=await fixture(t);
 for(const patch of [{environment:undefined},{environment:'live'},{mode:'apply'},{apply:true},{maxPages:21},{pageSize:101}]){await writeFile(f.configPath,JSON.stringify({...f.config,...patch}));await assert.rejects(()=>createLedgerReport(f.configPath,f.options),LedgerReportError);await missing(f.outputFile);assert.equal(f.calls.length,0);}
 await assert.rejects(()=>main(['--apply','ignored']),LedgerReportError);
});
test('read-only snapshot and private credential requirements reject unsafe paths before ledger calls',async t=>{
 const f=await fixture(t);await chmod(f.credentialFile,0o644);await assert.rejects(()=>createLedgerReport(f.configPath,f.options),error=>error.code==='PRIVATE_CREDENTIAL_UNAVAILABLE');assert.equal(f.calls.length,0);await chmod(f.credentialFile,0o600);
 const link=join(f.dir,'linked.token');await symlink(f.credentialFile,link);await writeFile(f.configPath,JSON.stringify({...f.config,credentialFile:link}));await assert.rejects(()=>createLedgerReport(f.configPath,f.options),LedgerReportError);assert.equal(f.calls.length,0);
 await writeFile(f.configPath,JSON.stringify(f.config));await writeFile(f.databaseSnapshotFile+'-wal','do-not-open');await assert.rejects(()=>createLedgerReport(f.configPath,f.options),error=>error.code==='CLOSED_BACKUP_WITHOUT_SIDECARS_REQUIRED');assert.deepEqual(f.calls.map(c=>c.method),['getMe']);await missing(f.outputFile);
});
test('wrong bot and rejected credentials never fetch ledger or fall back between environments',async t=>{
 for(const environment of ['test','production']){const f=await fixture(t,{environment}),calls=[];const request=async url=>{calls.push(url);return {ok:false,status:401,json:async()=>({ok:false,error_code:401,description:TOKEN})};};await assert.rejects(()=>createLedgerReport(f.configPath,{...f.options,request}),error=>error.code==='BOT_PREFLIGHT_FAILED'&&!error.message.includes(TOKEN));assert.deepEqual(calls,['https://api.telegram.org/bot'+TOKEN+'/'+(environment==='test'?'test/':'')+'getMe']);await missing(f.outputFile);}
 const f=await fixture(t);await assert.rejects(()=>createLedgerReport(f.configPath,{...f.options,request:async()=>({ok:true,json:async()=>({ok:true,result:{id:BOT+1,is_bot:true,username:'fictional_test_bot'}})})}),error=>error.code==='BOT_IDENTITY_MISMATCH');await missing(f.outputFile);
});
test('missed payment and uncertain refund are reported separately using the same charge ID without mutations or resends',async t=>{
 const paid=transaction({id:'SYNTHETIC-CHARGE-PAID',amount:20,source:{type:'user',transaction_type:'invoice_payment',user:{id:USER},invoice_payload:paidPayload}}),refund={id:paid.id,amount:-20,date:NOW/1000-100,receiver:{type:'user',transaction_type:'invoice_payment',user:{id:USER}}};
 const f=await fixture(t,{pages:[[transaction(),paid,refund]]}),before=hash(await readFile(f.databaseSnapshotFile)),filesBefore=(await readdir(f.dir)).sort(),report=await createLedgerReport(f.configPath,f.options);
 assert.equal(report.classifications.pending_payment_observed,1);assert.equal(report.classifications.payment_already_recorded,1);assert.equal(report.classifications.uncertain_refund_observed,1);assert.equal(report.candidates.filter(c=>c.paymentAndRefundBothObserved).length,2);assert.equal(report.appliedPayments,0);assert.equal(report.appliedRefunds,0);assert.equal(report.refundRequestsSent,0);assert.equal(report.applySupported,false);assert.equal(report.fullHistoricalCoverageProven,false);
 assert.equal(hash(await readFile(f.databaseSnapshotFile)),before);assert.deepEqual((await readdir(f.dir)).sort(),[...filesBefore,'report.json'].sort());assert.equal((await lstat(f.outputFile)).mode&0o777,0o600);assert.ok(f.calls.every(c=>c.url.includes('/test/')));
 const written=await readFile(f.outputFile,'utf8');for(const secret of [TOKEN,String(USER),payload,paidPayload,'SYNTHETIC-CHARGE-PAID'])assert.ok(!written.includes(secret));
 await assert.rejects(()=>createLedgerReport(f.configPath,f.options),error=>error.code==='NEW_REPORT_REQUIRED');assert.equal(hash(await readFile(f.databaseSnapshotFile)),before);
});
test('optional payload, wrong actor/amount, recurring and fractional evidence never become matched recovery candidates',async t=>{
 const rows=[transaction({source:{type:'user',transaction_type:'invoice_payment',user:{id:USER}}}),transaction({id:'other-actor',source:{type:'user',transaction_type:'invoice_payment',user:{id:USER+1},invoice_payload:payload}}),transaction({id:'wrong-amount',amount:11}),transaction({id:'fractional',nanostar_amount:1}),transaction({id:'recurring',source:{type:'user',transaction_type:'invoice_payment',user:{id:USER},invoice_payload:payload,subscription_period:2592000}}),transaction({id:'gift',source:{type:'user',transaction_type:'gift_purchase',user:{id:USER}}})];
 const f=await fixture(t,{pages:[rows]}),r=await createLedgerReport(f.configPath,f.options);assert.equal(r.candidates.length,0);for(const key of ['unmatched_missing_payload','actor_mismatch','amount_mismatch','malformed_or_fractional'])assert.equal(r.classifications[key],1);assert.equal(r.classifications.unsupported_partner_or_recurring,2);
});
test('paging is bounded, overlap idempotent, and absent refunds never imply failed refunds',async t=>{
 const row=transaction(),f=await fixture(t,{patch:{pageSize:1,maxPages:2},pages:[[row],[row]]}),r=await createLedgerReport(f.configPath,f.options);assert.equal(r.stopReason,'page_bound');assert.equal(r.pageSequenceTerminated,false);assert.equal(r.fullHistoricalCoverageProven,false);assert.equal(r.candidates.length,1);assert.equal(r.classifications.duplicate_evidence,1);assert.deepEqual(f.calls.filter(c=>c.method==='getStarTransactions').map(c=>c.data),[{offset:0,limit:1},{offset:1,limit:1}]);assert.equal(r.refundRequestsSent,0);
});
test('partial or malformed provider pages keep coverage unknown and never invoke mutating API methods',async t=>{
 const f=await fixture(t),calls=[];const request=async(url,options)=>{const method=url.split('/').at(-1);calls.push(method);if(method==='getMe')return f.request(url,options);throw new Error('Untrusted provider detail '+TOKEN);};const r=await createLedgerReport(f.configPath,{...f.options,request});assert.equal(r.stopReason,'provider_unavailable');assert.equal(r.pages,0);assert.equal(r.fullHistoricalCoverageProven,false);assert.equal(r.refundRequestsSent,0);assert.ok(!JSON.stringify(r).includes(TOKEN));assert.deepEqual(calls,['getMe','getStarTransactions']);
});
test('malformed provider page and conflicting evidence stay report-only',async t=>{
 const f=await fixture(t,{pages:[[transaction(),transaction({amount:11})]]}),r=await createLedgerReport(f.configPath,f.options);assert.equal(r.classifications.conflicting_evidence,1);assert.equal(r.candidates[0].conflictingEvidence,true);assert.equal(r.appliedPayments,0);
 const invalid=await fixture(t);const result=await createLedgerReport(invalid.configPath,{...invalid.options,request:async(url,options)=>url.endsWith('/getMe')?invalid.request(url,options):{ok:true,json:async()=>({ok:true,result:{transactions:'untrusted detail '+TOKEN}})}});assert.equal(result.stopReason,'invalid_provider_page');assert.equal(result.fullHistoricalCoverageProven,false);assert.equal(result.candidates.length,0);assert.ok(!JSON.stringify(result).includes(TOKEN));
 const badRefund=transaction({source:undefined,receiver:{type:'user',transaction_type:'invoice_payment',user:{id:USER+1},invoice_payload:payload}}),actor=await fixture(t,{pages:[[transaction(),badRefund]]}),negative=await createLedgerReport(actor.configPath,actor.options);assert.equal(negative.classifications.actor_mismatch,1);assert.equal(negative.candidates.length,1);assert.equal(negative.candidates[0].paymentAndRefundBothObserved,undefined);
});
test('snapshot modification while collecting provider pages aborts without writing a misleading report',async t=>{
 const f=await fixture(t);const request=async(url,options)=>{if(url.endsWith('/getStarTransactions')){const db=new DatabaseSync(f.databaseSnapshotFile);db.prepare("UPDATE orders SET state='refunded' WHERE id='own-paid'").run();db.close();}return f.request(url,options);};await assert.rejects(()=>createLedgerReport(f.configPath,{...f.options,request}),error=>error.code==='SNAPSHOT_CHANGED');await missing(f.outputFile);
});
test('refunded order is settled only with exactly one reversed grant in both ledger directions',async t=>{
 const incoming=transaction({id:'SYNTHETIC-CHARGE-PAID',amount:20,source:{type:'user',transaction_type:'invoice_payment',user:{id:USER},invoice_payload:paidPayload}}),outgoing={id:incoming.id,amount:-20,date:NOW/1000-100,receiver:{type:'user',transaction_type:'invoice_payment',user:{id:USER}}};
 for(const kind of ['missing','live','duplicate','reversed']){
  const f=await fixture(t,{pages:[[incoming,outgoing]]}),db=new DatabaseSync(f.databaseSnapshotFile);db.prepare("UPDATE orders SET state='refunded' WHERE id='own-paid'").run();
  if(kind==='missing')db.prepare("DELETE FROM grants WHERE order_id='own-paid'").run();
  if(kind==='reversed')db.prepare("UPDATE grants SET reversed=1 WHERE order_id='own-paid'").run();
  if(kind==='duplicate'){db.exec("DROP TABLE grants; CREATE TABLE grants(order_id TEXT,reversed INTEGER); INSERT INTO grants VALUES('own-paid',1),('own-paid',1)");}
  db.close();const before=hash(await readFile(f.databaseSnapshotFile)),r=await createLedgerReport(f.configPath,f.options);assert.equal(hash(await readFile(f.databaseSnapshotFile)),before);assert.equal(r.appliedPayments,0);assert.equal(r.appliedRefunds,0);
  if(kind==='reversed'){assert.equal(r.classifications.payment_already_refunded,1);assert.equal(r.classifications.refund_already_recorded,1);assert.equal(r.classifications.order_state_review,undefined);}
  else{assert.equal(r.classifications.order_state_review,2,kind);assert.equal(r.classifications.payment_already_refunded,undefined,kind);assert.equal(r.classifications.refund_already_recorded,undefined,kind);}
 }
});
test('incoming settled states require the matching immutable saved charge even when payload and grant match',async t=>{
 const incoming=transaction({id:'SYNTHETIC-CHARGE-PAID',amount:20,source:{type:'user',transaction_type:'invoice_payment',user:{id:USER},invoice_payload:paidPayload}});
 for(const state of ['paid','refunded']){
  const f=await fixture(t,{pages:[[incoming]]}),db=new DatabaseSync(f.databaseSnapshotFile);db.prepare("UPDATE orders SET state=?,provider_charge_id=NULL WHERE id='own-paid'").run(state);if(state==='refunded')db.prepare("UPDATE grants SET reversed=1 WHERE order_id='own-paid'").run();db.close();
  const r=await createLedgerReport(f.configPath,f.options);assert.equal(r.classifications.order_state_review,1,state);assert.equal(r.classifications.payment_already_recorded,undefined,state);assert.equal(r.classifications.payment_already_refunded,undefined,state);assert.equal(r.appliedPayments,0);assert.equal(r.refundRequestsSent,0);
 }
});
