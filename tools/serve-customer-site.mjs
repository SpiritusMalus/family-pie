import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {buildCustomerSite,canonicalCustomerFlow,publicPlans} from './build-customer-site.mjs';
const {output:root}=await buildCustomerSite();
const port=Number(process.argv[2]||8133);
const vpnQa=process.env.CUSTOMER_VPN_QA_API;
if(vpnQa&&!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(vpnQa))throw Error('Only a local synthetic API is allowed');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2','.xml':'application/xml','.txt':'text/plain'};
async function file(path) {try{return (await stat(path)).isFile()?path:null;}catch{return null;}}
const server=createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://localhost');
    if(vpnQa&&['/__preview__/bot/','/__preview__/bot/index.html'].includes(url.pathname)){
      if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
      const body=await readFile(new URL('../docs/preview/bot/index.html',import.meta.url));
      res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'});
      return res.end(req.method==='HEAD'?undefined:body);
    }
    // A synthetic preview must not mix its account API with live public prices.
    const qaPath=vpnQa&&url.pathname==='/public-plans/vpn'?'/vpn/api/plans':vpnQa&&url.pathname==='/public-plans/sufler'?'/sufler/api/billing/plan':url.pathname;
    if(['/vpn','/vpn/index.html'].includes(url.pathname)){
      res.writeHead(301,{Location:'/vpn/'+url.search});return res.end();
    }
    if(vpnQa&&qaPath.startsWith('/vpn/api/')){
      const headers={...req.headers,host:new URL(vpnQa).host};
      const body=['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(await Array.fromAsync(req));
      const upstream=await fetch(vpnQa+qaPath+url.search,{method:req.method,headers,body,redirect:'manual'});
      res.writeHead(upstream.status,Object.fromEntries(upstream.headers));return res.end(Buffer.from(await upstream.arrayBuffer()));
    }
    if(vpnQa&&qaPath==='/sufler/api/billing/plan'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});return res.end(JSON.stringify({enabled:true,amount:'990.00',currency:'RUB',days:30,receiptRequired:true}));}
    if(vpnQa&&qaPath==='/sufler/api/billing/result'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});return res.end('{"status":"pending"}');}
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
    if(canonicalCustomerFlow(url.pathname)){res.writeHead(302,{Location:'https://family-pie.ru'+url.pathname+url.search,'Cache-Control':'no-store'});return res.end();}
    if(publicPlans[url.pathname]) {
      const upstream=await fetch(publicPlans[url.pathname],{signal:AbortSignal.timeout(10000),redirect:'error'});
      if(!upstream.ok)throw Error('Public plan unavailable');
      const body=await upstream.text();res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});return res.end(req.method==='HEAD'?undefined:body);
    }
    const path=resolve(root,'.'+decodeURIComponent(url.pathname));
    if(path!==root&&!path.startsWith(root+'/')){res.writeHead(403);return res.end();}
    const target=await file(path)||await file(resolve(path,'index.html'))||await file(path+'.html');
    res.writeHead(target?200:404,{'Content-Type':mime[extname(target||'404.html')]||'application/octet-stream','Cache-Control':'no-cache'});
    res.end(req.method==='HEAD'?undefined:await readFile(target||resolve(root,'404.html')));
  }catch{res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end('{"error":"temporarily unavailable"}');}
});
server.listen(port,'127.0.0.1',()=>console.log(`Family Spy preview: http://localhost:${server.address().port}/`));
