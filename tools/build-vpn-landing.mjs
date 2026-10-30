// The VPN search entry inherits the approved storefront composition and price flow.
// Keep shared offers in one source; do not publish a second set of prices or claims.
export function buildVpnLanding(home, details) {
  for (const marker of ['<section id="vpn"', '<section id="sufler"', '</main>']) {
    if (!home.includes(marker)) throw Error('Missing storefront section: ' + marker);
  }
  const service = {
    '@context':'https://schema.org', '@type':'Service', '@id':'https://family-spy.ru/vpn/#service',
    name:'Family VPN', serviceType:'VPN-подписка', url:'https://family-spy.ru/vpn/',
    description:'VPN-подписка для телефона, компьютера и телевизора. Без лимита устройств, с настройкой в личном кабинете и поддержкой по почте и в Telegram.',
    brand:{'@type':'Brand',name:'Family Spy',url:'https://family-spy.ru/'}
  };
  // The shared home nests the offer under H2; this dedicated page starts at H1.
  const landing = home.replace(/(<section id="vpn"[\s\S]*?<\/section>)/, section =>
    section.replace(/<(\/?)(h[34])\b/g, (_, close, tag) => '<'+close+(tag==='h3'?'h2':'h3')));
  return landing
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/, '<title data-ru="Купить ВПН для телефона и компьютера | Family Spy" data-en="Buy a VPN subscription for your phone and computer | Family Spy">Купить ВПН для телефона и компьютера | Family Spy</title>')
    .replace(/<meta name="description"[^>]*>/, '<meta name="description" content="Family VPN: одна подписка для телефона, компьютера и TV без лимита устройств. Выберите срок, оплатите в личном кабинете и подключитесь по инструкции." data-ru="Family VPN: одна подписка для телефона, компьютера и TV без лимита устройств. Выберите срок, оплатите в личном кабинете и подключитесь по инструкции." data-en="Family VPN: one subscription for your phone, computer and TV with no device limit. Choose a duration, pay in your account and follow the setup guide." data-copy-attr="content">')
    .replace(/<link rel="canonical"[^>]*>/, '<link rel="canonical" href="https://family-spy.ru/vpn/">')
    .replace(/<meta property="og:title"[^>]*>/, '<meta property="og:title" content="Купить ВПН для телефона и компьютера | Family Spy" data-ru="Купить ВПН для телефона и компьютера | Family Spy" data-en="Buy a VPN subscription for your phone and computer | Family Spy" data-copy-attr="content">')
    .replace(/<meta property="og:url"[^>]*>/, '<meta property="og:url" content="https://family-spy.ru/vpn/">')
    .replace('</head>', '<meta property="og:description" content="Family VPN: одна подписка для телефона, компьютера и TV без лимита устройств. Выберите срок, оплатите в личном кабинете и подключитесь по инструкции." data-ru="Family VPN: одна подписка для телефона, компьютера и TV без лимита устройств. Выберите срок, оплатите в личном кабинете и подключитесь по инструкции." data-en="Family VPN: one subscription for your phone, computer and TV with no device limit. Choose a duration, pay in your account and follow the setup guide." data-copy-attr="content"><link rel="stylesheet" href="/vpn-search.css"><script type="application/ld+json">'+JSON.stringify(service)+'</script></head>')
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
    .replace('</main>', details+'\n</main>')
    .replaceAll('https://t.me/family_pie_vpn_bot?start=support"', 'https://t.me/family_pie_vpn_bot?start=support_vpn"')
    .replace(/<p class="vpn-more">[\s\S]*?<\/p>/, '<p class="vpn-more"><a href="#vpn-questions" data-ru="Вопросы о VPN" data-en="VPN questions">Вопросы о VPN</a></p>')
    .replaceAll('Тарифы на странице VPN','Тарифы в личном кабинете')
    .replaceAll('See plans on the VPN page','See account pricing');
}

// Keep the complete shared offer on /vpn/ and publish only its introduction at /.
export function buildStorefrontHome(home) {
  const start = home.indexOf('<section id="vpn"');
  const details = home.indexOf('<div id="vpn-features"', start);
  const end = home.indexOf('</section>', details);
  if (start < 0 || details < start || end < details || !home.includes('<section id="sufler"')) {
    throw Error('Missing storefront section for compact home');
  }
  let compact = home.slice(0, details) + home.slice(end);
  const replace = (from, to) => {
    if (!compact.includes(from)) throw Error('Missing compact home marker: ' + from);
    compact = compact.replace(from, to);
  };
  replace('<a href="#vpn">Family VPN</a>', '<a href="/vpn/">Family VPN</a>');
  replace('class="button" href="#vpn-pricing"', 'class="button" id="vpn-pricing" href="/vpn/#vpn-pricing"');
  replace('class="vpn-explore" href="#vpn-features"', 'class="vpn-explore" id="vpn-features" href="/vpn/#vpn-features"');
  replace('M12 4v16m-5-5 5 5 5-5', 'M7 17 17 7M7 7h10v10');
  replace('<script src="/customer.js" defer></script>', '<script src="/home-vpn.js" defer></script>\n<script src="/customer.js" defer></script>');
  compact = compact
    .replace(/\s*<fieldset class="device-picker">[\s\S]*?<\/fieldset>/, '')
    .replace(/\s*<a class="device-setup"[\s\S]*?<\/a>/, '')
    .replace(/STORY:[^\n]+/, 'STORY: Preview VPN and Sufler, then continue directly to the relevant product, plan or account.')
    .replace(/FORM:[^\n]+/, 'FORM: Two concise product introductions. Full VPN features, tariffs, device setup and FAQ belong to /vpn/.');
  return compact;
}
