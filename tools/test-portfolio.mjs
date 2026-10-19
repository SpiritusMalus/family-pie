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

function inlineScreens() {
  const events={},captures=[],stored=new Map(),status={textContent:''};
  const image={src:'/work/assets/screen-en.png',complete:true,naturalWidth:1080,dataset:{screenRuSrc:'/work/assets/screen-ru.png',screenEnSrc:'/work/assets/screen-en.png'},getAttribute(key){return this[key];}};
  const buttons=['ru','en'].map(lang=>({dataset:{screenLanguage:lang},setAttribute(key,value){this[key]=value;},addEventListener(_event,fn){this.click=fn;}}));
  const figure={dataset:{screenLang:'en'},setAttribute(){},removeAttribute(){},querySelector:key=>key==='[data-screen-ru-src][data-screen-en-src]'||key==='[data-screen-ru-src]'?image:key==='[data-screen-status]'?status:null,querySelectorAll:()=>buttons};
  const context={document:{querySelectorAll:()=>[figure]},window:{FPi18n:{lang:'en'},addEventListener:(event,fn)=>events[event]=fn},sessionStorage:{getItem:key=>stored.get(key),setItem:(key,value)=>stored.set(key,value)},Image:class{constructor(){captures.push(this);this.naturalWidth=1080;this.naturalHeight=2400;}},setTimeout:()=>1,clearTimeout(){}};
  vm.runInNewContext(readFileSync('site/portfolio-screens.js','utf8'),context);
  return {image,buttons,figure,captures,status,stored,context,events};
}

test('inline screenshot selection works without enlargement links and retains the loaded image on failure',()=>{
  const a=inlineScreens();
  assert.equal(a.buttons[1]['aria-pressed'],'true');
  a.buttons[0].click();a.captures[0].onload();
  assert.equal(a.image.src,'/work/assets/screen-ru.png');
  assert.equal(a.buttons[0]['aria-pressed'],'true');
  assert.equal(a.stored.get('fp_screen_lang:/work/assets/screen-ru.png'),'ru');
  a.buttons[1].click();a.captures[1].onerror();
  assert.equal(a.image.src,'/work/assets/screen-ru.png');
  assert.equal(a.figure.dataset.screenLang,'ru');
  assert.match(a.status.textContent,/Couldn’t load/);
  a.buttons[1].click();a.captures[2].onload();
  assert.equal(a.image.src,'/work/assets/screen-en.png');
  assert.equal(a.status.textContent,'');
});

test('late screenshot loads cannot replace the latest inline language choice',()=>{
  const a=inlineScreens();
  a.buttons[0].click();
  a.buttons[1].click();
  a.captures[0].onload();
  assert.equal(a.image.src,'/work/assets/screen-en.png');
  assert.equal(a.buttons[1]['aria-pressed'],'true');
});
