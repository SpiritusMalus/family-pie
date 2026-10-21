import {buildVpnLanding} from './build-vpn-landing.mjs';

const origin = 'https://family-spy.ru';
const escape = text => text.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');

function metadata(html, route, ru, en, descriptionRu, descriptionEn, schema) {
  return html
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/, `<title data-ru="${escape(ru)}" data-en="${escape(en)}">${escape(ru)}</title>`)
    .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${escape(descriptionRu)}" data-ru="${escape(descriptionRu)}" data-en="${escape(descriptionEn)}" data-copy-attr="content">`)
    .replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${origin+route}">`)
    .replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${escape(ru)}" data-ru="${escape(ru)}" data-en="${escape(en)}" data-copy-attr="content">`)
    .replace(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${origin+route}">`)
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '')
    .replace('</head>', `<link rel="stylesheet" href="/vpn-guides.css"><script type="application/ld+json">${JSON.stringify(schema)}</script></head>`);
}

export function buildVpnGuides(home, happContent, helpContent) {
  let happ = buildVpnLanding(home, happContent)
    .replace('vpn-landing"', 'vpn-landing happ-landing"')
    .replace('<h1 id="vpn-title"><span>Family</span> <span>VPN</span></h1>', '<h1 id="vpn-title"><span data-ru="Подписка" data-en="VPN plan">Подписка</span> <span data-ru="для Happ" data-en="for Happ">для Happ</span></h1>')
    .replace(/<p class="vpn-purpose"[^>]*>[\s\S]*?<\/p>/, '<p class="vpn-purpose" data-ru="Family VPN для приложения Happ. Одна подписка без лимита устройств." data-en="Family VPN for the Happ app. One subscription with no device limit.">Family VPN для приложения Happ. Одна подписка без лимита устройств.</p>')
    .replace(/<fieldset class="device-picker">[\s\S]*?<\/fieldset>/, '')
    .replace(' data-device-scene', '')
    .replace(/<a class="device-setup"[^>]*>[\s\S]*?<\/a>/, '<a class="device-setup" href="#happ-setup" data-ru="Как подключить Happ" data-en="How to connect Happ">Как подключить Happ</a>')
    .replace(/<nav aria-label="Навигация"[\s\S]*?<\/nav>/, '<nav aria-label="Навигация" data-ru="Навигация" data-en="Navigation" data-copy-attr="aria-label"><a href="/vpn/">Family VPN</a><a href="#happ-setup" data-ru="Подключение" data-en="Setup">Подключение</a><a href="/vpn/help/connection/" data-ru="Помощь" data-en="Help">Помощь</a></nav>');
  for (const platform of ['android','ios','windows']) happ = happ.replaceAll(`/vpn/cabinet/#devices?platform=${platform}`, `#happ-${platform}`);
  happ = metadata(happ, '/vpn/happ/',
    'Купить VPN-подписку для Happ | Family Spy', 'Buy a VPN subscription for Happ | Family Spy',
    'Подписка Family VPN для Happ: выбери срок, оплати и добавь личную ссылку или QR-код. Инструкции для Android, Windows и iPhone, продление и помощь.',
    'A Family VPN subscription for Happ: choose a duration, pay and import your personal link or QR code. Android, Windows and iPhone setup, renewal and help.',
    {'@context':'https://schema.org','@type':'Service',name:'Family VPN для Happ',serviceType:'VPN-подписка',url:origin+'/vpn/happ/',provider:{'@type':'Organization',name:'Family Spy',url:origin+'/'}});
  happ = happ.replace(/<!--\nTHESIS:[\s\S]*?-->/, `<!--
THESIS: A Family VPN subscription for visitors who already know the Happ client.
OWN-WORLD: Preserve the approved black/Golos/coral storefront and existing decorative device scene.
STORY: Offer and real pricing, selected duration into the existing account/payment flow, then public device installation, link/QR import, renewal and diagnostic help.
FIRST VIEWPORT: Left-aligned two-line subscription title, verified price/fallback and purchase/account actions face the incumbent devices. On mobile the title stays two left-aligned lines and the scene follows the offer.
MOTION: Inherit the finite device arrival and reduced-motion behavior. Native mobile plan disclosures and FAQ are the only changing content; no new connection state or autoplay.
FINISH: Fresh finish review and documentation precede a shown-preview publication hold.
-->`);

  const start = happ.indexOf('<main id="main">'), end = happ.indexOf('</main>');
  if (start < 0 || end < start) throw Error('Missing shared customer main');
  const support = happ.match(/<section id="support"[\s\S]*?<\/section>/)?.[0];
  if (!support) throw Error('Missing shared VPN support');
  let help = happ.slice(0,start) + '<main id="main">' + helpContent + support + happ.slice(end);
  help = help.replace('vpn-landing happ-landing','vpn-landing connection-help')
    .replace('href="#happ-setup"', 'href="/vpn/happ/#happ-setup"');
  help = help.replace(/<!--\nTHESIS:[\s\S]*?-->/, `<!--
THESIS: Help a reader diagnose their Happ symptom before contacting support.
OWN-WORLD: Existing Spy typography, black canvas, coral links and quiet rules; Read mode without sales artwork.
STORY: Recognize symptom, follow checks, open existing account only where needed, contact support or inspect the subscription offer.
FIRST VIEWPORT: Clear heading and short introduction above a symptom index and readable article. Index is a side column on desktop and wraps above the article on mobile.
MOTION: Native anchor navigation with existing reduced-motion handling. No animated diagnosis or implied live test.
FINISH: Fresh finish review and documentation precede a shown-preview publication hold.
-->`);
  help = metadata(help, '/vpn/help/connection/',
    'Happ не работает: проверка подписки и подключения | Family Spy', 'Happ not working: subscription and connection checks | Family Spy',
    'Что проверить, если Happ не загружает подписку, не подключается или подключён без интернета. Пошаговая диагностика и помощь Family Spy.',
    'What to check when Happ cannot load a subscription, connect, or access the internet. Step-by-step checks and Family Spy support.',
    {'@context':'https://schema.org','@type':'TechArticle',headline:'Happ не работает: проверка подписки и подключения',url:origin+'/vpn/help/connection/',inLanguage:'ru',publisher:{'@type':'Organization',name:'Family Spy',url:origin+'/'}});
  // metadata is applied to an already styled customer shell, so keep one guide stylesheet.
  help = help.replace('<link rel="stylesheet" href="/vpn-guides.css">','');
  return {happ,help};
}
