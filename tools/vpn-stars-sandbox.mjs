// Manual Telegram TEST-server harness. No production environment or panel worker.
import {constants} from 'node:fs';
import {open,lstat,realpath,mkdir,readFile,writeFile,appendFile,unlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,basename,join,resolve,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomBytes} from 'node:crypto';
import {VpnStore} from '../services/vpn/store.mjs';
import {Accounts} from '../services/vpn/auth.mjs';
import {TelegramStore,TelegramClient,deliverOne} from '../services/vpn/telegram.mjs';
import {TelegramCommerce} from '../services/vpn/telegram-commerce.mjs';
import {validateStarsPlans} from '../services/vpn/telegram-pricing.mjs';
import {TelegramUI,processTelegramUpdates,deliverUiOne} from '../services/vpn/telegram-ui.mjs';

export class SandboxError extends Error {constructor(code){super('Stars sandbox: '+code);this.code=code;}}
const requireThat=(ok,code)=>{if(!ok)throw new SandboxError(code);};
const digest=value=>createHash('sha256').update(value).digest('hex');
const positive=value=>Number.isSafeInteger(value)&&value>0;
const uid=()=>process.getuid?.();
const blockedRoots=['/etc/family-vpn','/private/etc/family-vpn','/var/lib/family-vpn','/private/var/lib/family-vpn','/opt/family-vpn','/run/credentials','/private/var/run/credentials'];
const inside=(path,base)=>path===base||path.startsWith(base+'/');
async function safePath(path){
 requireThat(typeof path==='string'&&isAbsolute(path),'ABSOLUTE_PRIVATE_PATH_REQUIRED');
 const canonical=join(await realpath(dirname(path)),basename(path));
 requireThat(!blockedRoots.some(base=>inside(canonical,base)),'PRODUCTION_PATH_REJECTED');
 return canonical;
}
async function privateText(path,maxBytes=16384){
 path=await safePath(path);const before=await lstat(path);
 requireThat(before.isFile()&&!before.isSymbolicLink()&&before.nlink===1&&before.size<=maxBytes&&(before.mode&0o077)===0&&(uid()===undefined||before.uid===uid()),'PRIVATE_OWNED_FILE_REQUIRED');
 const file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
 try {const st=await file.stat();requireThat(st.ino===before.ino&&st.dev===before.dev&&(st.mode&0o077)===0,'PRIVATE_FILE_CHANGED');return await file.readFile('utf8');}
 finally{await file.close();}
}
export async function readSandboxConfig(path,{environment=process.env}={}){
 requireThat(!Object.keys(environment).some(key=>key.startsWith('VPN_')||key==='CREDENTIALS_DIRECTORY'),'PRODUCTION_ENVIRONMENT_REJECTED');
 let config;try{config=JSON.parse(await privateText(path));}catch(error){if(error instanceof SandboxError)throw error;throw new SandboxError('PRIVATE_CONFIG_INVALID');}
 const keys=new Set(['environment','credentialFile','expectedBot','allowedUserIds','stateDir','plans','maxRunSeconds']);
 requireThat(config&&typeof config==='object'&&!Array.isArray(config)&&Object.keys(config).every(key=>keys.has(key))&&config.environment==='test','TEST_CONFIG_REQUIRED');
 requireThat(positive(config.expectedBot?.id)&&typeof config.expectedBot.username==='string'&&/^[A-Za-z0-9_]{5,32}$/.test(config.expectedBot.username)&&/bot$/i.test(config.expectedBot.username),'EXPECTED_TEST_BOT_REQUIRED');
 requireThat(Array.isArray(config.allowedUserIds)&&config.allowedUserIds.length>0&&config.allowedUserIds.length<=16&&config.allowedUserIds.every(positive)&&new Set(config.allowedUserIds).size===config.allowedUserIds.length,'EXPLICIT_TEST_USER_ALLOWLIST_REQUIRED');
 requireThat(Array.isArray(config.plans)&&config.plans.length>0&&config.plans.length<=4&&config.plans.every(plan=>[30,90,180,365].includes(plan.days)&&Number.isSafeInteger(plan.stars)&&plan.stars>=1&&plan.stars<=1_000_000)&&new Set(config.plans.map(plan=>plan.days)).size===config.plans.length,'EXPLICIT_TEST_PLANS_REQUIRED');
 const maxRunSeconds=config.maxRunSeconds??900;requireThat(Number.isSafeInteger(maxRunSeconds)&&maxRunSeconds>=1&&maxRunSeconds<=3600,'BOUNDED_RUN_REQUIRED');
 const stateDir=await safePath(config.stateDir);
 const parent=await lstat(dirname(stateDir));requireThat(parent.isDirectory()&&((parent.uid===uid()&&(parent.mode&0o022)===0)||(parent.uid===0&&Boolean(parent.mode&0o1000))),'SAFE_STATE_PARENT_REQUIRED');
 try{await lstat(stateDir);throw new SandboxError('NEW_STATE_DIRECTORY_REQUIRED');}catch(error){if(error.code!=='ENOENT')throw error;}
 const credentialFile=await safePath(config.credentialFile);
 requireThat(!inside(credentialFile,stateDir),'SEPARATE_PRIVATE_TEST_CREDENTIAL_REQUIRED');
 let plans;try{plans=validateStarsPlans(config.plans);}catch{throw new SandboxError('EXPLICIT_TEST_PLANS_REQUIRED');}
 return {...config,plans,stateDir,credentialFile,maxRunSeconds};
}
async function acquireLock(root,botId){
 try{await mkdir(root,{mode:0o700});}catch(error){if(error.code!=='EEXIST')throw error;}
 const st=await lstat(root);requireThat(st.isDirectory()&&!st.isSymbolicLink()&&(st.mode&0o077)===0&&(uid()===undefined||st.uid===uid()),'PRIVATE_LOCK_DIRECTORY_REQUIRED');
 const file=join(root,'test-bot-'+digest(String(botId))+'.lock'),nonce=randomBytes(24).toString('hex');let handle;
 try{handle=await open(file,'wx',0o600);}catch{throw new SandboxError('TEST_BOT_ALREADY_LOCKED');}
 await handle.writeFile(JSON.stringify({pid:process.pid,nonce})+'\n');
 return async()=>{try{const current=JSON.parse(await readFile(file,'utf8'));if(current.nonce===nonce)await unlink(file);}finally{await handle.close();}};
}
const allowedUpdate=(update,ids)=>{
 const message=update.message;if(message)return message.chat?.type==='private'&&message.from?.is_bot!==true&&message.chat.id===message.from?.id&&ids.has(message.chat.id);
 const callback=update.callback_query;if(callback)return callback.message?.chat?.type==='private'&&callback.from?.is_bot!==true&&callback.message.chat.id===callback.from?.id&&ids.has(callback.from.id);
 if(update.pre_checkout_query)return update.pre_checkout_query.from?.is_bot!==true&&ids.has(update.pre_checkout_query.from?.id);
 if(update.my_chat_member)return update.my_chat_member.chat?.type==='private'&&ids.has(update.my_chat_member.chat.id);
 return false;
};

export async function openSandbox(configPath,{request=fetch,environment=process.env,lockRoot=join(tmpdir(),'family-vpn-stars-sandbox-'+String(uid()??'owner'))}={}){
 const config=await readSandboxConfig(configPath,{environment});let token;
 try{token=(await privateText(config.credentialFile,4096)).trim();}catch{throw new SandboxError('PRIVATE_TEST_CREDENTIAL_UNAVAILABLE');}
 const client=new TelegramClient(token,{environment:'test',request});token=undefined;
 // Only read-only identity calls may happen before the private lock/state exists.
 let me,webhook;try{me=await client.call('getMe');webhook=await client.call('getWebhookInfo');}catch{throw new SandboxError('TEST_IDENTITY_PREFLIGHT_FAILED');}
 requireThat(me?.is_bot===true&&me.id===config.expectedBot.id&&typeof me.username==='string'&&me.username.toLowerCase()===config.expectedBot.username.toLowerCase(),'TEST_BOT_IDENTITY_MISMATCH');
 requireThat(typeof webhook?.url==='string'&&!webhook.url,'TEST_WEBHOOK_CONFLICT');
 const releaseLock=await acquireLock(lockRoot,me.id);let store;
 try{
  await mkdir(config.stateDir,{mode:0o700});const st=await lstat(config.stateDir);requireThat(st.isDirectory()&&(st.mode&0o077)===0,'PRIVATE_STATE_DIRECTORY_REQUIRED');
  const database=join(config.stateDir,'sandbox.sqlite');const empty=await open(database,'wx',0o600);await empty.close();
  store=new VpnStore(database,{plans:[]});const users=new Accounts(store),telegram=new TelegramStore(store),commerce=new TelegramCommerce(store,{users,origin:'https://sandbox.invalid',stars:{enabled:true,approved:true,plans:config.plans}});
  const ui=new TelegramUI(telegram,{commerce,enabled:true,origin:'https://sandbox.invalid'});telegram.ui=ui;
  const ids=new Set(config.allowedUserIds);
  const transport={call(method,data={}){
   if(['sendMessage','sendPhoto','sendInvoice','copyMessage'].includes(method))requireThat(ids.has(Number(data.chat_id)),'OUTBOUND_TEST_USER_NOT_ALLOWED');
   if(method==='refundStarPayment')requireThat(ids.has(Number(data.user_id)),'REFUND_TEST_USER_NOT_ALLOWED');
   return client.call(method,data);
  }};
  const event=async(name,count=0)=>{await appendFile(join(config.stateDir,'events.jsonl'),JSON.stringify({at:new Date().toISOString(),event:name,count})+'\n',{mode:0o600});};
  await writeFile(join(config.stateDir,'sandbox.json'),JSON.stringify({schema:1,environment:'test',botIdentitySha256:digest(String(me.id)),allowlistSha256:digest([...ids].sort().join(',')),provisioner:'none',createdAt:new Date().toISOString()})+'\n',{flag:'wx',mode:0o600});
  let closed=false,deliveryIndex=0;
  const session={config,store,users,telegram,commerce,ui,
   async acceptUpdates(updates){requireThat(Array.isArray(updates),'INVALID_TEST_UPDATES');const filtered=updates.map(update=>allowedUpdate(update,ids)?update:{update_id:update?.update_id});await processTelegramUpdates(telegram,ui,transport,filtered);await event('updates_processed',updates.length);},
   async deliver(){const jobs=[()=>deliverOne(telegram,transport),()=>deliverUiOne(ui,transport),()=>commerce.deliverRefundOne(transport)];for(let n=0;n<jobs.length;n++){const index=(deliveryIndex+n)%jobs.length;if(await jobs[index]()){deliveryIndex=(index+1)%jobs.length;await event('delivery_attempt');return true;}}return false;},
   async poll(){const updates=await client.call('getUpdates',{offset:telegram.offset(),timeout:5,limit:50,allowed_updates:['message','callback_query','pre_checkout_query','my_chat_member']});await session.acceptUpdates(updates);return updates.length;},
   async queueRefund(orderId){requireThat(typeof orderId==='string'&&/^[a-f0-9-]{36}$/.test(orderId),'PRIVATE_TEST_ORDER_REQUIRED');const order=store.db.prepare('SELECT * FROM orders WHERE id=?').get(orderId);requireThat(order?.provider==='telegram-stars'&&order.currency==='XTR'&&ids.has(Number(order.payment_actor)),'OWNED_TEST_ORDER_REQUIRED');commerce.queueRefund(order.account_id,order.id);await event('refund_queued');},
   async recordControlFailure(){await event('control_rejected');},
   async close(){if(closed)return;closed=true;try{await commerce.recovery.shutdown();await event('stopped');}finally{store.close();await releaseLock();}}
  };
  await event('ready');return session;
 }catch{store?.close();await releaseLock();throw new SandboxError('PRIVATE_SANDBOX_INITIALIZATION_FAILED');}
}

export async function main(args=process.argv.slice(2)){
 requireThat(args.length===2&&args[0]==='--config','USE_PRIVATE_CONFIG_FILE');
 const session=await openSandbox(resolve(args[1]));let stopping=false;const stop=()=>{stopping=true;};process.on('SIGINT',stop);process.on('SIGTERM',stop);
 const {createInterface}=await import('node:readline');const input=createInterface({input:process.stdin,terminal:false});
 input.on('line',line=>{try{const value=JSON.parse(line);if(value.action==='refund'&&Object.keys(value).every(key=>['action','orderId'].includes(key)))session.queueRefund(value.orderId).catch(()=>session.recordControlFailure());else session.recordControlFailure();}catch{session.recordControlFailure();}});
 console.log('Telegram TEST sandbox ready. Production state and provisioning are unavailable.');
 const until=Date.now()+session.config.maxRunSeconds*1000;
 try{while(!stopping&&Date.now()<until){await session.poll();if(await session.deliver())await new Promise(resolve=>setTimeout(resolve,1100));}}
 finally{input.close();process.off('SIGINT',stop);process.off('SIGTERM',stop);await session.close();}
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1]))main().catch(()=>{console.error('Telegram TEST sandbox stopped. Inspect the private state; no production fallback was attempted.');process.exitCode=1;});
