import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {smtpTransport,smtpSender,smtpPurchaseSender} from '../email.mjs';
import {VpnStore} from '../store.mjs';
import {createApp} from '../server.mjs';
const config={VPN_SMTP_HOST:'smtp.example.invalid',VPN_SMTP_FROM:'sender@example.invalid',VPN_SMTP_USER:'sender@example.invalid'};
test('SMTP stays unavailable when sender configuration is absent',()=>{
 assert.equal(smtpSender({},()=>assert.fail('No transport without configured sender')),null);
});
test('SMTP loads an exclusive private credential file and requires validated TLS',t=>{
 const dir=mkdtempSync(join(tmpdir(),'smtp-fixture-'));t.after(()=>rmSync(dir,{recursive:true}));const path=join(dir,'password');writeFileSync(path,' FICTIONAL password \n',{mode:0o600});let options;
 smtpTransport({...config,VPN_SMTP_PASSWORD:'wrong-fallback',VPN_SMTP_PASSWORD_FILE:path},o=>{options=o;return {};});
 assert.equal(options.auth.pass,' FICTIONAL password ');assert.equal(options.secure,true);assert.equal(options.port,465);assert.equal(options.tls.rejectUnauthorized,true);assert.equal(options.tls.minVersion,'TLSv1.2');assert.equal(options.disableFileAccess,true);assert.equal(options.disableUrlAccess,true);
 writeFileSync(path,'');assert.throws(()=>smtpTransport({...config,VPN_SMTP_PASSWORD_FILE:path}),/password missing/);
 writeFileSync(path,'FICTIONAL\nsecond-line');assert.throws(()=>smtpTransport({...config,VPN_SMTP_PASSWORD_FILE:path}),/invalid/);
});
test('submission port587 always requires STARTTLS, never plaintext SMTP',()=>{
 for(const port of [587,'587']){let o;smtpTransport({...config,VPN_SMTP_PASSWORD:'FICTIONAL',VPN_SMTP_PORT:port},v=>{o=v;return {};});assert.equal(o.secure,false);assert.equal(o.requireTLS,true);assert.equal(o.port,587);}
 assert.throws(()=>smtpTransport({...config,VPN_SMTP_PORT:25,VPN_SMTP_PASSWORD:'FICTIONAL'}),/requires TLS/);
 assert.throws(()=>smtpTransport(config),/password missing/);
});
test('optional SMTP binding reaches the installed transport without changing TLS, authentication or deadlines',t=>{
 for(const localAddress of ['192.0.2.10','2001:db8::10']){
  for(const port of [465,587]){
   // Construct the actual pinned Nodemailer transport. No verify/send/connect.
   const transport=smtpTransport({...config,VPN_SMTP_PASSWORD:'FICTIONAL',VPN_SMTP_PORT:String(port),VPN_SMTP_LOCAL_ADDRESS:localAddress});
   t.after(()=>transport.close());
   const options=transport.transporter.options;
   assert.equal(options.localAddress,localAddress);assert.equal(options.host,config.VPN_SMTP_HOST);assert.equal(options.port,port);
   assert.equal(options.secure,port===465);assert.equal(options.requireTLS,true);
   assert.deepEqual(options.tls,{minVersion:'TLSv1.2',rejectUnauthorized:true});
   assert.deepEqual(options.auth,{user:config.VPN_SMTP_USER,pass:'FICTIONAL'});
   assert.equal(options.connectionTimeout,8000);assert.equal(options.greetingTimeout,8000);assert.equal(options.socketTimeout,10000);
   assert.equal(options.disableFileAccess,true);assert.equal(options.disableUrlAccess,true);
  }
 }
});
test('unset or empty SMTP binding leaves source selection to the operating system',t=>{
 for(const extra of [{},{VPN_SMTP_LOCAL_ADDRESS:''}]){
  const transport=smtpTransport({...config,VPN_SMTP_PASSWORD:'FICTIONAL',...extra});t.after(()=>transport.close());
  assert.equal(Object.hasOwn(transport.transporter.options,'localAddress'),false);
 }
});
test('invalid SMTP source fails before credentials are read or a transport is created and never reflects the value',()=>{
 for(const localAddress of ['smtp.example.invalid','192.0.2.999','192.0.2.10:465','192.0.2.10/24',' 192.0.2.10','192.0.2.10\n','[2001:db8::10]',42,null]){
  assert.throws(()=>smtpTransport({...config,VPN_SMTP_LOCAL_ADDRESS:localAddress,VPN_SMTP_PASSWORD_FILE:'/synthetic-nonexistent-credential'},()=>assert.fail('Invalid binding created transport')),error=>{
   assert.equal(error.message,'VPN_SMTP_LOCAL_ADDRESS must be an IP address');return true;
  });
 }
});
test('login, recovery and purchase senders share only the per-connection source option',async()=>{
 const options=[],messages=[],env={...config,VPN_SMTP_PASSWORD:'FICTIONAL',VPN_SMTP_LOCAL_ADDRESS:'192.0.2.10'};
 const createTransport=value=>{options.push(value);return {sendMail:async message=>{messages.push(message);return {accepted:[message.to]};}};};
 const send=smtpSender(env,createTransport),purchase=smtpPurchaseSender(env,createTransport);
 await send('owned@example.invalid','12345678');await send('owned@example.invalid','87654321',{purpose:'recovery'});
 await purchase({to:'owned@example.invalid',days:30,expiresAt:1_800_000_000_000,messageId:'<synthetic@example.invalid>'});
 assert.equal(options.length,2);assert.ok(options.every(option=>option.localAddress===env.VPN_SMTP_LOCAL_ADDRESS));
 assert.equal(messages.length,3);assert.doesNotMatch(JSON.stringify(messages),/192\.0\.2\.10|FICTIONAL|smtp\.example\.invalid/);
 assert.equal(messages[0].subject,'Код входа в Family VPN');assert.equal(messages[1].subject,'Восстановление доступа к Family VPN');assert.equal(messages[2].subject,'Family VPN — подписка готова');
});
test('public auth options reveal availability only, never SMTP binding, mailbox or credentials',async t=>{
 const env={...config,VPN_SMTP_PASSWORD:'FICTIONAL',VPN_SMTP_LOCAL_ADDRESS:'192.0.2.10'};
 const sendEmail=smtpSender(env,()=>({sendMail:()=>assert.fail('Auth options sent mail')}));
 const store=new VpnStore(':memory:'),app=createApp({store,sendEmail});
 t.after(async()=>{await new Promise(resolve=>app.server.close(resolve));await app.recovery.shutdown();store.close();});
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const response=await fetch(`http://127.0.0.1:${app.server.address().port}/vpn/api/auth-options`),body=await response.json();
 assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
 assert.deepEqual(body,{google:false,email:true,passkey:true,password:true,registration:true,recoveryEmail:true,recoveryTelegram:false});
 assert.doesNotMatch(JSON.stringify(body),/192\.0\.2\.10|FICTIONAL|sender@|smtp\.example\.invalid|localAddress|VPN_SMTP/);
});
test('configured sender sends only the requested login code to the validated recipient',async()=>{
 let sent;const send=smtpSender({...config,VPN_SMTP_PASSWORD:'FICTIONAL'},()=>({sendMail:async value=>{sent=value;return {accepted:[value.to]};}}));await send('owned@example.invalid','12345678');assert.equal(sent.to,'owned@example.invalid');assert.equal(sent.from,config.VPN_SMTP_FROM);assert.match(sent.text,/12345678/);assert.equal(sent.subject,'Код входа в Family VPN');assert.equal(sent.attachments,undefined);
});
test('recovery mail states reset purpose and ten-minute validity while ordinary sign-in stays five minutes',async()=>{
 const messages=[],send=smtpSender({...config,VPN_SMTP_PASSWORD:'FICTIONAL'},()=>({sendMail:async value=>{messages.push(value);return {accepted:[value.to]};}}));
 await send('owned@example.invalid','12345678',{purpose:'recovery'});await send('owned@example.invalid','87654321');
 assert.equal(messages[0].subject,'Восстановление доступа к Family VPN');assert.match(messages[0].text,/10 минут/);assert.match(messages[0].text,/новый пароль/);assert.match(messages[0].text,/Текущий пароль и подписка не изменены/);assert.doesNotMatch(messages[0].text,/Действует5 минут/);
 assert.equal(messages[1].subject,'Код входа в Family VPN');assert.match(messages[1].text,/Действует5 минут/);
});
