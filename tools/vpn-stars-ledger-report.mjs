// Manual report-only ledger inspection. No polling, payment application or refund calls.
import {DatabaseSync} from 'node:sqlite';
import {constants,createReadStream} from 'node:fs';
import {open,lstat,realpath,readFile} from 'node:fs/promises';
import {dirname,basename,join,isAbsolute,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {TelegramClient} from '../services/vpn/telegram.mjs';

export class LedgerReportError extends Error {constructor(code){super('Stars ledger report: '+code);this.code=code;}}
const requireThat=(ok,code)=>{if(!ok)throw new LedgerReportError(code);};
const hash=value=>createHash('sha256').update(value).digest('hex');
const positive=value=>Number.isSafeInteger(value)&&value>0;
const own=st=>process.getuid===undefined||st.uid===process.getuid()||process.getuid()===0;
const inside=(path,root)=>path===root||path.startsWith(root+'/');
const liveRoots=['/etc/family-vpn','/private/etc/family-vpn','/var/lib/family-vpn','/private/var/lib/family-vpn','/opt/family-vpn','/run/credentials'];
async function canonical(path){requireThat(typeof path==='string'&&isAbsolute(path),'ABSOLUTE_PATH_REQUIRED');return join(await realpath(dirname(path)),basename(path));}
async function privateFile(path,maxBytes){
 const st=await lstat(path);requireThat(st.isFile()&&!st.isSymbolicLink()&&st.nlink===1&&own(st)&&(st.mode&0o077)===0&&st.size<=maxBytes,'PRIVATE_FILE_REQUIRED');return st;
}
async function privateText(path,maxBytes){
 path=await canonical(path);const before=await privateFile(path,maxBytes),file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
 try{const st=await file.stat();requireThat(st.ino===before.ino&&st.dev===before.dev&&st.size<=maxBytes&&st.nlink===1&&own(st)&&(st.mode&0o077)===0,'PRIVATE_FILE_CHANGED');return await file.readFile('utf8');}finally{await file.close();}
}
async function fileHash(path){const h=createHash('sha256');for await(const chunk of createReadStream(path))h.update(chunk);return h.digest('hex');}
export async function readLedgerReportConfig(path){
 let config;try{config=JSON.parse(await privateText(path,16384));}catch(error){if(error instanceof LedgerReportError)throw error;throw new LedgerReportError('PRIVATE_CONFIG_INVALID');}
 const keys=new Set(['mode','environment','credentialFile','expectedBot','databaseSnapshotFile','outputFile','pageSize','maxPages']);
 requireThat(config&&typeof config==='object'&&!Array.isArray(config)&&Object.keys(config).every(key=>keys.has(key))&&config.mode==='report'&&['test','production'].includes(config.environment),'EXPLICIT_REPORT_ENVIRONMENT_REQUIRED');
 requireThat(positive(config.expectedBot?.id)&&typeof config.expectedBot.username==='string'&&/^[A-Za-z0-9_]{5,32}$/.test(config.expectedBot.username)&&/bot$/i.test(config.expectedBot.username),'EXPECTED_BOT_REQUIRED');
 const pageSize=config.pageSize??100,maxPages=config.maxPages??5;
 requireThat(Number.isSafeInteger(pageSize)&&pageSize>=1&&pageSize<=100&&Number.isSafeInteger(maxPages)&&maxPages>=1&&maxPages<=20,'BOUNDED_PAGING_REQUIRED');
 const credentialFile=await canonical(config.credentialFile),databaseSnapshotFile=await canonical(config.databaseSnapshotFile),outputFile=await canonical(config.outputFile);
 requireThat(!liveRoots.some(root=>inside(databaseSnapshotFile,root)||inside(outputFile,root)),'OFFLINE_SNAPSHOT_AND_AUDIT_REQUIRED');
 requireThat(new Set([credentialFile,databaseSnapshotFile,outputFile]).size===3,'SEPARATE_PRIVATE_FILES_REQUIRED');
 await privateFile(databaseSnapshotFile,64*1024*1024);
 const parent=await lstat(dirname(outputFile));requireThat(parent.isDirectory()&&(parent.mode&0o077)===0&&(process.getuid===undefined||parent.uid===process.getuid()),'PRIVATE_OUTPUT_PARENT_REQUIRED');
 try{await lstat(outputFile);throw new LedgerReportError('NEW_REPORT_REQUIRED');}catch(error){if(error.code!=='ENOENT')throw error;}
 return {...config,credentialFile,databaseSnapshotFile,outputFile,pageSize,maxPages};
}
async function readSnapshot(path){
 const st=await privateFile(path,64*1024*1024),file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
 try{const header=Buffer.alloc(20);await file.read(header,0,20,0);requireThat(header.subarray(0,16).equals(Buffer.from('SQLite format 3\0'))&&header[18]===1&&header[19]===1,'CLOSED_ROLLBACK_JOURNAL_BACKUP_REQUIRED');}finally{await file.close();}
 for(const suffix of ['-wal','-shm','-journal']){try{await lstat(path+suffix);throw new LedgerReportError('CLOSED_BACKUP_WITHOUT_SIDECARS_REQUIRED');}catch(error){if(error.code!=='ENOENT')throw error;}}
 const beforeHash=await fileHash(path);let db;
 try{
  db=new DatabaseSync(path,{readOnly:true});db.exec('PRAGMA query_only=ON; PRAGMA trusted_schema=OFF');
  const tables=new Map(db.prepare("SELECT name,type FROM sqlite_schema WHERE name IN ('orders','telegram_orders','telegram_refunds','grants')").all().map(row=>[row.name,row.type]));
  requireThat(['orders','telegram_orders','telegram_refunds','grants'].every(name=>tables.get(name)==='table'),'OWN_COMMERCE_SCHEMA_REQUIRED');
  const orders=db.prepare(`SELECT o.id,o.provider_charge_id,o.payment_actor,o.payment_amount,o.state,o.created_at,t.payload,t.precheckout_id,r.state refund_state,
   (SELECT count(*) FROM grants g WHERE g.order_id=o.id) grant_count,
   (SELECT max(g.reversed) FROM grants g WHERE g.order_id=o.id) grant_reversed
   FROM orders o JOIN telegram_orders t ON t.order_id=o.id LEFT JOIN telegram_refunds r ON r.order_id=o.id
   WHERE o.provider='telegram-stars' AND o.currency='XTR' LIMIT 10001`).all();
  requireThat(orders.length<=10000,'SNAPSHOT_ORDER_LIMIT');return {orders,beforeHash,identity:{ino:st.ino,dev:st.dev}};
 }catch(error){if(error instanceof LedgerReportError)throw error;throw new LedgerReportError('READ_ONLY_SNAPSHOT_INVALID');}finally{db?.close();}
}
function classifier(orders,now){
 const payloads=new Map(),charges=new Map();
 const add=(map,key,row)=>{if(key){const rows=map.get(key)||[];rows.push(row);map.set(key,rows);}};
 for(const row of orders){add(payloads,row.payload,row);add(charges,row.provider_charge_id,row);}
 const seen=new Map(),directions=new Map(),byEvidenceKey=new Map(),classifications={},candidates=[];
 const count=key=>{classifications[key]=(classifications[key]||0)+1;};
 return {classifications,candidates,accept(tx){
  if(!tx||typeof tx!=='object'||typeof tx.id!=='string'||tx.id.length<1||tx.id.length>512||!Number.isSafeInteger(tx.amount)||!positive(tx.date)||tx.date>Math.floor(now/1000)+300||tx.nanostar_amount!==undefined&&tx.nanostar_amount!==0){count('malformed_or_fractional');return;}
  if(Boolean(tx.source)===Boolean(tx.receiver)){count('unsupported_direction');return;}
  const direction=tx.source?'incoming':'outgoing',partner=tx.source||tx.receiver;
  if(partner.type!=='user'||partner.transaction_type!=='invoice_payment'||!positive(partner.user?.id)||partner.user.is_bot===true||partner.subscription_period!==undefined){count('unsupported_partner_or_recurring');return;}
  const amount=Math.abs(tx.amount);if(amount<1||amount>1_000_000||direction==='incoming'&&tx.amount<=0){count('unsupported_amount');return;}
  const payload=partner.invoice_payload;
  if(payload!==undefined&&(typeof payload!=='string'||!/^[A-Za-z0-9_-]{32}$/.test(payload))){count('malformed_payload');return;}
  const key=direction+':'+tx.id,transactionHash=hash(tx.id),proof=hash(JSON.stringify({id:tx.id,direction,amount:tx.amount,date:tx.date,actor:partner.user.id,payload:payload??null}));
  if(seen.has(key)){count(seen.get(key)===proof?'duplicate_evidence':'conflicting_evidence');if(seen.get(key)!==proof&&byEvidenceKey.has(key))byEvidenceKey.get(key).conflictingEvidence=true;return;}
  seen.set(key,proof);
  const byPayload=payload===undefined?[]:payloads.get(payload)||[],byCharge=charges.get(tx.id)||[];
  if(byPayload.length>1||byCharge.length>1){count('ambiguous_snapshot_binding');return;}
  if(byPayload.length&&byCharge.length&&byPayload[0].id!==byCharge[0].id){count('binding_conflict');return;}
  const order=byPayload[0]||byCharge[0];
  if(!order){count(payload===undefined?'unmatched_missing_payload':'unmatched_order');return;}
  if(payload!==undefined&&payload!==order.payload){count('payload_mismatch');return;}
  if(String(partner.user.id)!==order.payment_actor){count('actor_mismatch');return;}
  if(amount!==order.payment_amount){count('amount_mismatch');return;}
  if(order.provider_charge_id&&order.provider_charge_id!==tx.id){count('charge_mismatch');return;}
  if(tx.date*1000<order.created_at-300000){count('time_mismatch');return;}
  let classification;
  if(direction==='incoming')classification=!order.precheckout_id?'missing_precheckout_review':order.state==='pending'?'pending_payment_observed':order.state==='paid'&&order.provider_charge_id===tx.id&&order.grant_count===1&&order.grant_reversed===0?'payment_already_recorded':order.state==='refunded'&&order.provider_charge_id===tx.id&&order.grant_count===1&&order.grant_reversed===1?'payment_already_refunded':'order_state_review';
  else classification=!order.provider_charge_id?'refund_without_recorded_charge_review':order.state==='refunded'?(order.grant_count===1&&order.grant_reversed===1?'refund_already_recorded':'order_state_review'):order.state==='paid'&&order.grant_count===1&&order.grant_reversed===0?(order.refund_state==='uncertain'?'uncertain_refund_observed':'refund_observed'):'order_state_review';
  count(classification);const directionKey=JSON.stringify([transactionHash,order.id]),directionSet=directions.get(directionKey)||new Set();directionSet.add(direction);directions.set(directionKey,directionSet);
  const candidate={orderId:order.id,direction,classification,transactionIdSha256:transactionHash,evidenceSha256:proof,amount:tx.amount,date:tx.date,existingRefundState:order.refund_state??null,apply:false};candidates.push(candidate);byEvidenceKey.set(key,candidate);
 },finish(){for(const candidate of candidates)if(directions.get(JSON.stringify([candidate.transactionIdSha256,candidate.orderId]))?.size===2)candidate.paymentAndRefundBothObserved=true;}};
}
export async function createLedgerReport(configPath,{request=fetch,clock=Date.now}={}){
 const config=await readLedgerReportConfig(configPath);let token;
 try{token=(await privateText(config.credentialFile,4096)).trim();}catch{throw new LedgerReportError('PRIVATE_CREDENTIAL_UNAVAILABLE');}
 let client;try{client=new TelegramClient(token,{environment:config.environment,request});}catch{throw new LedgerReportError('PRIVATE_CREDENTIAL_INVALID');}token=undefined;
 let me;try{me=await client.call('getMe');}catch{throw new LedgerReportError('BOT_PREFLIGHT_FAILED');}
 requireThat(me?.is_bot===true&&me.id===config.expectedBot.id&&typeof me.username==='string'&&me.username.toLowerCase()===config.expectedBot.username.toLowerCase(),'BOT_IDENTITY_MISMATCH');
 const snapshot=await readSnapshot(config.databaseSnapshotFile),analysis=classifier(snapshot.orders,clock());let pages=0,transactions=0,pageSequenceTerminated=false,stopReason='page_bound';
 for(let page=0;page<config.maxPages;page++){
  let result;try{result=await client.call('getStarTransactions',{offset:page*config.pageSize,limit:config.pageSize});}catch{stopReason='provider_unavailable';break;}
  if(!Array.isArray(result?.transactions)||result.transactions.length>config.pageSize){stopReason='invalid_provider_page';break;}
  pages++;transactions+=result.transactions.length;for(const row of result.transactions)analysis.accept(row);
  if(result.transactions.length<config.pageSize){pageSequenceTerminated=true;stopReason='short_page';break;}
 }
 analysis.finish();
 const st=await privateFile(config.databaseSnapshotFile,64*1024*1024),afterHash=await fileHash(config.databaseSnapshotFile);
 requireThat(st.ino===snapshot.identity.ino&&st.dev===snapshot.identity.dev&&afterHash===snapshot.beforeHash,'SNAPSHOT_CHANGED');
 const report={schema:1,mode:'report',environment:config.environment,checkedAtUtc:new Date(clock()).toISOString(),botIdentitySha256:hash(String(me.id)),snapshotSha256:afterHash,snapshotUnchanged:true,pages,transactions,pageSize:config.pageSize,maxPages:config.maxPages,pageSequenceTerminated,stopReason,fullHistoricalCoverageProven:false,classifications:analysis.classifications,candidates:analysis.candidates,appliedPayments:0,appliedRefunds:0,refundRequestsSent:0,applySupported:false,applyBlocker:'Applying requires shared reviewed commerce transitions and consent/grant-time policy; this tool intentionally duplicates no payment logic.',limits:['A missing ledger row never proves a refund failed or authorizes retry.','Optional invoice payload can prevent safe matching of a previously unrecorded charge.','Pages are observations, not a provider snapshot or proof of complete historical coverage.','Outgoing invoice-payment direction distinguishes refunds; amount sign alone is not used.','No grant, consent, provisioning, expiry or existing account is changed.']};
 const output=await open(config.outputFile,'wx',0o600);try{await output.writeFile(JSON.stringify(report,null,2)+'\n');}finally{await output.close();}
 return report;
}
export async function main(args=process.argv.slice(2)){
 requireThat(args.length===2&&args[0]==='--config','USE_PRIVATE_REPORT_CONFIG');
 const report=await createLedgerReport(resolve(args[1]));console.log(JSON.stringify({mode:'report',environment:report.environment,pages:report.pages,transactions:report.transactions,candidates:report.candidates.length,stopReason:report.stopReason,applied:0,refundRequestsSent:0}));
 if(['provider_unavailable','invalid_provider_page','page_bound'].includes(report.stopReason))process.exitCode=2;
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1]))main().catch(()=>{console.error('Stars ledger report stopped. No payment, refund or production fallback was attempted.');process.exitCode=1;});
