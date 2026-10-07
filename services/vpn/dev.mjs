// Isolated synthetic browser QA only. Never deploy or run with production data.
import {createServer,request} from 'node:http';import {readFile,stat} from 'node:fs/promises';import {fileURLToPath} from 'node:url';import {resolve,extname} from 'node:path';
import {readFileSync} from 'node:fs';
import {VpnStore} from './store.mjs';import {createApp} from './server.mjs';
if(process.env.NODE_ENV==='production')throw new Error('Local synthetic QA only');
const port=Number(process.env.VPN_DEV_PORT||8117),apiPort=port+1;
const store=new VpnStore(':memory:');const {server:api,users,cabinet}=createApp({store,origin:'http://localhost:'+port,secure:false});
const a=await users.add({login:'admin-fixture',password:'DevAdminPassword123!',role:'admin'});users.db.prepare('UPDATE identities SET must_change=0 WHERE account_id=?').run(a.accountId);
const u=await users.add({login:'user-fixture',password:'DevUserPassword123!',unlimited:true,allowUnlimited:true,panelLogin:'fictional',profileUrl:'https://example.invalid/synthetic-profile'});users.db.prepare('UPDATE identities SET must_change=0 WHERE account_id=?').run(u.accountId);
const n=await users.add({login:'new-fixture',password:'DevNewPassword123!'});users.db.prepare('UPDATE identities SET must_change=0 WHERE account_id=?').run(n.accountId);
cabinet.setPlans(JSON.parse(readFileSync(new URL('./approved-plans.json',import.meta.url))));
cabinet.savePost({title:'Synthetic news',body:'Isolated QA news',published:true});
api.listen(apiPort,'127.0.0.1');const root=resolve(fileURLToPath(new URL('../../site/',import.meta.url)));
createServer(async(req,res)=>{
 if(req.url.startsWith('/vpn/api/')){const p=request({hostname:'127.0.0.1',port:apiPort,path:req.url,method:req.method,headers:req.headers},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res)});p.on('error',()=>{res.writeHead(502);res.end()});req.pipe(p);return;}
 try{const path=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!path.startsWith(root+'/'))throw 0;let file=path;try{if((await stat(file)).isDirectory())file=resolve(file,'index.html')}catch{file+='.html'};const body=await readFile(file);res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.woff2':'font/woff2','.json':'application/json'})[extname(file)]||'application/octet-stream');res.end(body);}catch{res.writeHead(404);res.end();}
}).listen(port,'127.0.0.1',()=>console.log('Synthetic QA http://127.0.0.1:'+port+'/vpn/cabinet/auth/'));
