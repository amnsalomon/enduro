'use strict';
const {chromium,firefox,webkit}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const {startServer}=require('./server.cjs');
fs.mkdirSync('test-results',{recursive:true});
const names=(process.env.BROWSERS||'chromium,firefox,webkit').split(',');
const timeout=15000;
async function instrument(context){await context.addInitScript(()=>{
 let engine,render,peerClass;
 Object.defineProperty(window,'Enduro',{configurable:true,get:()=>engine,set:v=>{engine=v;const Base=v.EnduroGame;v.EnduroGame=class extends Base{constructor(...a){super(...a);window.__game=this;}};}});
 Object.defineProperty(window,'EnduroPeer',{configurable:true,get:()=>peerClass,set:Base=>{peerClass=class extends Base{constructor(...a){super(...a);window.__peer=this;}};}});
 Object.defineProperty(window,'EnduroRenderer',{configurable:true,get:()=>render,set:Base=>{render=class extends Base{constructor(...a){super(...a);window.__renderer=this;}};}});
});}
async function ready(page,url){const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await page.bringToFront();await page.waitForFunction(()=>window.__game&&window.__renderer);return errors;}
async function cedilla(page){if(process.env.BROWSERS==='chromium'){const cdp=await page.context().newCDPSession(page);await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key:'ç',code:'Semicolon',text:'ç',windowsVirtualKeyCode:186});await cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key:'ç',code:'Semicolon',windowsVirtualKeyCode:186});await cdp.detach();}else await page.evaluate(()=>document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'ç',code:'Semicolon',bubbles:true})));}
async function powered(page,codes){await cedilla(page);await page.locator('#codesDialog').waitFor({state:'visible'});await page.locator('#codeInput').fill(codes);await page.locator('#codeForm button[type=submit]').click();}
async function closeCodes(page){await page.locator('#codesDialog .wide').click();await page.waitForFunction(()=>!document.querySelector('#codesDialog').open);}
async function pair(a,b,purpose){
 for(const p of [a,b]){const open=await p.locator('#peerDialog').isVisible();if(!open)await p.locator('#connect').click();}
 await a.locator('#peerPurpose').selectOption(purpose);await a.locator('#createOffer').click();
 await a.waitForFunction(()=>document.querySelector('#localSignal').value.startsWith('ENDURO1.'),{},{timeout:20000});
 await b.locator('#remoteSignal').fill(await a.locator('#localSignal').inputValue());await b.locator('#acceptSignal').click();
 await b.waitForFunction(()=>document.querySelector('#localSignal').value.startsWith('ENDURO1.'),{},{timeout:20000});
 await a.locator('#remoteSignal').fill(await b.locator('#localSignal').inputValue());await a.locator('#acceptSignal').click();
 try{for(const p of [a,b])await p.waitForFunction(()=>!document.querySelector('#connectedActions').hidden,{},{timeout:20000});}catch(e){for(const p of [a,b])console.log('RTC diagnostic',await p.evaluate(()=>({status:document.querySelector('#peerStatus').textContent,connection:window.__peer.pc?.connectionState,ice:window.__peer.pc?.iceConnectionState,channel:window.__peer.channel?.readyState,localCandidates:(window.__peer.pc?.localDescription?.sdp||'').split('\r\n').filter(l=>l.startsWith('a=candidate')).map(l=>({mdns:l.includes('.local'),type:l.match(/typ (\w+)/)?.[1]})),remoteCandidates:(window.__peer.pc?.remoteDescription?.sdp||'').split('a=candidate').length-1})));throw e;}
}
(async()=>{
 const {server,url}=await startServer();let failures=0;
 for(const name of names){
  let browser,page;
  try{
   const launch={headless:true};if(name==='chromium'&&process.env.CHROMIUM_EXECUTABLE_PATH){launch.executablePath=process.env.CHROMIUM_EXECUTABLE_PATH;launch.args=JSON.parse(process.env.CHROMIUM_ARGS||'[]');}
   browser=await ({chromium,firefox,webkit})[name].launch(launch);
   if(!process.env.RTC_ONLY){const context=await browser.newContext({viewport:{width:1440,height:1000}});await instrument(context);page=await context.newPage();const errors=await ready(page,url);
   assert.deepEqual(await page.locator('#screen').evaluate(c=>[c.width,c.height]),[3840,2160]);
   await page.screenshot({path:'test-results/'+name+'-desktop.png',fullPage:true});
   await page.locator('#continue').click();await page.waitForFunction(()=>document.activeElement.id==='screen');
   await page.keyboard.down('Space');await page.waitForFunction(()=>window.__game.speed>8);await page.keyboard.up('Space');
   await powered(page,'DETONA NITRO ESCUDO TRILHO FAROL TEMPO');
   assert.equal(await page.evaluate(()=>window.__game.powers.size),6);assert.equal(await page.evaluate(()=>window.__game.mode),'paused');
   const stopped=await page.evaluate(()=>[window.__game.dayTime,window.__game.distance]);await page.waitForTimeout(200);assert.deepEqual(await page.evaluate(()=>[window.__game.dayTime,window.__game.distance]),stopped);
   await page.screenshot({path:'test-results/'+name+'-codes.png',fullPage:true});await closeCodes(page);await page.waitForFunction(()=>window.__game.mode==='playing');
   const frozen=await page.evaluate(()=>window.__game.dayTime);await page.keyboard.down('Space');await page.waitForFunction(()=>window.__game.speed>125,{},{timeout});await page.keyboard.up('Space');assert.equal(await page.evaluate(()=>window.__game.dayTime),frozen);
   await page.locator('#sound').click();await page.waitForFunction(()=>document.activeElement.id==='screen');const speed=await page.evaluate(()=>window.__game.speed);await page.keyboard.down('Space');await page.waitForFunction(s=>window.__game.speed>s,speed);await page.keyboard.up('Space');
   await page.keyboard.press('p');await page.waitForFunction(()=>window.__game.mode==='paused');await page.waitForTimeout(100);const draw=await page.evaluate(()=>window.__renderer.drawCount);await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>window.__renderer.drawCount),draw);
   const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('enduro-save-v2')).run);await page.reload();await page.waitForFunction(()=>window.__game?.mode==='paused');assert.equal(await page.evaluate(()=>window.__game.distance),saved.state.distance);assert.equal(await page.evaluate(()=>window.__game.powers.size),6);
   await page.locator('#codes').click();await page.locator('#codeInput').fill('NORMAL');await page.locator('#codeForm button[type=submit]').click();await closeCodes(page);assert.equal(await page.evaluate(()=>window.__game.mode),'paused');assert.equal(await page.evaluate(()=>window.__game.assisted),true);
   await page.locator('#quality').selectOption('hd');assert.deepEqual(await page.locator('#screen').evaluate(c=>[c.width,c.height]),[1920,1080]);
   await page.locator('#ranking').click();await page.locator('#nickname').fill('Piloto teste');await page.locator('#nickname').press('Tab');await page.locator('#powersTab').click();assert.ok((await page.locator('#leaderboard').innerText()).includes('Piloto teste'));
   const download=page.waitForEvent('download');await page.locator('#exportSave').click();const file=await download;const backup=JSON.parse(fs.readFileSync(await file.path(),'utf8'));assert.equal(backup.version,2);assert.equal(backup.run.state.assisted,true);await page.locator('#rankingDialog .close').click();
   assert.deepEqual(errors,[]);await context.close();
   // Native touch on a compact phone; two fingers steer and accelerate together.
   const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:name!=='firefox',hasTouch:true,deviceScaleFactor:2});await instrument(mobile);const phone=await mobile.newPage();const mobileErrors=await ready(phone,url);
   await phone.locator('#quality').selectOption('hd');assert.equal(await phone.locator('.touch-controls').isVisible(),true);assert.ok(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await phone.locator('#continue').tap();
   if(name==='chromium'){
    const cdp=await mobile.newCDPSession(phone),gas=await phone.locator('[data-control=accelerate]').boundingBox(),left=await phone.locator('[data-control=left]').boundingBox();
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:gas.x+gas.width/2,y:gas.y+gas.height/2,id:1},{x:left.x+left.width/2,y:left.y+left.height/2,id:2}]});
    await phone.waitForFunction(()=>window.__game.speed>3&&window.__game.x<0);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   }else await phone.locator('[data-control=accelerate]').tap();
   await phone.locator('#codes').tap();await phone.locator('#codeInput').fill('NITRO ESCUDO');await phone.locator('#codeForm button[type=submit]').tap();assert.equal(await phone.evaluate(()=>window.__game.powers.size),2);
   await phone.screenshot({path:'test-results/'+name+'-mobile-codes.png',fullPage:true});await phone.locator('#codesDialog .wide').tap();await phone.screenshot({path:'test-results/'+name+'-mobile.png',fullPage:true});
   await phone.setViewportSize({width:844,height:390});await phone.waitForFunction(()=>innerWidth===844&&innerHeight===390);assert.ok(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.equal(await phone.locator('[data-control=accelerate]').isVisible(),true);await phone.screenshot({path:'test-results/'+name+'-landscape.png',fullPage:true});assert.deepEqual(mobileErrors,[]);
   // Optional APIs may fail without stopping the animation loop or controls.
   console.log('PASS',name,'desktop powers, save, focus and mobile input');await mobile.close();const limited=await browser.newContext();await instrument(limited);await limited.addInitScript(()=>{Storage.prototype.getItem=Storage.prototype.setItem=function(){throw Error('blocked');};navigator.getGamepads=()=>{throw Error('blocked');};window.AudioContext=class{constructor(){throw Error('blocked');}};});const blocked=await limited.newPage();page=blocked;const blockedErrors=await ready(blocked,url);await blocked.locator('#continue').click();await blocked.waitForFunction(()=>document.activeElement.id==='screen');await blocked.keyboard.down('Space');await blocked.waitForFunction(()=>window.__game.speed>4);await blocked.keyboard.up('Space');assert.deepEqual(blockedErrors,[]);await limited.close();
   }
   if(name==='chromium'&&!process.env.SKIP_RTC){
    // Exercise real RTC data channels through the visible manual-pairing flow.
    const ca=await browser.newContext(),cb=await browser.newContext();await instrument(ca);await instrument(cb);const a=await ca.newPage(),b=await cb.newPage();const ea=await ready(a,url),eb=await ready(b,url);for(const p of [a,b])await p.locator('#quality').selectOption('hd');
    console.log('Testing real RTC pairing');await pair(a,b,'duel');console.log('RTC connected');await a.locator('#readyDuel').click();await b.locator('#readyDuel').click();
    for(const p of [a,b])await p.waitForFunction(()=>window.__game.mode==='playing',{},{timeout:20000});
    await cedilla(a);await b.waitForFunction(()=>window.__game.mode==='paused');await closeCodes(a);await b.waitForFunction(()=>window.__game.mode==='playing');
    await a.locator('#connect').click();await a.locator('#disconnect').click();await a.locator('#peerDialog .close').click();await b.locator('#connect').click();await b.locator('#peerDialog .close').click();
    console.log('Testing device transfer');await pair(a,b,'sync');const originalId=await b.evaluate(()=>JSON.parse(localStorage.getItem('enduro-save-v2')).profile.id);await a.locator('#sendProgress').click();await b.locator('#transferDialog').waitFor({state:'visible'});assert.equal(await b.evaluate(()=>JSON.parse(localStorage.getItem('enduro-save-v2')).profile.id),originalId);await b.locator('#acceptTransfer').click();
    assert.equal(await b.evaluate(()=>JSON.parse(localStorage.getItem('enduro-save-v2')).profile.id),await a.evaluate(()=>JSON.parse(localStorage.getItem('enduro-save-v2')).profile.id));assert.equal(await b.evaluate(()=>window.__game.mode),'paused');assert.deepEqual(ea,[]);assert.deepEqual(eb,[]);
   }
   console.log('PASS',name,'desktop, powers, saves, pause, keyboard, touch, responsive layout, optional APIs'+(name==='chromium'&&!process.env.SKIP_RTC?', RTC duel and device transfer':''));
  }catch(e){failures++;console.error('FAIL',name,e);try{await page?.screenshot({path:'test-results/'+name+'-failure.png',fullPage:true});}catch{}}
  finally{await browser?.close();}
 }
 await new Promise(r=>server.close(r));if(failures)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
