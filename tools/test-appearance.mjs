import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readdir, readFile, mkdtemp, rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import vm from 'node:vm';
import {buildCustomerSite} from './build-customer-site.mjs';
import {buildPortfolioSite} from './build-portfolio-site.mjs';

function page(storage = new Map(), {fixed = false, blocked = false, early = false} = {}) {
  const listeners = {}, documentEvents = {}, attrs = {}, meta = {}, select = {};
  const classes = () => {const values = new Set(); return {add: value => values.add(value), contains: value => values.has(value), toggle(value, on) {if (on) values.add(value); else values.delete(value);}};};
  const root = {classList: classes(), dataset: {appearance: fixed ? 'fixed-dark' : 'shared'}, style: {}};
  const body = {classList: classes()};
  const button = {setAttribute: (name, value) => {attrs[name] = value;}};
  const document = {documentElement: root, body: early ? null : body,
    querySelectorAll: () => [button], querySelector: selector => selector === '#appearance' ? select : meta,
    addEventListener: (name, fn) => {documentEvents[name] = fn;}};
  const context = {document, localStorage: {getItem(key) {if (blocked) throw Error('blocked'); return storage.get(key) ?? null;}, setItem(key, value) {if (blocked) throw Error('blocked'); storage.set(key, value);}},
    getComputedStyle: () => ({getPropertyValue: () => root.classList.contains('light') ? '#fff' : '#000'}),
    Event: class {constructor(type) {this.type = type;}}, dispatchEvent() {}, addEventListener: (name, fn) => {listeners[name] = fn;}};
  context.window = context;
  vm.runInNewContext(readFileSync('site/appearance.js', 'utf8'), context);
  return {root, body, attrs, select, meta, context, listeners,
    ready() {document.body = body; documentEvents.DOMContentLoaded();},
    click() {documentEvents.click({target: {closest: () => button}});},
    choose(value) {documentEvents.change({target: {id: 'appearance', value}});}};
}
test('fresh and corrupt preferences start dark without depending on the OS theme', () => {
  for (const value of [null, 'invalid']) {
    const p = page(new Map(value ? [['family-vpn-theme-v3', value]] : []));
    assert.equal(p.root.classList.contains('light'), false);
    assert.equal(p.root.style.colorScheme, 'dark');
    assert.equal(p.attrs['aria-pressed'], 'false');
  }
});
test('a saved choice applies before body parsing and remains consistent after DOM ready', () => {
  const p = page(new Map([['family-vpn-theme-v3', 'light']]), {early: true});
  assert.equal(p.root.classList.contains('light'), true);
  p.ready();
  assert.equal(p.body.classList.contains('light'), true);
  assert.equal(p.select.value, 'light');
  assert.equal(p.meta.content, '#fff');
});
test('selection persists across product routes and the cached Back page refreshes it', () => {
  const storage = new Map(), vpn = page(storage);
  vpn.click();
  const sufler = page(storage);
  assert.equal(sufler.root.classList.contains('light'), true);
  sufler.choose('dark');
  vpn.listeners.pageshow();
  assert.equal(vpn.root.classList.contains('light'), false);
  assert.equal(vpn.body.classList.contains('light'), false);
  assert.equal(storage.get('family-vpn-theme-v3'), 'dark');
});
test('another tab and preference removal update open pages', () => {
  const storage = new Map(), p = page(storage);
  storage.set('family-vpn-theme-v3', 'light'); p.listeners.storage({key: 'family-vpn-theme-v3'});
  assert.equal(p.root.classList.contains('light'), true);
  storage.clear(); p.listeners.storage({key: null});
  assert.equal(p.root.classList.contains('light'), false);
});
test('fixed black artwork does not overwrite a saved light preference', () => {
  const storage = new Map([['family-vpn-theme-v3', 'light']]), p = page(storage, {fixed: true});
  assert.equal(p.root.classList.contains('light'), false);
  assert.equal(p.root.style.colorScheme, 'dark');
  assert.equal(storage.get('family-vpn-theme-v3'), 'light');
  assert.equal(page(storage).root.classList.contains('light'), true);
});
test('blocked storage keeps controls usable and invalid settings cannot corrupt appearance', () => {
  const p = page(new Map(), {blocked: true}); p.click(); p.listeners.pageshow();
  assert.equal(p.root.classList.contains('light'), true);
  p.choose('invalid'); assert.equal(p.root.classList.contains('light'), true);
  p.click(); assert.equal(p.root.classList.contains('light'), false);
});
test('every built HTML route includes the synchronous appearance bootstrap and assets', async () => {
  const dir = await mkdtemp(resolve('.appearance-test-'));
  try {
    for (const [name, build] of [['portfolio', buildPortfolioSite], ['customer', buildCustomerSite]]) {
      const {output} = await build(resolve(dir, name));
      assert.equal(await readFile(resolve(output, 'appearance.js'), 'utf8'), readFileSync('site/appearance.js', 'utf8'));
      assert.ok((await readFile(resolve(output, 'appearance.css'), 'utf8')).length);
      async function check(path) {
        for (const item of await readdir(path, {withFileTypes: true})) {
          const file = resolve(path, item.name);
          if (item.isDirectory()) await check(file);
          else if (item.name.endsWith('.html')) {
            const html = await readFile(file, 'utf8'), head = html.slice(0, html.indexOf('</head>'));
            assert.match(head, /<script src="\/appearance\.js"><\/script>/, file);
            assert.match(head, /href="\/appearance\.css"/, file);
            assert.match(head, /data-appearance="[^"]+"/, file);
            assert.doesNotMatch(html, /src="\/(?:portfolio-theme|home-theme)\.js"/, file);
          }
        }
      }
      await check(output);
    }
  } finally {await rm(dir, {recursive: true, force: true});}
});
