// The VPN search entry inherits the approved storefront composition and price flow.
// Keep shared offers in one source; do not publish a second set of prices or claims.
export function buildVpnLanding(home, details) {
  for (const marker of ['<section id="vpn"', '<section id="sufler"', '<section id="support"']) {
    if (!home.includes(marker)) throw Error('Missing storefront section: ' + marker);
  }
  const service = {
    '@context':'https://schema.org', '@type':'Service', '@id':'https://family-spy.ru/vpn/#service',
    name:'Family VPN', serviceType:'VPN-подписка', url:'https://family-spy.ru/vpn/',
    description:'VPN-подписка для телефона, компьютера и телевизора. Без лимита устройств, с настройкой в личном кабинете и поддержкой в Telegram.',
    brand:{'@type':'Brand',name:'Family Spy',url:'https://family-spy.ru/'}
  };
  // The shared home nests the offer under H2; this dedicated page starts at H1.
  const landing = home.replace(/(<section id="vpn"[\s\S]*?<\/section>)/, section =>
    section.replace(/<(\/?)(h[34])\b/g, (_, close, tag) => '<'+close+(tag==='h3'?'h2':'h3')));
  return landing
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/, '<title data-ru="Купить VPN-подписку для телефона и компьютера | Family Spy" data-en="VPN subscription for your phone and computer | Family Spy">Купить VPN-подписку для телефона и компьютера | Family Spy</title>')
    .replace(/<meta name="description"[^>]*>/, '<meta name="description" content="Family VPN от Family Spy: VPN для Android, iPhone, Windows, Mac и TV. Одна подписка без лимита устройств. Выберите срок, оплатите и подключите VPN по инструкции." data-ru="Family VPN от Family Spy: VPN для Android, iPhone, Windows, Mac и TV. Одна подписка без лимита устройств. Выберите срок, оплатите и подключите VPN по инструкции." data-en="Family VPN by Family Spy: VPN for Android, iPhone, Windows, Mac and TV. One subscription with no device limit. Choose a duration, pay and follow the setup guide." data-copy-attr="content">')
    .replace(/<link rel="canonical"[^>]*>/, '<link rel="canonical" href="https://family-spy.ru/vpn/">')
    .replace(/<meta property="og:title"[^>]*>/, '<meta property="og:title" content="Family VPN от Family Spy" data-ru="Family VPN от Family Spy" data-en="Family VPN by Family Spy" data-copy-attr="content">')
    .replace(/<meta property="og:url"[^>]*>/, '<meta property="og:url" content="https://family-spy.ru/vpn/">')
    .replace('</head>', '<link rel="stylesheet" href="/vpn-search.css"><script type="application/ld+json">'+JSON.stringify(service)+'</script></head>')
    .replace('<body class="customer-home">', '<body class="customer-home vpn-landing">')
    .replace(/<!--\nTHESIS:[\s\S]*?-->/, `<!--
THESIS: A useful Russian search entry for Family Spy's VPN subscription.
OWN-WORLD: Inherit the approved black canvas, Golos Text, coral actions and physical device composition.
STORY: Understand the subscription, choose a duration, then buy through the existing account. Setup answers and direct support follow.
FIRST VIEWPORT: The existing offer and purchase action face the laptop, phone and TV scene. Mobile stacks the same offer and devices.
FORM: Extension of the approved VPN composition, not a new visual identity. Shared price rows, platform links and native FAQ disclosures.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
-->`)
    .replace('<h1 class="visually-hidden">Family Spy</h1>', '')
    .replace('<h2 id="vpn-title">', '<h1 id="vpn-title">')
    .replace('<span>VPN</span></h2>', '<span>VPN</span></h1>')
    .replace('href="#sufler"', 'href="/sufler/"')
    .replace(/<section id="sufler"[\s\S]*?<\/section>/, '')
    .replace(/<article><h3>Sufler<\/h3>[\s\S]*?<\/article>/, '')
    .replace('<section id="support"', details+'\n<section id="support"')
    .replace(/<p class="vpn-more">[\s\S]*?<\/p>/, '<p class="vpn-more"><a href="#vpn-questions" data-ru="Вопросы о VPN" data-en="VPN questions">Вопросы о VPN</a></p>')
    .replaceAll('Тарифы на странице VPN','Тарифы в личном кабинете')
    .replaceAll('See plans on the VPN page','See account pricing');
}
