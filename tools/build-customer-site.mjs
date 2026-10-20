import {cp, mkdir, readFile, writeFile, rm, readdir} from 'node:fs/promises';
import {resolve, relative, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const customerRedirects = [];
export const publicPlans = Object.freeze({
  '/public-plans/vpn':'https://family-spy.ru/vpn/api/plans',
  '/public-plans/sufler':'https://family-spy.ru/sufler/api/billing/plan'
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
      return path!=='vpn/index.html'&&!/^vpn\/api(\/|$)/.test(path);
    }
  });
  for (const file of ['index.html','customer.css','customer.js']) await cp(resolve(project,'customer-site',file),resolve(output,file));
  await cp(resolve(project,'customer-site/media'),resolve(output,'media'),{recursive:true});
  const dictionary=resolve(output,'i18n/en.js');
  await writeFile(dictionary,(await readFile(dictionary,'utf8')).replaceAll('· family-pie"','· Family Spy"')+'\nwindow.FP_EN["Ключ, созданный на старом сайте?"] = "Have a passkey from the previous site?";\nwindow.FP_EN["Войти со старым ключом"] = "Use an existing passkey";\nwindow.FP_EN["Выбери подписку"] = "Choose a plan";\nwindow.FP_EN["Аккаунт:"] = "Account:";\nwindow.FP_EN["Личный кабинет Family VPN."] = "Family VPN account.";\nwindow.FP_EN["Ожидаем оплату"] = "Awaiting payment";\nwindow.FP_EN["Выбрать тариф"] = "Choose a plan";\nwindow.FP_EN["Маршруты в твоём профиле"] = "Connection routes in your profile";\nwindow.FP_EN["Личная подписка содержит доступные пути подключения. После импорта выбери маршрут в VPN-приложении. Проверить свою сеть можно в разделе «Диагностика»."] = "Your subscription includes the available connection routes. After importing it, choose a route in your VPN app. You can check your connection under Diagnostics.";\nwindow.FP_EN[". Здесь можно войти прежним логином и паролем и добавить новый ключ в настройках."] = ". You can also use your existing username and password here, then add a new passkey in Settings.";\n');
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
        if(path===resolve(output,'sufler/index.html')) {
          html=html.replace(/<div class="preview" id="about"[\s\S]*?<\/div>\s*<\/section>/,'<figure class="preview customer-evidence" id="about"><img src="/media/sufler-answer.jpg" width="760" height="560" alt="Sufler: короткая подсказка к ответу" data-ru="Sufler: короткая подсказка к ответу" data-en="Sufler: answer prompt" data-copy-attr="alt"></figure></section>');
        }

        html=html.replaceAll('https://family-pie.ru/sufler/','https://family-spy.ru/sufler/');
        html=html.replaceAll("'https://hub.146-103-120-137.sslip.io/sufler-license'","'/sufler/api'");
        html=html.replaceAll('· family-pie</title>','· Family Spy</title>');
        html=html.replace(/(<a class="brand" href="\/(?:sufler\/)?"[^>]*>)family-pie (<span>\/ Sufler<\/span><\/a>)/g,'$1family-spy $2');
        html=html.replaceAll('aria-label="family-pie: на главную"','aria-label="Family Spy"');
        html=html.replace(/<a href="\/">family-pie<\/a>/g,'<a href="/">family-spy</a>');
        html=html.replaceAll('Студия Family Pie','Family Spy').replaceAll('Проект Family Pie · 2026','Family Spy · 2026');
        if(relative(output,path).replaceAll('\\','/').startsWith('vpn/')) {
          const home='<nav class="customer-home" aria-label="Family Spy"><div class="wrap"><a href="/"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5m6-6-6 6 6 6"/></svg><span data-ru="Все продукты Family Spy" data-en="All Family Spy products">Все продукты Family Spy</span></a></div></nav>';
          // Keep the return route visible with the existing sticky product header.
          html=html.includes('<header class="nav">') ? html.replace('<header class="nav">','<header class="nav">'+home) : html.replace(/<body([^>]*)>/,'<body$1>'+home);
        }
        html=html.replace('</head>','<link rel="stylesheet" href="/product-brand.css"><script src="/customer.js" defer></script></head>');
        await writeFile(path,html);count++;
      }
    }
  }
  await pages(output);
  const accountScript=resolve(output,'vpn/account.js');
  await writeFile(accountScript,(await readFile(accountScript,'utf8')).replace("$('.preview-bar').textContent=`Аккаунт: ${me.user.login}. Личный кабинет Family VPN.`;", "$('.preview-bar').replaceChildren(el('span','Аккаунт:'),document.createTextNode(' '+me.user.login+'. '),el('span','Личный кабинет Family VPN.'));") );
  // The existing service worker caches public shell assets only; account APIs stay network-only.
  await writeFile(resolve(output,'robots.txt'),'User-agent: *\nAllow: /\nDisallow: /public-plans/\nSitemap: https://family-spy.ru/sitemap.xml\n');
  const routes=['/','/vpn/terms/','/vpn/privacy/','/sufler/','/sufler/setup/','/sufler/terms/','/sufler/privacy/'];
  await writeFile(resolve(output,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+routes.map(route=>`<url><loc>https://family-spy.ru${route}</loc></url>`).join('')+'</urlset>\n');
  await writeFile(resolve(output,'404.html'),'<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Страница не найдена · Family Spy</title><link rel="stylesheet" href="/vpn/fonts.css"><link rel="stylesheet" href="/customer.css"><main class="wrap intro"><h1>Страница не найдена</h1><p><a class="button" href="/">На главную Family Spy</a></p></main></html>');
  return {output,pages:count+1};
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) console.log(JSON.stringify(await buildCustomerSite(process.argv[2])));
