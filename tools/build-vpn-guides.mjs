import {buildVpnLanding} from './build-vpn-landing.mjs';

const origin = 'https://family-spy.ru';
const escape = text => text.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');

function guide(shell, content, {route, bodyClass, titleRu, titleEn, descriptionRu, descriptionEn}) {
  const start=shell.indexOf('<main id="main">'), end=shell.indexOf('</main>');
  const support=shell.match(/<section id="support"[\s\S]*?<\/section>/)?.[0];
  if(start<0||end<start||!support)throw Error('Missing shared customer shell');
  const schema={'@context':'https://schema.org','@type':'TechArticle',headline:titleRu,url:origin+route,inLanguage:'ru',publisher:{'@type':'Organization',name:'Family Spy',url:origin+'/'}};
  return (shell.slice(0,start)+'<main id="main">'+content+support+shell.slice(end))
    .replace('vpn-landing"',`vpn-landing ${bodyClass}"`)
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/,`<title data-ru="${escape(titleRu)}" data-en="${escape(titleEn)}">${escape(titleRu)}</title>`)
    .replace(/<meta name="description"[^>]*>/,`<meta name="description" content="${escape(descriptionRu)}" data-ru="${escape(descriptionRu)}" data-en="${escape(descriptionEn)}" data-copy-attr="content">`)
    .replace(/<link rel="canonical"[^>]*>/,`<link rel="canonical" href="${origin+route}">`)
    .replace(/<meta property="og:title"[^>]*>/,`<meta property="og:title" content="${escape(titleRu)}" data-ru="${escape(titleRu)}" data-en="${escape(titleEn)}" data-copy-attr="content">`)
    .replace(/<meta property="og:url"[^>]*>/,`<meta property="og:url" content="${origin+route}">`)
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g,'')
    .replace('</head>',`<link rel="stylesheet" href="/vpn-guides.css"><script type="application/ld+json">${JSON.stringify(schema)}</script></head>`)
    .replace(/<nav aria-label="Навигация"[\s\S]*?<\/nav>/,'<nav aria-label="Навигация" data-ru="Навигация" data-en="Navigation" data-copy-attr="aria-label"><a href="/vpn/">Family VPN</a><a href="/vpn/setup/" data-ru="Подключение" data-en="Setup">Подключение</a><a href="/vpn/help/connection/" data-ru="Помощь" data-en="Help">Помощь</a></nav>')
    .replace(/<!--\nTHESIS:[\s\S]*?-->/,`<!--
THESIS: Practical help for Family VPN customers, organized around their task and device.
OWN-WORLD: Preserve Spy's black canvas, Golos Text, coral links and quiet rules.
STORY: Choose a device or symptom, follow concrete steps, then use existing account/support destinations.
FIRST VIEWPORT: A task heading, short introduction and useful navigation. No separate subscription offer or client-branded hero.
FORM: Read mode with open platform instructions or a symptom index and ruled article. Subscription sales stay on /vpn/.
MOTION: Native anchors/disclosures, existing visible focus and reduced-motion behavior. No simulated diagnosis.
FINISH: Fresh review and documentation before the owner sees the revised preview; publication requires approval.
-->`);
}

export function buildVpnGuides(home, setupContent, helpContent) {
  const shell=buildVpnLanding(home,'');
  return {
    setup:guide(shell,setupContent,{route:'/vpn/setup/',bodyClass:'vpn-setup',
      titleRu:'Подключить Family VPN на телефоне и компьютере | Family Spy',titleEn:'Connect Family VPN on your phone and computer | Family Spy',
      descriptionRu:'Инструкции подключения Family VPN для Android, Windows и iPhone. Установка приложения, личная ссылка и QR-код из кабинета.',descriptionEn:'Family VPN setup for Android, Windows and iPhone. Install the app and import your personal link or QR code from your account.'}),
    help:guide(shell,helpContent,{route:'/vpn/help/connection/',bodyClass:'connection-help',
      titleRu:'VPN не подключается: проверка подписки и сети | Family Spy',titleEn:'VPN not connecting: subscription and network checks | Family Spy',
      descriptionRu:'Что проверить, если VPN не подключается, подписка не загружается или нет интернета. Пошаговая проверка и поддержка Family Spy.',descriptionEn:'What to check when your VPN cannot connect, load a subscription or access the internet. Step-by-step checks and Family Spy support.'})
  };
}
