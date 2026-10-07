import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {googleReturnPath,googleConfig} from '../google.mjs';
import {VpnStore} from '../store.mjs';
import {createApp} from '../server.mjs';

test('Google return destination preserves checkout selection and rejects external or different screens',()=>{
 const path='/vpn/cabinet/?period=90#plans';
 assert.equal(googleReturnPath(path),path);
 for(const bad of ['https://evil.invalid/vpn/cabinet/','//evil.invalid/vpn/cabinet/','/vpn/cabinet/../admin/','/vpn/cabinet/\\evil','/vpn/admin/','/vpn/cabinet/\n','/vpn/cabinet/'+ 'x'.repeat(1024)])assert.equal(googleReturnPath(bad),'/vpn/cabinet/');
});

test('downloaded Web OAuth config requires our callback and does not expose secrets in errors',t=>{
 const dir=mkdtempSync(join(tmpdir(),'vpn-google-')),path=join(dir,'client.json');t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const web={client_id:'fixture.apps.googleusercontent.com',client_secret:'FICTIONAL_PRIVATE_VALUE',redirect_uris:['https://family-pie.ru/vpn/api/google/callback']};
 writeFileSync(path,JSON.stringify({web}),{mode:0o600});assert.deepEqual(googleConfig({VPN_GOOGLE_CONFIG_FILE:path}),{clientId:web.client_id,secret:web.client_secret});
 writeFileSync(path,JSON.stringify({web:{...web,redirect_uris:['https://evil.invalid/callback']}}));assert.throws(()=>googleConfig({VPN_GOOGLE_CONFIG_FILE:path}),/^Error: Invalid protected Google OAuth configuration$/);
});

test('Google cancellation returns to login with its cookie-bound selected destination',async t=>{
 const store=new VpnStore(':memory:'),origin='http://localhost',app=createApp({store,origin,secure:false,googleConfig:{clientId:'fixture',secret:'FICTIONAL'}});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>app.server.close(r));store.close();});
 const base='http://127.0.0.1:'+app.server.address().port,next='/vpn/cabinet/?period=180#plans';
 const start=await fetch(base+'/vpn/api/google/start?next='+encodeURIComponent(next),{redirect:'manual'});assert.equal(start.status,302);
 const state=new URL(start.headers.get('location')).searchParams.get('state'),cookie=start.headers.get('set-cookie').split(';')[0];
 const cancel=await fetch(base+'/vpn/api/google/callback?error=access_denied&state='+state,{headers:{Cookie:cookie},redirect:'manual'});
 const target=new URL(cancel.headers.get('location'),origin);assert.equal(target.pathname,'/vpn/cabinet/auth/');assert.equal(target.searchParams.get('google_error'),'1');assert.equal(target.searchParams.get('next'),next);
 const spoof=await fetch(base+'/vpn/api/google/callback?error=access_denied&state='+state,{redirect:'manual'});assert.equal(new URL(spoof.headers.get('location'),origin).searchParams.get('next'),'/vpn/cabinet/');
});

test('unconfigured Google endpoint returns a usable login screen instead of a dead end',async t=>{
 const store=new VpnStore(':memory:'),app=createApp({store,origin:'http://localhost',secure:false});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>app.server.close(r));store.close();});
 const r=await fetch('http://127.0.0.1:'+app.server.address().port+'/vpn/api/google/start?next='+encodeURIComponent('/vpn/cabinet/?period=365#plans'),{redirect:'manual'});assert.equal(r.status,302);assert.match(r.headers.get('location'),/^\/vpn\/cabinet\/auth\/\?google_error=1&next=/);
});
