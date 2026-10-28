import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TelegramClient,TelegramApiError} from '../telegram.mjs';
const token='123456:FICTIONAL_TOKEN_FOR_SYNTHETIC_TESTS_ONLY';
const ok=()=>({ok:true,json:async()=>({ok:true,result:true})});
test('production remains the default and test is a fixed immutable endpoint for all payment methods',async()=>{
 for(const [environment,prefix] of [[undefined,''],['production',''],['test','test/']]){
  const calls=[],client=new TelegramClient(token,{...(environment===undefined?{}:{environment}),request:async(url,options)=>{calls.push({url,options});return ok();}});
  for(const method of ['getMe','getWebhookInfo','getUpdates','sendInvoice','answerPreCheckoutQuery','refundStarPayment','getStarTransactions','getMyStarBalance'])await client.call(method,{});
  for(const {url,options} of calls){assert.match(url,new RegExp('^https://api\\.telegram\\.org/bot'+token+'/'+prefix));assert.equal(options.redirect,'error');}
  assert.throws(()=>{client.environment=environment==='test'?'production':'test';},TypeError);
 }
});
test('unknown API environments fail before any network and a rejected test token never falls back to production',async()=>{
 for(const environment of ['TEST','live','https://elsewhere.invalid',null,true])assert.throws(()=>new TelegramClient(token,{environment}),/API environment/);
 const calls=[],client=new TelegramClient(token,{environment:'test',request:async url=>{calls.push(url);return {ok:false,status:401,json:async()=>({ok:false,error_code:401})};}});
 await assert.rejects(()=>client.call('getMe'),error=>error instanceof TelegramApiError&&error.code===401);
 assert.deepEqual(calls,['https://api.telegram.org/bot'+token+'/test/getMe']);
 await assert.rejects(()=>client.call('../getMe'),/Unsupported/);assert.equal(calls.length,1);
});
test('test transport retains multipart image support without putting credentials in error messages',async()=>{
 let options;const client=new TelegramClient(token,{environment:'test',request:async(_url,input)=>{options=input;return ok();}});
 await client.call('sendPhoto',{chat_id:1,photo:new Uint8Array([1,2,3])});assert.ok(options.body instanceof FormData);assert.equal(options.body.get('photo').type,'image/png');
 const failing=new TelegramClient(token,{environment:'test',request:async()=>{throw new Error('Untrusted detail '+token);}});
 await assert.rejects(()=>failing.call('getMe'),error=>error.message==='Telegram delivery outcome unknown'&&!error.message.includes(token));
});
