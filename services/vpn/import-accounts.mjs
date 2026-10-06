import { readFileSync,openSync,writeSync,closeSync } from 'node:fs';
import { VpnStore } from './store.mjs';
import { Accounts,temporaryPassword } from './auth.mjs';
const [dbPath,inputPath,outputPath]=process.argv.slice(2);
if(!dbPath||!inputPath||!outputPath)throw new Error('Usage: importer private-db private-input private-output');
const records=JSON.parse(readFileSync(inputPath,'utf8'));
// Validate the entire import before touching the database or recovery output.
if(!Array.isArray(records))throw new Error('Import must be an array');
const seen=new Set(['vpn-admin']);
for(const x of records){
 if(!x||typeof x.login!=='string'||!x.login.trim()||x.login.length>80)throw new Error('Invalid import login');
 const login=x.login.trim().toLowerCase();
 if(seen.has(login))throw new Error('Duplicate or reserved import login');seen.add(login);
 if(x.role&&x.role!=='user')throw new Error('Imported clients cannot be administrators');
 if(typeof x.panelLogin!=='string'||!x.panelLogin||x.panelLogin.startsWith('root-lab-'))throw new Error('Invalid panel identity');
 if(typeof x.profileUrl!=='string'||!/^https:\/\/sub\.family-pie\.ru\/sub\/[A-Za-z0-9_-]+$/.test(x.profileUrl))throw new Error('Invalid private profile');
 if(!Number.isSafeInteger(x.expiresAt)||x.expiresAt<0||typeof x.unlimited!=='boolean'||typeof x.enabled!=='boolean'||!Number.isInteger(x.devices)||x.devices<0||x.devices>1000)throw new Error('Invalid imported limits');
 if(x.enabled&&!x.unlimited&&!x.expiresAt)throw new Error('Imported expiry required');
}
const fd=openSync(outputPath,'wx',0o600),store=new VpnStore(dbPath),users=new Accounts(store);
let created=0;
try{
 for(const x of [...records,{login:'vpn-admin',role:'admin'}]){
  if(users.db.prepare('SELECT 1 FROM identities WHERE login=?').get(users.normalize(x.login)))continue;
  const password=temporaryPassword();
  // Store recovery before creating the account; never log credentials.
  writeSync(fd,JSON.stringify({login:x.login,temporaryPassword:password,role:x.role||'user'})+'\n');
  await users.add({...x,password});created++;
 }
 console.log(JSON.stringify({created,existing:users.list().length-created}));
}finally{closeSync(fd);store.close();}
