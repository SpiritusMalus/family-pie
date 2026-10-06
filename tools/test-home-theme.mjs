import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

function theme(saved, blocked=false) {
  const classes=()=>({value:false,toggle(_name,on){this.value=on;},contains(){return this.value;}});
  const root={classList:classes(),style:{}},body={classList:classes()};
  const button={attrs:{},setAttribute(key,value){this.attrs[key]=value;},addEventListener(_event,fn){this.click=fn;}};
  const writes=[],events=[];
  const context={document:{documentElement:root,body,querySelector(){return button;}},
    localStorage:{getItem(){if(blocked)throw Error();return saved;},setItem(key,value){if(blocked)throw Error();writes.push([key,value]);}},
    Event:class{constructor(type){this.type=type;}},dispatchEvent(event){events.push(event.type);}};
  context.window=context;
  vm.runInNewContext(readFileSync('site/home-theme.js','utf8'),context);
  return {root,body,button,writes,events};
}
test('saved light appearance updates the document, body and accessible toggle',()=>{
  const {root,body,button,events}=theme('light');
  assert.equal(root.classList.value,true);assert.equal(body.classList.value,true);
  assert.equal(root.style.colorScheme,'light');assert.equal(button.attrs['aria-pressed'],'true');
  assert.equal(events.at(-1),'family-themechange');
});
test('repeated switching keeps root/body consistent and persists the selected theme',()=>{
  const {root,body,button,writes}=theme('dark');
  button.click();assert.equal(root.classList.value,true);assert.equal(body.classList.value,true);
  button.click();assert.equal(root.classList.value,false);assert.equal(body.classList.value,false);
  assert.equal(button.attrs['aria-pressed'],'false');assert.deepEqual(writes.at(-1),['family-vpn-theme-v3','dark']);
});
test('storage denial does not break theme switching',()=>{
  const {root,body,button}=theme(null,true);button.click();
  assert.equal(root.classList.value,true);assert.equal(body.classList.value,true);
});
test('adaptive portal redraws in reduced motion while the VPN renderer keeps its existing palette',()=>{
  function draw(adaptive) {
    const colors=[],listeners={};let light=true;
    const ctx=new Proxy({createRadialGradient(){return {addColorStop(_stop,color){colors.push(color);}};},createLinearGradient(){return {addColorStop(_stop,color){colors.push(color);}};}},{get(target,key){return target[key]??(()=>{});}});
    const canvas={dataset:adaptive?{portalTheme:'adaptive'}:{},getContext(){return ctx;},getBoundingClientRect(){return {width:400,height:400};},addEventListener(){}};
    const context={document:{querySelector(){return canvas;},body:{classList:{contains(){return light;}}},hidden:false,addEventListener(){}},
      matchMedia(){return {matches:true,addEventListener(){}};},performance:{now(){return 0;}},devicePixelRatio:1,
      ResizeObserver:class{constructor(fn){this.fn=fn;}observe(){this.fn();}disconnect(){}},
      IntersectionObserver:class{observe(){}disconnect(){}},cancelAnimationFrame(){},addEventListener(name,fn){listeners[name]=fn;},removeEventListener(){}};
    context.window=context;vm.runInNewContext(readFileSync('site/vpn/portal.js','utf8'),context);
    const initial=[...colors];colors.length=0;light=false;listeners['family-themechange']();
    return {initial,after:colors};
  }
  const adaptive=draw(true),vpn=draw(false);
  assert.ok(adaptive.initial.some(color=>color.startsWith('rgba(120,35,39,')));
  assert.ok(adaptive.after.some(color=>color.startsWith('rgba(255,219,205,')));
  assert.deepEqual(vpn.initial,vpn.after);
});
