import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

function page({saved, query = '', hash = '', storageFails = false} = {}) {
  const listeners = {}, writes = [];
  const context = {
    URL, URLSearchParams, navigator: {language: 'ru-RU'},
    location: {search: query, hash, href: 'https://family-pie.ru/test/' + query + hash},
    localStorage: {getItem() {if (storageFails) throw Error('blocked'); return saved;}, setItem(key,value) {if (storageFails) throw Error('blocked'); writes.push([key,value]);}},
    history: {replaceState(_state,_title,url) {context.url = url;}},
    document: {documentElement: {hasAttribute() {return false;}}, addEventListener(name,fn) {listeners[name] = fn;}, querySelectorAll() {return [];}},
    CustomEvent: class {constructor(type,options) {this.type=type;this.detail=options.detail;}},
    dispatchEvent(event) {listeners[event.type]?.(event);},
  };
  context.window = context;
  vm.createContext(context);
  for (const path of ['site/i18n/en.js','site/i18n/language.js']) vm.runInContext(readFileSync(path,'utf8'),context);
  return {context, api: context.FPi18n, writes};
}

test('explicit query and app fragment override the saved preference', () => {
  assert.equal(page({saved:'ru',query:'?lang=en'}).api.lang,'en');
  assert.equal(page({saved:'en',hash:'#api=https%3A%2F%2Frelodojo.app&token=test-only&lang=ru'}).api.lang,'ru');
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
