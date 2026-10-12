import {cp, mkdir, readFile, writeFile, rm, readdir} from 'node:fs/promises';
import {resolve, relative, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const customerRedirects = [
  '/vpn/cabinet', '/vpn/admin', '/sufler/buy'
];
export const publicPlans = Object.freeze({
  '/public-plans/vpn':'https://family-pie.ru/vpn/api/plans',
  '/public-plans/sufler':'https://hub.146-103-120-137.sslip.io/sufler-license/billing/plan'
});
export function canonicalCustomerFlow(path) {
  return customerRedirects.some(prefix => path === prefix || path.startsWith(prefix + '/'));
}
export async function buildCustomerSite(output = resolve(project, 'customer-site/dist')) {
  output = resolve(output);
  if (output === project || output === resolve(project,'site') || !output.startsWith(project + '/')) throw Error('Refusing unsafe output path');
  const prepare = async () => {
    await mkdir(output,{recursive:true});
    const existing = await readdir(output);
    if (existing.length && !existing.includes('.customer-build')) throw Error('Refusing to overwrite an unmanaged directory');
    if (existing.length) for (const name of existing) await rm(resolve(output,name),{recursive:true,force:true});
    await writeFile(resolve(output,'.customer-build'),'Family Spy generated static site\n');
  };
  await prepare();
  for (const folder of ['vpn','sufler','i18n']) await cp(resolve(project,'site',folder),resolve(output,folder),{
    recursive:true,filter:source => {
      const path = relative(resolve(project,'site'),source).replaceAll('\\','/');
      return !/^(vpn\/(cabinet|admin|api)|sufler\/buy)(\/|$)/.test(path);
    }
  });
  for (const file of ['index.html','customer.css','customer.js']) await cp(resolve(project,'customer-site',file),resolve(output,file));
  const dictionary=resolve(output,'i18n/en.js');
  await writeFile(dictionary,(await readFile(dictionary,'utf8')).replaceAll('· family-pie"','· Family Spy"')+'\nwindow.FP_EN["Подписка, подключение и помощь — в твоём личном кабинете."] = "Your subscription, connection and support are in your account.";\n');
  await cp(resolve(project,'site/social-footer.css'),resolve(output,'social-footer.css'));
  await cp(resolve(project,'customer-site/product-brand.css'),resolve(output,'product-brand.css'));
  let count=0;
  async function pages(directory) {
    for (const item of await readdir(directory,{withFileTypes:true})) {
      const path=resolve(directory,item.name);
      if(item.isDirectory()) await pages(path);
      else if(item.name.endsWith('.html') && path !== resolve(output,'index.html')) {
        let html=await readFile(path,'utf8');
        html=html.replace(/<div class="fp-social">[\s\S]*?<\/div>/g,'');
        html=html.replaceAll('https://family-pie.ru/sufler/','https://family-spy.ru/sufler/');
        html=html.replaceAll('· family-pie</title>','· Family Spy</title>');
        html=html.replace(/(<a class="brand" href="\/(?:sufler\/)?"[^>]*>)family-pie (<span>\/ Sufler<\/span><\/a>)/g,'$1family-spy $2');
        html=html.replaceAll('aria-label="family-pie: на главную"','aria-label="Family Spy"');
        html=html.replace(/<a href="\/">family-pie<\/a>/g,'<a href="/">family-spy</a>');
        html=html.replaceAll('Студия Family Pie','Family Spy').replaceAll('Проект Family Pie · 2026','Family Spy · 2026');
        html=html.replace('</head>','<link rel="stylesheet" href="/product-brand.css"><script src="/customer.js" defer></script></head>');
        await writeFile(path,html);count++;
      }
    }
  }
  await pages(output);
  // This origin hosts the storefront. Auth, passkeys and payment recovery retain
  // their existing origin until a separately verified account migration.
  const app=resolve(output,'vpn/app.js');
  await writeFile(app,(await readFile(app,'utf8')).replace(/  if\('serviceWorker' in navigator\).*?\n/,''));
  await rm(resolve(output,'vpn/sw.js'),{force:true});
  await rm(resolve(output,'vpn/manifest.json'),{force:true});
  const vpnIndex=resolve(output,'vpn/index.html');
  await writeFile(vpnIndex,(await readFile(vpnIndex,'utf8')).replace(/<link rel="manifest"[^>]+>/g,''));
  await writeFile(resolve(output,'robots.txt'),'User-agent: *\nAllow: /\nDisallow: /public-plans/\nSitemap: https://family-spy.ru/sitemap.xml\n');
  const routes=['/','/vpn/','/vpn/terms/','/vpn/privacy/','/sufler/','/sufler/setup/','/sufler/terms/','/sufler/privacy/'];
  await writeFile(resolve(output,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+routes.map(route=>`<url><loc>https://family-spy.ru${route}</loc></url>`).join('')+'</urlset>\n');
  await writeFile(resolve(output,'404.html'),'<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Страница не найдена · Family Spy</title><link rel="stylesheet" href="/vpn/fonts.css"><link rel="stylesheet" href="/customer.css"><main class="wrap intro"><h1>Страница не найдена</h1><p><a class="button" href="/">На главную Family Spy</a></p></main></html>');
  return {output,pages:count+1};
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) console.log(JSON.stringify(await buildCustomerSite(process.argv[2])));
