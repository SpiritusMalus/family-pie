import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

function page({saved, query = '', hash = '', storageFails = false, defaultLang} = {}) {
  const listeners = {}, writes = [];
  const context = {
    URL, URLSearchParams, navigator: {language: 'ru-RU'},
    location: {search: query, hash, href: 'https://family-pie.ru/test/' + query + hash},
    localStorage: {getItem() {if (storageFails) throw Error('blocked'); return saved;}, setItem(key,value) {if (storageFails) throw Error('blocked'); writes.push([key,value]);}},
    history: {replaceState(_state,_title,url) {context.url = url;}},
    document: {documentElement: {hasAttribute() {return false;}, getAttribute(name) {return name === 'data-fp-default-lang' ? defaultLang : null;}}, addEventListener(name,fn) {listeners[name] = fn;}, querySelectorAll() {return [];}},
    CustomEvent: class {constructor(type,options) {this.type=type;this.detail=options.detail;}},
    dispatchEvent(event) {listeners[event.type]?.(event);},
  };
  context.window = context;
  vm.createContext(context);
  for (const path of ['site/i18n/en.js','site/i18n/language.js']) vm.runInContext(readFileSync(path,'utf8'),context);
  return {context, api: context.FPi18n, writes, listeners};
}

test('explicit query and app fragment override the saved preference', () => {
  assert.equal(page({saved:'ru',query:'?lang=en'}).api.lang,'en');
  assert.equal(page({saved:'en',hash:'#api=https%3A%2F%2Frelodojo.app&token=test-only&lang=ru'}).api.lang,'ru');
});
test('English portfolio default respects explicit choices and leaves product defaults intact', () => {
  assert.equal(page({defaultLang:'en'}).api.lang,'en');
  assert.equal(page({defaultLang:'en',storageFails:true}).api.lang,'en');
  assert.equal(page({defaultLang:'en',saved:'ru'}).api.lang,'ru');
  assert.equal(page({defaultLang:'en',query:'?lang=ru'}).api.lang,'ru');
  assert.equal(page().api.lang,'ru');
});
test('switch persists, updates explicit query and preserves the fragment', () => {
  const {api,context,writes}=page({query:'?lang=en',hash:'#devices?platform=ios'});
  api.set('ru');
  assert.equal(api.lang,'ru');
  assert.equal(context.url,'/test/?lang=ru#devices?platform=ios');
  assert.deepEqual(writes.at(-1),['fp_lang','ru']);
});
test('storage failure does not prevent changing language', () => {
  const {api}=page({storageFails:true}); api.set('en');
  assert.equal(api.t('Неверный логин или пароль'),'Incorrect username or password');
  api.set('ru'); assert.equal(api.t('Неверный логин или пароль'),'Неверный логин или пароль');
});
test('template messages preserve user names and periods', () => {
  const {api}=page({saved:'en'});
  assert.equal(api.t('Подключение: macOS'),'Connecting: macOS');
  assert.equal(api.t('Подтверди, что @пример — твой Telegram-аккаунт.'),'Confirm that @пример is your Telegram account.');
  assert.equal(api.t('Выбран период: 90 дней. Цена ещё не утверждена; оплата пока недоступна.'),'Selected period: 90 days. Pricing has not been approved; payment is not available yet.');
});
test('combined admin states and clipboard checklist are English', () => {
  const {api}=page({saved:'en'});
  assert.equal(api.t('Активна · Без ограничения срока · Применено на VPN'),'Active · No expiry date · Applied to the VPN');
  assert.equal(api.t('  Скопировано  '),'  Copied  ');
  assert.ok(api.t('Устройство:\nВерсия VPN-приложения:\nПровайдер:\nВремя ошибки:\nМаршрут:\nТекст ошибки:\nНе добавляй личную ссылку подписки или QR-код.').startsWith('Device:\nVPN app version:'));
});
test('unrecognized user content is left intact', () => {
  const {api}=page({saved:'en'});
  assert.equal(api.t('Мой личный черновик с деталями подключения'),'Мой личный черновик с деталями подключения');
});

test('checkout language changes keep the selected plan and an in-flight payment disabled', async () => {
  const {context,api}=page({hash:'#api=http%3A%2F%2Flocalhost%3A8101&token=test-only&lang=en'});
  function element() {
    const node={textContent:'',children:[],attrs:{},events:{},classList:{add(){},remove(){}},
      setAttribute(k,v){this.attrs[k]=v;},appendChild(child){this.children.push(child);},
      addEventListener(name,fn){this.events[name]=fn;}};
    Object.defineProperty(node,'innerHTML',{set(value){this.html=value;this.children=[];},get(){return this.html;}});
    return node;
  }
  const ids=Object.fromEntries(['h1','belt-label','lead','pay','fine','noToken','plans','err'].map(id=>[id,element()]));
  context.document.getElementById=id=>ids[id];context.document.createElement=element;
  const calls=[];
  context.fetch=(url,options)=>{
    calls.push([url,options]);
    if(url.endsWith('/billing/plans'))return Promise.resolve({ok:true,json:async()=>({plans:[
      {id:'monthly',days:30,price_rub:990,label_ru:'Месяц',label_en:'Monthly'},
      {id:'yearly',days:365,price_rub:9000,label_ru:'Год',label_en:'Yearly'}]})});
    return new Promise(()=>{}); // An in-flight request; never contacts a provider.
  };
  context.addEventListener=(name,fn)=>context['on'+name]=fn;
  context.dispatchEvent=event=>context['on'+event.type]?.(event);
  const html=readFileSync('site/relo_dojo/checkout/index.html','utf8');
  vm.runInContext(html.match(/<script>\s*([\s\S]*?)<\/script>/)[1],context);
  await new Promise(resolve=>setImmediate(resolve));
  ids.plans.children[1].onclick();api.set('ru');
  assert.equal(ids.h1.textContent,'Чёрный пояс');
  assert.equal(ids.plans.children[1].attrs['aria-selected'],'true');
  api.set('en');ids.pay.events.click();api.set('ru');
  assert.equal(ids.pay.disabled,true);
  assert.equal(ids.pay.textContent,'Создаём оплату…');
  assert.equal(JSON.parse(calls.at(-1)[1].body).plan,'yearly');
  assert.ok(context.url.includes('token=test-only'));
});

test('subscription checkout summary and fields follow the common language',()=>{
 const {api}=page({saved:'en'});
 assert.equal(api.t('Email для чека'),'Receipt email');
 assert.equal(api.t('Перейти к оплате'),'Continue to payment');
 assert.equal(api.t('90 дней · 800,00 ₽'),'90 days · 800,00 ₽');
 assert.equal(api.t('Подключение появится после подтверждения оплаты.'),'Your connection will appear once payment is confirmed.');
 api.set('ru');assert.equal(api.t('90 дней · 800,00 ₽'),'90 дней · 800,00 ₽');
});

test('payment history and connection setup labels are English without changing amounts or dates',()=>{
 const {api}=page({saved:'en'});
 const expected=new Map([
  ['Оплачен','Paid'],['Отменён','Canceled'],['Возврат','Refunded'],['До','Until'],
  ['Добавить в Happ','Add to Happ'],['Проверить подключение','Check connection'],
  ['Показать личный QR-код','Show my private QR code'],['Личный QR-код подключения','Private connection QR code'],
  ['Не публикуй этот код: он даёт доступ к твоей подписке.','Do not publish this code: it gives access to your subscription.'],
  ['Скачать для Mac ↗','Download for Mac ↗'],['Все сборки ↗','All builds ↗'],
  ['Настроить VPN','Set up VPN'],['Продолжить оплату','Continue payment'],
  ['Незавершённая оплата','Pending payment'],
  ['Ссылка оплаты больше недоступна. Проверь статус заказа или напиши в поддержку перед новой покупкой.','The payment link is no longer available. Check the order status or contact support before making a new purchase.'],
  ['Платёж больше нельзя продолжить. Выбери тот же тариф и создай новый заказ или напиши в поддержку','This payment can no longer be continued. Choose the same plan and create a new order, or contact support'],
  ['Заказ уже завершён','This order is already complete'],
  ['Оплата временно недоступна','Payment is temporarily unavailable'],
  ['Проверка платежа временно недоступна. Повтори позже.','Payment verification is temporarily unavailable. Try again later.'],
  ['Создать другой заказ','Create another order'],['Создать другой заказ?','Create another order?'],
  ['Предыдущий платёж не отменится. Оплати только один заказ, чтобы избежать двойной покупки.','Your previous payment will remain open. Pay for only one order to avoid buying twice.'],
  ['Выбран другой тариф. Для него нужен отдельный заказ.','You selected another plan. It needs a separate order.'],
  ['Укажи email для чека. Затем снова нажми «Создать другой заказ».','Enter a receipt email, then select Create another order again.'],
  ['Оплата уже подтверждена. Открой «Обзор», чтобы подключить VPN.','Payment is already confirmed. Open Overview to connect your VPN.'],
  ['Написать в поддержку','Contact support'],['Ожидаем оплату','Awaiting payment'],
  ['У тебя есть незавершённый платёж. Продолжи его или проверь статус перед новой покупкой.','You have a pending payment. Continue it or check its status before making a new purchase.'],
  ['Сначала заверши или отмени текущий платёж у ЮKassa. Затем можно выбрать другой тариф.','Complete or cancel your current payment with YooKassa first. You can then choose another plan.'],
  ['Платёж отменён. Можно оплатить выбранный тариф ещё раз.','Payment canceled. You can pay for your selected plan again.'],
  ['Тариф этого заказа сейчас недоступен для новой покупки.','This order’s plan is currently unavailable for a new purchase.'],
  ['Скидка 15%. Сумма будет сохранена в заказе.','Discount: 15%. The amount will be saved in your order.'],
  ['180 дней · 1\u00a0400,00\u00a0₽ · 20.10.2026, 13:29:00','180 days · 1\u00a0400,00\u00a0₽ · 20.10.2026, 13:29:00']
 ]);
 for(const [source,target]of expected)assert.equal(api.t(source),target,source);
 for(const text of ['До встречи в Москве','Мой личный QR-код и детали','Мой тариф ↗','18.04.2027, 13:29:00'])assert.equal(api.t(text),text);
 api.set('ru');for(const source of expected.keys())assert.equal(api.t(source),source);
});

test('late payment updates and QR attributes follow reversible RU/EN switching',()=>{
 const {api,context,listeners}=page({saved:'en'});
 const text=value=>({nodeType:3,data:value,parentElement:null});
 const element=(children=[],attrs={})=>{
  const node={nodeType:1,childNodes:children,attrs,parentElement:null,
   hasAttribute(name){return Object.hasOwn(this.attrs,name);},getAttribute(name){return this.attrs[name]??null;},setAttribute(name,value){this.attrs[name]=value;},
   matches(){return false;},closest(selector){return selector.includes('[data-fp-no-i18n]')&&this.hasAttribute('data-fp-no-i18n')?this:this.parentElement?.closest(selector);}};
  children.forEach(child=>child.parentElement=node);return node;
 };
 const prefix=text('До'),date=text(' 18.04.2027, 13:29:00'),download=text('Скачать для Mac ↗');
 const protectedText=text('Отменён'),root=element([element([prefix,date]),element([download]),element([protectedText],{'data-fp-no-i18n':''})],{'data-fp-translate':''});
 context.Node={TEXT_NODE:3,ELEMENT_NODE:1};context.document.documentElement=root;
 context.document.querySelector=selector=>selector==='.langtoggle'?{}:null;
 let mutations;context.MutationObserver=class{constructor(callback){mutations=callback;}observe(){}};
 listeners.DOMContentLoaded();
 assert.equal(prefix.data,'Until');assert.equal(date.data,' 18.04.2027, 13:29:00');
 assert.equal(download.data,'Download for Mac ↗');assert.equal(protectedText.data,'Отменён');
 const state=text('Отменён'),copy=text('Подключение скопировано. Добавь его в VPN-приложение.'),qr=element([],{alt:'Личный QR-код подключения'}),late=element([state,copy,qr]);
 root.childNodes.push(late);late.parentElement=root;mutations([{type:'childList',addedNodes:[late]}]);
 assert.equal(state.data,'Canceled');assert.equal(copy.data,'Connection copied. Add it to your VPN app.');assert.equal(qr.attrs.alt,'Private connection QR code');
 api.set('ru');assert.equal(prefix.data,'До');assert.equal(download.data,'Скачать для Mac ↗');assert.equal(state.data,'Отменён');assert.equal(qr.attrs.alt,'Личный QR-код подключения');
 api.set('en');assert.equal(state.data,'Canceled');assert.equal(prefix.data,'Until');assert.equal(date.data,' 18.04.2027, 13:29:00');
});
