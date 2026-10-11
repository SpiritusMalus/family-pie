import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

function legalPage(initial='terms',language='en') {
  const events={}, panel={attrs:{},setAttribute(k,v){this.attrs[k]=v;}};
  function node(attrs={}) { return {attrs,events:{},getAttribute(k){return this.attrs[k];},setAttribute(k,v){this.attrs[k]=v;},addEventListener(k,fn){this.events[k]=fn;},classList:{toggle(){}}}; }
  const targets=[];
  const columns=['terms','privacy'].flatMap(doc=>['ru','en'].map(lang=>({...node({'data-doc':doc,'data-lang':lang}),hidden:true,querySelectorAll(){return [];},querySelector(){return {scrollIntoView(options){targets.push({doc,lang,options});}};}})));
  const tabs=['terms','privacy'].map(doc=>node({'data-tab':doc}));
  const buttons=['ru','en'].map(lang=>node({'data-lang':lang}));
  const labels={'.langtoggle':node(),'.tabs':node(),'.home':node()};
  const ctx={document:{documentElement:{},getElementById(){return panel;},querySelectorAll(selector){return selector==='.doc'?columns:selector==='.tab'?tabs:buttons;},querySelector(selector){if(labels[selector])return labels[selector];const doc=selector.match(/data-doc="([^"]+)"/)[1],lang=selector.match(/data-lang="([^"]+)"/)[1];return columns.find(c=>c.attrs['data-doc']===doc&&c.attrs['data-lang']===lang);},addEventListener(name,fn){events[name]=fn;}},history:{replaceState(_state,_title,url){ctx.url=url;}},IntersectionObserver:class{disconnect(){} observe(){}},matchMedia:()=>({matches:true})};
  ctx.window=ctx;ctx.FPi18n={lang:language,set(value){this.lang=value;}};
  const html=readFileSync(`site/driftora/${initial}.html`,'utf8');
  vm.runInNewContext([...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1],ctx);
  return {ctx,columns,tabs,buttons,events,panel,targets};
}
test('Driftora legal tabs retain the active language, URL and accessible panel label',()=>{
  const p=legalPage();p.tabs[1].events.click();
  assert.equal(p.ctx.url,'/driftora/privacy');assert.equal(p.panel.attrs['aria-labelledby'],'tab-privacy');
  assert.equal(p.columns.find(c=>!c.hidden).attrs['data-lang'],'en');
  p.buttons[0].events.click();assert.equal(p.columns.find(c=>!c.hidden).attrs['data-doc'],'privacy');assert.equal(p.columns.find(c=>!c.hidden).attrs['data-lang'],'ru');
});
test('English contents links scroll the visible document, including reduced motion',()=>{
  const p=legalPage('privacy');
  p.events.click({target:{closest:()=>({getAttribute:()=> '#privacy-s2'})},preventDefault(){}});
  assert.equal(p.targets.length,1);assert.equal(p.targets[0].lang,'en');assert.equal(p.targets[0].doc,'privacy');assert.equal(p.targets[0].options.behavior,'auto');
});
