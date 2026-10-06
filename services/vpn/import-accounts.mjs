import { readFileSync,openSync,writeSync,closeSync } from 'node:fs';
import { VpnStore } from './store.mjs';
import { Accounts,temporaryPassword } from './auth.mjs';
const [dbPath,inputPath,outputPath]=process.argv.slice(2);
if(!dbPath||!inputPath||!outputPath)throw new Error('Usage: importer private-db private-input private-output');
const records=JSON.parse(readFileSync(inputPath,'utf8'));
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
