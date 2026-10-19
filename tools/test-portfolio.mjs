import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

function appearance({stored=null, systemDark=false, denied=false}={}) {
  const root={light:false},body={light:false},attrs={},events={},writes=[];
  const classes=target=>({add(){},contains(){return target.light;},toggle(_key,value){target.light=value;}});
  const media={matches:systemDark,addEventListener(_name,fn){events.system=fn;}};
  const button={setAttribute(key,value){attrs[key]=value;},addEventListener(_name,fn){events.click=fn;}};
  const context={matchMedia:()=>media,Event:class{},localStorage:{getItem(){if(denied)throw Error('blocked');return stored;},setItem(key,value){if(denied)throw Error('blocked');stored=value;writes.push([key,value]);}},document:{documentElement:{classList:classes(root),style:{}},body:{classList:classes(body)},querySelector:()=>button,addEventListener(name,fn){events[name]=fn;}},addEventListener(name,fn){events[name]=fn;},dispatchEvent(){}};
  context.window=context;
  vm.runInNewContext(readFileSync('site/portfolio-theme.js','utf8'),context);
  events.DOMContentLoaded();
  return {root,body,attrs,events,writes,media,setStored:value=>{stored=value;}};
}
test('portfolio uses saved appearance and updates its accessible control',()=>{
  const a=appearance({stored:'dark'});
  assert.equal(a.root.light,false);assert.equal(a.body.light,false);assert.equal(a.attrs['aria-pressed'],'false');
  a.events.click();assert.equal(a.root.light,true);assert.equal(a.body.light,true);
  assert.deepEqual(a.writes.at(-1),['family-vpn-theme-v3','light']);
});
test('invalid stored values use system appearance and follow system changes',()=>{
  const a=appearance({stored:'corrupted'});assert.equal(a.root.light,true);
  a.media.matches=true;a.events.system();assert.equal(a.root.light,false);
  a.events.click();a.media.matches=true;a.events.system();assert.equal(a.root.light,true);
});
test('a cached page applies the newer appearance selected on another route',()=>{
  const a=appearance({stored:'light'});
  a.setStored('dark');a.events.pageshow();
  assert.equal(a.root.light,false);assert.equal(a.body.light,false);assert.equal(a.attrs['aria-pressed'],'false');
});
test('denied storage still allows repeated switches and cached-page return',()=>{
  const a=appearance({denied:true});a.events.click();a.events.pageshow();assert.equal(a.root.light,false);
  a.events.click();assert.equal(a.root.light,true);assert.equal(a.attrs['aria-pressed'],'true');
});

function inlineScreens({lang='en',count=1}={}) {
  const events={},captures=[],timers=new Map(),writes=[];
  let timerId=0;
  const pairs=Array.from({length:count},(_,i)=>{
    const status={textContent:''};
    const image={src:`/screen-${i}-en.png`,complete:true,naturalWidth:1080,dataset:{screenRuSrc:`/screen-${i}-ru.png`,screenEnSrc:`/screen-${i}-en.png`},getAttribute(key){return this[key];}};
    const figure={dataset:{screenLang:'en'},setAttribute(){},removeAttribute(){},querySelector:key=>key==='[data-screen-ru-src][data-screen-en-src]'?image:key==='[data-screen-status]'?status:null};
    return {image,figure,status};
  });
  const context={document:{querySelectorAll:()=>pairs.map(p=>p.figure)},window:{FPi18n:{lang},addEventListener:(event,fn)=>events[event]=fn},sessionStorage:{getItem:()=> 'en',setItem:(...args)=>writes.push(args)},Image:class{constructor(){captures.push(this);this.naturalWidth=1080;this.naturalHeight=2400;}},setTimeout:fn=>{timers.set(++timerId,fn);return timerId;},clearTimeout:id=>timers.delete(id)};
  vm.runInNewContext(readFileSync('site/portfolio-screens.js','utf8'),context);
  const choose=lang=>{context.window.FPi18n.lang=lang;events['fp-languagechange']();};
  return {pairs,captures,timers,writes,events,context,choose,...pairs[0]};
}

test('one page language changes every screenshot and ignores obsolete image preferences',()=>{
  const a=inlineScreens({lang:'ru',count:2});
  assert.equal(a.captures.length,2);
  a.captures.forEach(c=>c.onload());
  a.pairs.forEach((p,i)=>{assert.equal(p.image.src,`/screen-${i}-ru.png`);assert.equal(p.figure.dataset.screenLang,'ru');});
  a.choose('en');a.captures.slice(2).forEach(c=>c.onload());
  a.pairs.forEach((p,i)=>assert.equal(p.image.src,`/screen-${i}-en.png`));
  assert.equal(a.writes.length,0);
  a.context.window.FPi18n.lang='ru';a.events.pageshow();
  a.captures.slice(4).forEach(c=>c.onload());
  a.pairs.forEach(p=>assert.equal(p.figure.dataset.screenLang,'ru'));
});

test('failed image loads keep the last image and retry through the same page language choice',()=>{
  const a=inlineScreens();
  a.choose('ru');a.captures[0].onload();
  a.choose('en');a.captures[1].onerror();
  assert.equal(a.image.src,'/screen-0-ru.png');
  assert.match(a.status.textContent,/Couldn’t load.*RU or EN/);
  a.choose('en');a.captures[2].onload();
  assert.equal(a.image.src,'/screen-0-en.png');
  assert.equal(a.status.textContent,'');
});

test('late screenshot loads cannot override a newer global language choice',()=>{
  const a=inlineScreens();
  a.choose('ru');a.choose('en');a.captures[0].onload();
  assert.equal(a.image.src,'/screen-0-en.png');
  assert.equal(a.figure.dataset.screenLang,'en');
});

test('timed-out screenshot requests cannot replace a retried capture',()=>{
  const a=inlineScreens();
  a.choose('ru');[...a.timers.values()][0]();
  assert.match(a.status.textContent,/Не удалось/);
  assert.equal(a.image.src,'/screen-0-en.png');
  a.choose('ru');a.captures[1].onload();a.captures[0].onload();
  assert.equal(a.image.src,'/screen-0-ru.png');
  assert.equal(a.status.textContent,'');
});

test('all portfolio routes have only the common page-language buttons',()=>{
  for(const path of ['site/index.html','site/preview/showcase/index.html','site/work/driftora/index.html','site/work/lumen-rest/index.html']) {
    const html=readFileSync(path,'utf8');
    assert.doesNotMatch(html,/screen-language|data-screen-language/);
    assert.equal((html.match(/data-fp-lang="/g)||[]).length,2,path);
    assert.match(html,/data-screen-ru-src=/);assert.match(html,/data-screen-en-src=/);
    assert.doesNotMatch(html,/data-screen-link|href="\/screenshots\//);
  }
});

test('reference-led homepage exposes project access before the optional author story',()=>{
  for(const path of ['site/index.html','site/preview/showcase/index.html']) {
    const html=readFileSync(path,'utf8'),main=html.match(/<main[\s\S]*?<\/main>/)[0];
    assert.ok(main.indexOf('href="#work"')<main.indexOf('data-maker'),path);
    assert.match(main,/<details class="maker-story" data-maker open>/);
    assert.equal((main.match(/class="showcase-project"/g)||[]).length,2);
    for(const card of main.matchAll(/<article class="showcase-project">[\s\S]*?<\/article>/g)) {
      assert.ok(card[0].indexOf('<h3>')<card[0].indexOf('<figure'),path);
      assert.doesNotMatch(card[0],/data-screen-link|href="\/screenshots\//);
    }
    assert.match(main,/href="\/work\/driftora\/"/);
    assert.match(main,/href="\/work\/lumen-rest\/"/);
  }
});

test('author story starts collapsed only on mobile and language changes preserve the user choice',()=>{
  for(const mobile of [false,true]) {
    const maker={open:true},events={};
    const context={document:{querySelector:()=>maker,querySelectorAll:()=>[]},matchMedia:()=>({matches:mobile}),window:{FPi18n:{lang:'en'},addEventListener:(name,fn)=>events[name]=fn}};
    vm.runInNewContext(readFileSync('site/portfolio.js','utf8'),context);
    assert.equal(maker.open,!mobile);
    maker.open=!maker.open;
    context.window.FPi18n.lang='ru';events['fp-languagechange']();
    assert.equal(maker.open,mobile);
  }
});
