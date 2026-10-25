'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const script=name=>fs.readFileSync(path.join(__dirname,'../src/'+name+'.js'),'utf8');
const scope={};vm.createContext(scope);vm.runInContext(script('engine'),scope);
const {EnduroGame,DAY_SECONDS,MAX_SPEED,curveAt}=scope.Enduro;
const tick=(g,seconds,input={})=>{for(let i=0;i<Math.round(seconds*60);i++)g.step(1/60,input);};
function empty(){const g=new EnduroGame();g.reset();g.start();g.cars=[];g.ensureTraffic=()=>{};return g;}
function car(g,extra={}){const c={id:1,rel:20,x:0,baseX:0,speedOffset:0,color:0,counted:false,passDay:0,phase:0,...extra};g.cars.push(c);return c;}

test('waits for acceleration to start; direction alone does not consume the day',()=>{
 const g=new EnduroGame();assert.equal(g.mode,'title');g.reset();tick(g,2,{steer:1});
 assert.equal(g.dayTime,0);assert.equal(g.distance,0);assert.equal(g.mode,'ready');
 tick(g,1,{accelerate:true});assert.equal(g.mode,'playing');assert.ok(g.speed>0);assert.ok(g.distance>0);
});
test('accelerator reaches the speed limit, release coasts and braking takes precedence',()=>{
 const g=empty();g.x=.2;tick(g,5,{accelerate:true});assert.equal(g.speed,MAX_SPEED);
 g.distance=0;g.x=0;const speed=g.speed;tick(g,.3);assert.equal(g.speed,speed);
 tick(g,.5,{accelerate:true,brake:true});assert.ok(g.speed<speed);
 tick(g,3,{brake:true});assert.equal(g.speed,0);
});
test('day duration is independent of speed and distance',()=>{
 const slow=empty(),fast=empty();fast.speed=MAX_SPEED;
 tick(slow,5);tick(fast,5,{accelerate:true});assert.equal(slow.dayTime,fast.dayTime);assert.ok(fast.distance>slow.distance);
});
test('car collision slows more than roadside contact and has a cooldown',()=>{
 const road=empty();road.speed=100;road.x=1.1;road.step(1/60);assert.ok(road.speed<100&&road.speed>95);
 const hit=empty();hit.speed=100;car(hit,{rel:5});hit.step(1/60);
 assert.equal(hit.collisions,1);assert.ok(hit.speed<30);assert.ok(hit.speed<road.speed);
 const after=hit.speed;hit.collide(hit.cars[0]);assert.equal(hit.speed,after);assert.equal(hit.collisions,1);
});
test('near misses pass cleanly and each car is counted once',()=>{
 const g=empty();g.speed=100;const c=car(g,{rel:0,x:.66,baseX:.66});tick(g,.3);
 assert.equal(g.collisions,0);assert.equal(g.passed,1);assert.equal(g.remaining,199);
 g.overtake(c);assert.equal(g.passed,1);tick(g,.2);assert.equal(g.passed,1);
});
test('a rival overtaking the player restores the outstanding quota before qualification',()=>{
 const g=empty(),c=car(g,{rel:-10.1,x:.66,baseX:.66});g.overtake(c);assert.equal(g.remaining,199);
 g.step(1/60);assert.equal(g.remaining,200);assert.equal(c.counted,false);assert.equal(g.totalPassed,0);
});
test('200 passes unlock flags, which persist until daybreak even if a rival repasses',()=>{
 const g=empty();let last;
 for(let i=0;i<200;i++){last={counted:false};g.overtake(last);}
 assert.equal(g.qualified,true);assert.equal(g.remaining,0);assert.equal(g.day,1);
 g.losePass(last);assert.equal(g.remaining,0);assert.equal(g.qualified,true);
 g.dayTime=DAY_SECONDS-1/120;g.step(1/60);
 assert.equal(g.day,2);assert.equal(g.completedDays,1);assert.equal(g.required,300);assert.equal(g.remaining,300);assert.equal(g.mode,'playing');
});
test('missing the quota ends the race at dawn without resetting distance',()=>{
 const g=empty();g.passed=199;g.kilometers=6.5;g.dayTime=DAY_SECONDS-1/120;g.step(1/60);
 assert.equal(g.mode,'gameover');assert.equal(g.day,1);assert.equal(g.completedDays,0);assert.equal(g.kilometers,6.5);
 const time=g.dayTime;tick(g,2,{accelerate:true});assert.equal(g.dayTime,time);
});
test('later days require 300 passes and five completed days award the trophy',()=>{
 const g=empty();
 for(let day=1;day<=5;day++){
  for(let n=0;n<(day===1?200:300);n++)g.overtake({counted:false});
  g.dayTime=DAY_SECONDS;g.finishDay();assert.equal(g.trophy,day>=5);
 }
 assert.equal(g.day,6);assert.equal(g.completedDays,5);assert.equal(g.required,300);
 assert.ok(g.trafficSpeed>46);assert.equal(g.takeEvents().filter(e=>e.type==='trophy').length,1);
});
test('ice responds more slowly, fog reduces visibility and night is a separate phase',()=>{
 const dry=empty(),ice=empty();dry.speed=ice.speed=80;dry.dayTime=DAY_SECONDS*.2;ice.dayTime=DAY_SECONDS*.4;
 tick(dry,.25,{steer:1});tick(ice,.25,{steer:1});assert.ok(ice.x<dry.x*.6);
 const g=empty();g.dayTime=DAY_SECONDS*.9;assert.equal(g.phase.key,'fog');assert.ok(g.visibility<100+1);
 g.dayTime=DAY_SECONDS*.8;assert.equal(g.phase.key,'night');assert.equal(g.visibility,340);
});
test('pause freezes the race clock, position, rivals and crash timer',()=>{
 const g=empty();g.speed=100;car(g);g.crashTimer=.5;g.pause();const before=[g.dayTime,g.distance,g.x,g.cars[0].rel,g.crashTimer];
 tick(g,2,{accelerate:true,steer:1});assert.deepEqual([g.dayTime,g.distance,g.x,g.cars[0].rel,g.crashTimer],before);
 g.resume();g.step(1/60);assert.ok(g.distance>0);
 g.reset();g.pause();g.resume();assert.equal(g.mode,'ready');
});
test('traffic generation is deterministic and bounded throughout a complete five-day race',()=>{
 const g=new EnduroGame(),copy=new EnduroGame();assert.deepEqual(g.cars,copy.cars);g.reset();g.start();
 for(let i=0;i<60*DAY_SECONDS*5+1;i++){
  // Cruise the gap between lanes while compensating for curves. No state teleporting.
  const steer=Math.max(-1,Math.min(1,(.33-g.x)*7+curveAt(g.distance)*.44/2.45*(g.speed/MAX_SPEED)**2));
  g.step(1/60,{accelerate:true,steer});g.takeEvents();
  assert.ok(g.cars.length<70);assert.ok(Number.isFinite(g.x));assert.ok(g.speed>=0&&g.speed<=MAX_SPEED);
 }
 assert.equal(g.mode,'playing');assert.equal(g.completedDays,5);assert.equal(g.trophy,true);assert.ok(g.kilometers>50);
});
test('invalid time steps cannot corrupt state and reset restores a clean first day',()=>{
 const g=empty();tick(g,1,{accelerate:true});const before=g.distance;
 for(const dt of [NaN,Infinity,-1,0])g.step(dt,{accelerate:true});assert.equal(g.distance,before);
 g.reset();assert.equal(g.day,1);assert.equal(g.passed,0);assert.equal(g.distance,0);assert.equal(g.trophy,false);assert.equal(g.speed,0);
});
