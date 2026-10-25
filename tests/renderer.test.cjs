'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {EnduroGame}=require('../src/engine.js');const {EnduroRenderer}=require('../src/renderer.js');
function canvas(width,height){const calls=[];const gradient=()=>({addColorStop(){}});const ctx={calls,drawImage(image,...args){calls.push({image,args});},createLinearGradient:gradient,createRadialGradient:gradient};for(const k of ['beginPath','moveTo','lineTo','closePath','fill','ellipse','fillRect','stroke','setTransform','scale','fillText'])ctx[k]=()=>{};return {width,height,clientWidth:960,getContext:()=>ctx};}
function setup(){const c=canvas(1,1),r=new EnduroRenderer(c,{createCanvas:canvas}),g=new EnduroGame();g.reset();const spriteCalls=()=>c.getContext().calls.filter(x=>[...r.sprites.values()].includes(x.image));return {c,r,g,spriteCalls};}
test('4K is native 3840x2160 with high-resolution sprites; HD and auto are selectable',()=>{
 const {c,r}=setup();assert.deepEqual([c.width,c.height],[3840,2160]);assert.deepEqual([r.sprites.values().next().value.width,r.sprites.values().next().value.height],[448,672]);r.setQuality('hd');assert.deepEqual([c.width,c.height],[1920,1080]);r.setQuality('auto',1);assert.deepEqual([c.width,c.height],[960,540]);
});
test('night hides rival bodies, vision reveals them and fog limits distance',()=>{
 const {c,r,g,spriteCalls}=setup();g.dayTime=120;r.draw(g);assert.equal(spriteCalls().length,1);c.getContext().calls.length=0;g.applyCode('FAROL');r.draw(g);assert.ok(spriteCalls().length>1);
 c.getContext().calls.length=0;g.applyCode('NORMAL');g.dayTime=135;r.draw(g);const fog=spriteCalls().length;c.getContext().calls.length=0;g.applyCode('FAROL');r.draw(g);assert.ok(spriteCalls().length>fog);
});
test('scene cache stays bounded and a distant trailing ghost is not drawn on the player',()=>{
 const {r,g,c,spriteCalls}=setup();for(const time of [0,30,60,80,95,120,135]){g.dayTime=time;r.draw(g);assert.ok(r.backgrounds.size<=2);}g.cars=[];g.dayTime=30;c.getContext().calls.length=0;r.draw(g,0,false,{distance:g.distance-100,x:0});assert.equal(spriteCalls().length,1);c.getContext().calls.length=0;r.draw(g,0,false,{distance:g.distance+30,x:0});assert.equal(spriteCalls().length,2);
});
