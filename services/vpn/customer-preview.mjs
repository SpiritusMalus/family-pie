// Local synthetic preview. Never uses the production database or a payment provider.
import {readFileSync} from 'node:fs';
import {VpnStore} from './store.mjs';
import {createApp} from './server.mjs';
if(process.env.NODE_ENV==='production')throw Error('Local preview only');
const port=Number(process.env.CUSTOMER_PREVIEW_PORT||8135);
const store=new VpnStore(':memory:');
const {server,users,cabinet}=createApp({store,origin:'http://localhost:'+port,secure:false});
for(const [login,role] of [['user-fixture','user'],['admin-fixture','admin']]){
 const account=await users.add({login,password:'PreviewPassword123!',role});
 store.db.prepare('UPDATE identities SET must_change=0 WHERE account_id=?').run(account.accountId);
}
cabinet.setPlans(JSON.parse(readFileSync(new URL('./approved-plans.json',import.meta.url))));
server.listen(port+1,'127.0.0.1',()=>console.log('Isolated customer preview API on '+(port+1)));
