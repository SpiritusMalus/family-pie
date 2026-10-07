import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {smtpTransport,smtpSender} from '../email.mjs';
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
test('configured sender sends only the requested login code to the validated recipient',async()=>{
 let sent;const send=smtpSender({...config,VPN_SMTP_PASSWORD:'FICTIONAL'},()=>({sendMail:async value=>{sent=value;return {accepted:[value.to]};}}));await send('owned@example.invalid','12345678');assert.equal(sent.to,'owned@example.invalid');assert.equal(sent.from,config.VPN_SMTP_FROM);assert.match(sent.text,/12345678/);assert.equal(sent.subject,'Код входа в Family VPN');assert.equal(sent.attachments,undefined);
});
