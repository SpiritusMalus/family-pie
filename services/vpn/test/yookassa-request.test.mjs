import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Writable,Readable} from 'node:stream';
import {createYooKassaRequest,yookassaLocalAddress,ProviderUnavailableError} from '../yookassa-request.mjs';
import {YooKassaReader} from '../yookassa.mjs';
import {Billing,billingConfig} from '../billing.mjs';
import {VpnStore} from '../store.mjs';
import {createApp} from '../server.mjs';
import {randomUUID} from 'node:crypto';

const SOURCE='198.51.100.23',SECRET='FICTIONAL_YOO_BINDING_SECRET',ORIGIN='https://api.yookassa.ru';
function transport(handler=()=>({body:{id:'fixture'}})){
 const calls=[];
 const httpsRequest=(url,options,callback)=>{
  const chunks=[],req=new Writable({autoDestroy:false,write(chunk,encoding,done){chunks.push(Buffer.from(chunk));done();}});
  const abort=()=>req.destroy(new Error('Private upstream detail '+SECRET));options.signal.addEventListener('abort',abort,{once:true});req.on('close',()=>options.signal.removeEventListener('abort',abort));
  req.on('finish',()=>queueMicrotask(()=>{
   if(req.destroyed)return;const call={url:url.href,options,body:Buffer.concat(chunks).toString()};calls.push(call);
   const result=handler(call);if(result.hang)return;if(result.error){req.destroy(new Error(result.error));return;}
   const data=result.raw??Buffer.from(JSON.stringify(result.body??{})),response=Readable.from(Array.isArray(data)?data:[data]);response.statusCode=result.status??200;response.headers=result.headers??{'content-type':'application/json'};response.complete=result.complete??true;response.once('end',()=>req.destroy());callback(response);
  }));return req;
 };
 return {calls,httpsRequest,request:createYooKassaRequest({localAddress:SOURCE,httpsRequest})};
}

test('optional source validates literal IP only; unset and explicit request injection preserve prior transport',async()=>{
 assert.equal(yookassaLocalAddress(undefined),undefined);assert.equal(yookassaLocalAddress(''),undefined);assert.equal(yookassaLocalAddress(SOURCE),SOURCE);assert.equal(yookassaLocalAddress('2001:db8::1'),'2001:db8::1');
 for(const value of [null,1,{},'localhost','198.51.100.23/24',' 198.51.100.23','198.51.100.23 ','fe80::1%lo0','https://198.51.100.23'])assert.throws(()=>yookassaLocalAddress(value),/Invalid YooKassa local address/);
 assert.equal(createYooKassaRequest(),fetch);const injected=async()=>({ok:true});assert.equal(createYooKassaRequest({request:injected}),injected);assert.equal(createYooKassaRequest({localAddress:SOURCE,request:injected}),injected);
 assert.equal(billingConfig({}).localAddress,undefined);assert.equal(billingConfig({VPN_YOOKASSA_LOCAL_ADDRESS:SOURCE}).localAddress,SOURCE);assert.throws(()=>billingConfig({VPN_YOOKASSA_LOCAL_ADDRESS:'not-an-ip'}),/Invalid YooKassa local address/);
 assert.throws(()=>new Billing({db:{exec(){throw Error('Must validate before DB mutation');}}},{localAddress:'not-an-ip'}),/Invalid YooKassa local address/);
 const reader=new YooKassaReader({shopId:'fixture',secret:SECRET,localAddress:SOURCE});assert.notEqual(reader.request,fetch);
});

test('bound HTTPS options preserve fixed origin, TLS verification, request body and strict response semantics',async()=>{
 const f=transport(()=>({body:{id:'fixture-result'}})),response=await f.request(ORIGIN+'/v3/payments',{method:'POST',headers:{Authorization:'Basic FICTIONAL','Content-Type':'application/json'},body:'{"fixture":true}',redirect:'error',signal:AbortSignal.timeout(12000)});
 assert.equal(response.ok,true);assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'application/json');assert.deepEqual(await response.json(),{id:'fixture-result'});
 const call=f.calls[0];assert.equal(call.url,ORIGIN+'/v3/payments');assert.equal(call.options.localAddress,SOURCE);assert.equal(call.options.family,4);assert.equal(call.options.agent,false);assert.equal(call.options.rejectUnauthorized,true);assert.equal(call.options.servername,'api.yookassa.ru');assert.equal(call.options.maxHeaderSize,16384);assert.equal(call.options.headers.host,'api.yookassa.ru');assert.equal(call.options.headers['accept-encoding'],'identity');assert.equal(call.options.headers.authorization,'Basic FICTIONAL');assert.equal(call.options.headers['content-length'],String(Buffer.byteLength(call.body)));assert.equal(call.body,'{"fixture":true}');assert.ok(call.options.signal instanceof AbortSignal);
 const ipv6=createYooKassaRequest({localAddress:'2001:db8::1',httpsRequest:(url,options,cb)=>{assert.equal(options.family,6);return f.httpsRequest(url,options,cb);}});await ipv6(ORIGIN+'/v3/payments/fixture');
});

test('bound transport refuses alternate targets, redirects and unsupported overrides without fallback',async()=>{
 const f=transport();for(const url of ['http://api.yookassa.ru/v3/payments','https://api.yookassa.ru.evil.invalid/v3/payments','https://user:pass@api.yookassa.ru/v3/payments','https://api.yookassa.ru:8443/v3/payments',ORIGIN+'/v3/payments#secret',ORIGIN+'/other'])await assert.rejects(()=>f.request(url),ProviderUnavailableError);
 await assert.rejects(()=>f.request(ORIGIN+'/v3/payments',{redirect:'follow'}),ProviderUnavailableError);await assert.rejects(()=>f.request(ORIGIN+'/v3/payments',{method:'DELETE'}),ProviderUnavailableError);assert.equal(f.calls.length,0);
 const redirect=transport(()=>({status:302,headers:{location:'https://elsewhere.invalid/'+SECRET}}));await assert.rejects(()=>redirect.request(ORIGIN+'/v3/payments'),error=>error instanceof ProviderUnavailableError&&!error.message.includes(SECRET));assert.equal(redirect.calls.length,1);
});

test('bind/TLS/abort/oversize/invalid JSON failures are bounded and hide upstream details',async()=>{
 for(const result of [{error:'EADDRNOTAVAIL '+SECRET},{error:'CERT_INVALID '+SECRET},{headers:{'content-length':String(1024*1024+1)}},{raw:Buffer.alloc(1024*1024+1)},{complete:false}]){
  const f=transport(()=>result);await assert.rejects(()=>f.request(ORIGIN+'/v3/payments'),error=>error instanceof ProviderUnavailableError&&!error.message.includes(SECRET));assert.equal(f.calls.length,1);
 }
 const bad=transport(()=>({raw:Buffer.from(SECRET)})),response=await bad.request(ORIGIN+'/v3/payments');await assert.rejects(()=>response.json(),error=>error instanceof ProviderUnavailableError&&!error.message.includes(SECRET));
 const f=transport(()=>({hang:true})),controller=new AbortController(),pending=f.request(ORIGIN+'/v3/payments',{signal:controller.signal});setTimeout(()=>controller.abort(),5);await assert.rejects(()=>pending,ProviderUnavailableError);assert.equal(f.calls.length,1);
 const aborted=new AbortController();aborted.abort();const before=f.calls.length;await assert.rejects(()=>f.request(ORIGIN+'/v3/payments',{signal:aborted.signal}),ProviderUnavailableError);assert.equal(f.calls.length,before);
 const rejection=transport(()=>({status:403,body:{description:SECRET}}));assert.equal((await rejection.request(ORIGIN+'/v3/payments')).ok,false);
});

test('Billing creation, payment poller and full refund verification all use the same bound adapter',async t=>{
 const store=new VpnStore(':memory:',{plans:[{days:30,priceMinor:30000,devices:0}]}),account=store.createAccount('fixture@example.invalid');t.after(()=>store.close());let payment,refund;
 const f=transport(call=>{
  const path=new URL(call.url).pathname;
  if(call.options.method==='POST'&&path==='/v3/payments'){const body=JSON.parse(call.body);payment={id:'fixture-payment',recipient:{account_id:'fixture-shop'},test:true,status:'pending',paid:false,metadata:body.metadata,amount:body.amount,confirmation:{confirmation_url:'https://yoomoney.ru/checkout/fixture'}};assert.ok(call.options.headers['idempotence-key']);return {body:payment};}
  if(path==='/v3/payments/fixture-payment')return {body:payment};
  if(call.options.method==='POST'&&path==='/v3/refunds'){const body=JSON.parse(call.body);refund={id:'fixture-refund',status:'succeeded',payment_id:payment.id,amount:body.amount};assert.ok(call.options.headers['idempotence-key']);return {body:refund};}
  if(path==='/v3/refunds/fixture-refund')return {body:refund};throw Error('Unexpected synthetic endpoint');
 });
 const billing=new Billing(store,{shopId:'fixture-shop',secret:SECRET,testMode:true,localAddress:SOURCE,request:f.request});assert.equal(billing.request,billing.reader.request);
 const created=await billing.checkout(account.id,30,'fixture-bound-create','fixture@example.invalid');assert.equal(f.calls.length,1);assert.equal(store.subscription(account.id).active,false);payment.status='succeeded';payment.paid=true;
 await billing.reconcile();assert.equal(store.subscription(account.id).active,true);assert.equal(store.db.prepare('SELECT count(*) n FROM grants').get().n,1);await billing.refund(account.id,created.orderId,randomUUID());assert.equal(store.subscription(account.id).active,false);assert.equal(store.order(account.id,created.orderId).state,'refunded');
 assert.ok(f.calls.every(c=>c.options.localAddress===SOURCE&&c.options.rejectUnauthorized===true&&c.options.headers.authorization.startsWith('Basic ')));assert.deepEqual(f.calls.map(c=>c.options.method),['POST','GET','POST','GET','GET']);
});

test('Reader retains ProviderUnavailableError and public health/auth/plans never expose source or secret',async t=>{
 const failed=transport(()=>({error:SECRET})),reader=new YooKassaReader({shopId:'fixture',secret:SECRET,request:failed.request});await assert.rejects(()=>reader.object('payments','fixture-id'),error=>error instanceof ProviderUnavailableError&&!error.message.includes(SECRET));
 const store=new VpnStore(':memory:'),app=createApp({store,paymentConfig:{shopId:'fixture',secret:SECRET,localAddress:SOURCE,request:async()=>{throw Error('No provider call expected');}}});await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));t.after(async()=>{await new Promise(resolve=>app.server.close(resolve));store.close();});
 for(const path of ['health','auth-options','plans']){const res=await fetch('http://127.0.0.1:'+app.server.address().port+'/vpn/api/'+path),text=await res.text();assert.equal(res.status,200);assert.ok(!text.includes(SOURCE));assert.ok(!text.includes(SECRET));assert.ok(!text.includes('localAddress'));}
});
