import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,existsSync,statSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {VpnStore} from '../store.mjs';
import {Accounts} from '../auth.mjs';
const importer=new URL('../import-accounts.mjs',import.meta.url);
test('import preflight refuses alias collisions before creating database or passwords',t=>{
 const dir=mkdtempSync(join(tmpdir(),'vpn-import-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const input=join(dir,'input.json'),db=join(dir,'db.sqlite'),output=join(dir,'passwords.jsonl');
 writeFileSync(input,JSON.stringify([{login:'vpn-admin'}]));
 const r=spawnSync(process.execPath,[importer.pathname,db,input,output],{encoding:'utf8'});
 assert.notEqual(r.status,0);assert.equal(existsSync(db),false);assert.equal(existsSync(output),false);
});
test('private import preserves original profile and rerun never resets credentials',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'vpn-import-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const input=join(dir,'input.json'),db=join(dir,'db.sqlite'),output=join(dir,'passwords.jsonl');
 const profile='https://sub.family-pie.ru/sub/fictional_fixture';
 writeFileSync(input,JSON.stringify([{login:'Existing-fixture',panelLogin:'Existing-fixture',profileUrl:profile,expiresAt:0,unlimited:true,enabled:true,devices:0}]));
 const run=path=>spawnSync(process.execPath,[importer.pathname,db,input,path],{encoding:'utf8'});
 assert.equal(run(output).status,0);assert.equal(statSync(output).mode&0o777,0o600);
 const credentials=readFileSync(output,'utf8').trim().split('\n').map(JSON.parse);
 assert.equal(credentials.length,2);assert.ok(credentials.every(x=>x.temporaryPassword.length===24));
 assert.equal(run(output).status,1); // Never overwrite the original recovery file.
 const second=join(dir,'second.jsonl');assert.equal(run(second).status,0);assert.equal(readFileSync(second,'utf8'),'');
 const store=new VpnStore(db);t.after(()=>store.close());const users=new Accounts(store);
 const password=credentials.find(x=>x.role==='user').temporaryPassword;
 const session=await users.login('existing-fixture',password);
 assert.equal(session.identity.must_change,1);assert.equal(users.subscription(session.identity.account_id).profile_url,profile);
});
