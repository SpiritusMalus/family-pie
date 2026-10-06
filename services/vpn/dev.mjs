// Isolated synthetic browser QA only. Never deploy or run with production data.
import {createServer,request} from 'node:http';import {readFile,stat} from 'node:fs/promises';import {fileURLToPath} from 'node:url';import {resolve,extname} from 'node:path';
import {VpnStore} from './store.mjs';import {createApp} from './server.mjs';
if(process.env.NODE_ENV==='production')throw new Error('Local synthetic QA only');
const store=new VpnStore(':memory:');const {server:api,users}=createApp({store,origin:'http://127.0.0.1:8117',secure:false});
const a=await users.add({login:'admin-fixture',password:'DevAdminPassword123!',role:'admin'});users.db.prepare('UPDATE identities SET must_change=0 WHERE account_id=?').run(a.accountId);
await users.add({login:'user-fixture',password:'DevUserPassword123!',unlimited:true});
api.listen(8118,'127.0.0.1');const root=resolve(fileURLToPath(new URL('../../site/',import.meta.url)));
createServer(async(req,res)=>{
 if(req.url.startsWith('/vpn/api/')){const p=request({hostname:'127.0.0.1',port:8118,path:req.url,method:req.method,headers:req.headers},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res)});p.on('error',()=>{res.writeHead(502);res.end()});req.pipe(p);return;}
 try{const path=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!path.startsWith(root+'/'))throw 0;let file=path;try{if((await stat(file)).isDirectory())file=resolve(file,'index.html')}catch{file+='.html'};const body=await readFile(file);res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.woff2':'font/woff2','.json':'application/json'})[extname(file)]||'application/octet-stream');res.end(body);}catch{res.writeHead(404);res.end();}
}).listen(8117,'127.0.0.1',()=>console.log('Synthetic QA http://127.0.0.1:8117/vpn/cabinet/auth/'));
