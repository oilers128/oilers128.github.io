const {JSDOM,VirtualConsole}=require('jsdom');
const fs=require('fs'),assert=require('node:assert/strict');
let html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const errors=[],calls=[],intervals=[];let spinFinish,now=Date.now(),failJoin=false,failStock=false,buyFinish;
const players=[],owned=[],stock=[{id:1,name:'Purple Horned Creature',price:18,stock:3},{id:9,name:'Grinning Purple Bunny',price:12,stock:1}];
const clone=x=>JSON.parse(JSON.stringify(x));
const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
const dom=new JSDOM(html,{url:'https://example.test/',runScripts:'dangerously',virtualConsole:vc,beforeParse(w){
 w.AbortSignal=AbortSignal;w.Date.now=()=>now;w.setInterval=(fn,ms)=>{intervals.push({fn,ms});return intervals.length};
 const timeout=w.setTimeout.bind(w);w.setTimeout=(fn,ms)=>ms===4100?(spinFinish=fn,1):timeout(fn,ms);
 w.fetch=async(url,opts)=>{
 const path=url.split('/rest/v1')[1];calls.push({path,body:opts.body});let data;
 if(path.startsWith('/plush_products')){if(failStock)throw Error('offline');data=stock}
 else if(path.startsWith('/plush_orders'))data=[];
 else if(path.startsWith('/plush_players'))data=players;
 else if(path.startsWith('/plush_collections'))data=owned;
 else {const b=JSON.parse(opts.body);if(path==='/rpc/plush_join'){
 if(failJoin)throw Error('Join unavailable');let p=players.find(x=>x.name===b.p_name);if(!p){p={name:b.p_name,avatar:b.p_avatar,coins:0,last_spin:null};players.push(p)}p.avatar=b.p_avatar;data=p;
 }else if(path==='/rpc/plush_spin'){const p=players.find(x=>x.name===b.p_name);p.coins+=50;p.last_spin=new Date(now).toISOString();data={coins:p.coins,prize:50,cooldown_seconds:60}}
 else if(path==='/rpc/plush_buy'){await new Promise(r=>buyFinish=r);const p=players.find(x=>x.name===b.p_name);let total=0;for(const item of b.p_items){const product=stock.find(x=>x.id===item.id);total+=product.price*item.qty;product.stock-=item.qty;owned.push({owner:p.name,product_id:item.id,quantity:item.qty})}p.coins-=total;data={number:1,total,coins:p.coins}}
 else throw Error('Unexpected API '+path)}
 return {ok:true,status:200,json:async()=>clone(data)};
 };
}});
const w=dom.window,d=w.document,$=s=>d.querySelector(s);
const flush=()=>new Promise(r=>setImmediate(r));
const click=s=>{assert.ok($(s),'missing '+s);$(s).click()};
const submit=()=>$('#account-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
(async()=>{
 await flush();assert.equal(errors.length,0,errors.join('\n'));assert.equal(d.querySelectorAll('html').length,1);const visible=d.body.cloneNode(true);visible.querySelectorAll('script').forEach(x=>x.remove());assert.ok(!visible.textContent.includes('function accountModal'));
 assert.equal($('#account-form').getAttribute('role'),'dialog');assert.equal($('#account-form').getAttribute('aria-modal'),'true');assert.equal(d.activeElement.id,'user-name');assert.ok($('#view').inert);
 $('#user-name').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true,cancelable:true}));assert.ok(d.activeElement.hasAttribute('data-account-close'),'reverse Tab escaped dialog');
 d.activeElement.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));assert.equal(d.activeElement.id,'user-name');
 d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));await flush();assert.equal($('#account-form'),null);assert.ok(!$('#view').inert);click('[data-account]');await flush();
 assert.equal(d.querySelectorAll('[data-avatar]').length,10);$('#user-name').value='Tester';[...d.querySelectorAll('[data-avatar]')].find(x=>x.dataset.avatar==='🐸').click();submit();await flush();
 assert.equal($('#account-label').textContent,'Tester');assert.equal($('#coin-balance').textContent,'🪙 $0');assert.equal($('#account-form'),null);assert.ok([...d.querySelectorAll('.admin-tab')].every(x=>x.hidden));
 click('[data-tab="wheel"]');assert.equal(d.querySelectorAll('.wheel-label').length,8);click('[data-spin]');await flush();const wheel=$('#wheel-visual');assert.ok($('#spin-button').disabled);
 await intervals.find(x=>x.ms===12000).fn();assert.equal($('#wheel-visual'),wheel,'poll recreated spinning wheel');
 const rotation=Number(wheel.style.transform.match(/rotate\((.*)deg/)[1]);assert.equal((rotation+337.5)%360,0,'prize does not align to pointer');
 click('[data-tab="players"]');spinFinish();await flush();await flush();assert.ok($('.player-grid'),'spin navigated away');
 click('[data-tab="wheel"]');assert.match($('#wheel-result').textContent,/won \$50/);now+=61000;intervals.find(x=>x.ms===250).fn();assert.ok(!$('#spin-button').disabled,'cooldown stuck');
 click('[data-tab="shop"]');$('#search').focus();$('#search').value='Purple';$('#search').dispatchEvent(new w.Event('input',{bubbles:true}));await intervals.find(x=>x.ms===12000).fn();assert.equal(d.activeElement.id,'search');assert.equal($('#search').value,'Purple');
 click('[data-add="1"]');click('[data-checkout]');click('[data-complete]');$('#modal [data-complete]').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));await flush();assert.equal(calls.filter(x=>x.path==='/rpc/plush_buy').length,1,'duplicate purchase');buyFinish();await flush();await flush();assert.match($('#modal').textContent,/added to your collection/);assert.equal($('#coin-balance').textContent,'🪙 $32');click('[data-close]');click('[data-tab="collection"]');assert.match($('#view').textContent,/Owned: 1/);
 click('[data-tab="players"]');click('[data-player="Tester"]');await intervals.find(x=>x.ms===13000).fn();assert.match($('#selected-player').textContent,/Owned: 1/,'selected collection lost');
 click('[data-account]');[...d.querySelectorAll('[data-avatar]')].find(x=>x.dataset.avatar==='🐰').click();submit();await flush();assert.equal(players[0].avatar,'🐰');
 click('[data-account]');$('#user-name').value='Other';failJoin=true;submit();await flush();assert.equal($('#account-label').textContent,'Tester');assert.match($('#account-error').textContent,/unavailable/);failJoin=false;click('[data-account-close]');
 click('[data-account]');click('[data-signout]');assert.equal($('#account-label').textContent,'Sign in');assert.equal($('#coin-balance').textContent,'🪙 $0');assert.match($('#cart').textContent,/lonely/);
 click('[data-add="1"]');assert.ok(!$('#mobile-cart').hidden);assert.match($('#mobile-cart').textContent,/1 item/);assert.equal($('#coin-balance').closest('header')?.tagName,'HEADER');
 click('[data-checkout]');await flush();$('#user-name').value='Nora';submit();await flush();assert.match($('#cart').textContent,/Purple Horned Creature/,'guest cart lost at sign-in');assert.ok($('#modal [data-complete]'),'checkout did not resume');assert.ok($('#modal [data-complete]').disabled);assert.ok($('#modal [data-earn]'));assert.equal($('#modal .modal').getAttribute('role'),'dialog');
 click('[data-earn]');await flush();assert.ok($('#spin-button'));assert.equal($('#modal').textContent,'');assert.ok(!$('#view').inert);assert.ok($('#mobile-cart').hidden);assert.equal($('[data-tab="wheel"]').getAttribute('aria-current'),'page');
 assert.ok([...d.querySelectorAll('.admin-tab')].every(x=>!x.hidden));click('[data-tab="inventory"]');assert.equal($('#taxrate'),null);
 failStock=true;click('[data-tab="shop"]');await intervals.find(x=>x.ms===12000).fn();assert.match($('#shared-status').textContent,/Offline/);assert.ok([...d.querySelectorAll('[data-add]')].every(x=>x.disabled));
 assert.equal(errors.length,0,errors.join('\n'));console.log('PASS: signup, 10 avatars, zero coins, admin visibility, wheel alignment, countdown, navigation, polling, search focus, one purchase, balance/collection sync, player selection, profile save/failure, signout, offline guard.');dom.window.close();
})().catch(e=>{console.error(e);dom.window.close();process.exitCode=1});
