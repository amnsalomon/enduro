'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {EnduroGame,MAX_SPEED,DAY_SECONDS,POWER_IDS,curveAt}=require('../src/engine.js');
const {EnduroStore,validateBundle}=require('../src/storage.js');
const Audio=require('../src/audio.js');
const {token,decode}=require('../src/peer.js');
const tick=(g,seconds,input={})=>{for(let i=0;i<Math.round(seconds*60);i++)g.step(1/60,input);};
const empty=()=>{const g=new EnduroGame();g.reset();g.start();g.cars=[];g.ensureTraffic=()=>{};return g;};
const car=(g,extra={})=>{const c={id:1,rel:5,x:0,baseX:0,speedOffset:0,color:0,counted:false,passDay:0,phase:0,...extra};g.cars.push(c);return c;};
const backend=()=>{const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};};
test('codes are case-insensitive, combinable and independently reversible',()=>{
 const g=empty();for(const c of ['detona','NITRO','ESCUDO'])assert.equal(g.applyCode(c).ok,true);
 assert.deepEqual([...g.powers],['blast','nitro','shield']);assert.equal(g.assisted,true);
 g.applyCode('NITRO');assert.equal(g.has('nitro'),false);assert.equal(g.has('blast'),true);
 const before=[...g.powers];assert.equal(g.applyCode('<script>').ok,false);assert.deepEqual([...g.powers],before);
 g.applyCode('QUANTUM');assert.equal(g.powers.size,6);g.applyCode('NORMAL');assert.equal(g.powers.size,0);assert.equal(g.assisted,true);
});
test('blast wins over shield, destroys a car once and counts one pass',()=>{
 const g=empty();g.applyCode('DETONA');g.applyCode('ESCUDO');g.speed=100;const c=car(g);g.step(1/60);
 assert.equal(g.speed,100);assert.equal(g.collisions,0);assert.equal(g.cars.length,0);assert.equal(g.remaining,199);assert.equal(g.explosions.length,1);
 g.collide(c);assert.equal(g.remaining,199);assert.equal(g.explosions.length,1);tick(g,2);assert.equal(g.explosions.length,0);
});
test('shield protects from collision without counting an unpassed opponent',()=>{
 const g=empty();g.applyCode('ESCUDO');g.speed=100;car(g);g.step(1/60);assert.equal(g.collisions,0);assert.equal(g.speed,100);assert.equal(g.remaining,200);tick(g,1);assert.equal(g.remaining,199);
});
test('nitro reaches its new cap and deactivating it clamps speed',()=>{
 const g=empty();g.applyCode('NITRO');g.applyCode('TRILHO');tick(g,6,{accelerate:true});assert.equal(g.speed,MAX_SPEED*1.85);assert.equal(g.kph,481);g.applyCode('NITRO');assert.equal(g.speed,MAX_SPEED);
});
test('grip neutralizes ice, curve drift and roadside deceleration',()=>{
 const g=empty();g.applyCode('TRILHO');g.speed=100;g.x=1.1;g.distance=1000;g.dayTime=60;const x=g.x;tick(g,.5);assert.equal(g.speed,100);assert.equal(g.x,x);
 const dry=empty(),ice=empty();for(const v of [dry,ice]){v.applyCode('TRILHO');v.speed=80;}ice.dayTime=60;tick(dry,.3,{steer:1});tick(ice,.3,{steer:1});assert.equal(dry.x,ice.x);
});
test('vision restores fog visibility and time freezes only the day clock',()=>{
 const g=empty();g.dayTime=135;assert.equal(g.visibility,100);g.applyCode('FAROL');assert.equal(g.visibility,340);g.applyCode('TEMPO');g.speed=60;tick(g,1);assert.equal(g.dayTime,135);assert.ok(g.distance>0);assert.ok(g.elapsed>0);
 g.applyCode('TEMPO');tick(g,1);assert.ok(g.dayTime>135);
});
test('turning powers off never moves an assisted run back into classic ranking',()=>{
 const b=backend(),s=new EnduroStore({backend:b}),g=empty();g.kilometers=2;s.record(g,'same-run');assert.equal(s.leaderboard(false).length,1);
 g.applyCode('NITRO');g.applyCode('NORMAL');g.kilometers=3;s.record(g,'same-run');assert.equal(s.leaderboard(false).length,0);assert.equal(s.leaderboard(true).length,1);
});
test('saved race restores paused and continues the exact deterministic simulation',()=>{
 const g=new EnduroGame();g.reset();g.applyCode('NITRO');g.applyCode('TRILHO');g.applyCode('ESCUDO');tick(g,35,{accelerate:true,steer:.1});
 const h=new EnduroGame(),state=JSON.parse(JSON.stringify(g.snapshot()));assert.ok(EnduroGame.validSnapshot(state));assert.ok(h.restore(state));assert.equal(h.mode,'paused');h.resume();
 tick(g,3,{accelerate:true,steer:-.1});tick(h,3,{accelerate:true,steer:-.1});assert.deepEqual(h.snapshot(),g.snapshot());
});
test('corrupt snapshots and hostile backups are rejected without altering progress',()=>{
 const g=empty(),state=g.snapshot();for(const bad of [{...state,speed:Infinity},{...state,cars:new Array(1000).fill({})},{...state,day:2},{...state,qualified:true},{...state,powers:['unknown']}])assert.equal(EnduroGame.validSnapshot(bad),false);
 const s=new EnduroStore({backend:backend()}),before=s.export();assert.throws(()=>s.import('{bad'));assert.equal(s.export(),before);
 const bad=JSON.parse(before);bad.run={id:'a',savedAt:Date.now(),state:{...state,speed:9999}};assert.throws(()=>validateBundle(bad));
});
test('autosave, portable backup and shared rankings survive reload and deduplicate',()=>{
 const b=backend(),s=new EnduroStore({backend:b}),g=empty();s.setName('Augusto');tick(g,1,{accelerate:true});s.record(g,'race-1');s.saveRun(g,'race-1');const reload=new EnduroStore({backend:b});assert.equal(reload.data.profile.name,'Augusto');assert.equal(reload.data.run.state.distance,g.distance);
 const other=new EnduroStore({backend:backend()});other.import(s.export());other.mergeRecords(s.data.records);other.mergeRecords(s.data.records);assert.equal(other.leaderboard().length,1);assert.equal(other.data.profile.id,s.data.profile.id);
 const incoming=[{...s.data.records[0],id:'other-race',playerId:'other',name:'Rival',km:4}];assert.equal(other.mergeRecords(incoming),true);assert.equal(other.leaderboard()[0].name,'Rival');
});
test('legacy records migrate and unavailable storage keeps an in-memory game',()=>{
 const b=backend();b.setItem('enduro-best-km','12.4');b.setItem('enduro-best-days','2');b.setItem('enduro-sound','off');const s=new EnduroStore({backend:b});assert.equal(s.best().km,12.4);assert.equal(s.best().days,2);assert.equal(s.data.preferences.sound,false);
 const blocked=new EnduroStore({backend:{getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}}});const g=empty();g.kilometers=1;blocked.record(g,'test');assert.equal(blocked.available,false);assert.equal(blocked.leaderboard().length,1);
});
function mockAudio(fail=false){
 const nodes=[],contexts=[];const param=()=>({value:0,cancelScheduledValues(){},setValueAtTime(v){this.value=v;},setTargetAtTime(v){this.value=v;},exponentialRampToValueAtTime(){}});
 class Context{constructor(){this.state='running';this.currentTime=0;this.destination={};contexts.push(this);}createOscillator(){if(fail)throw Error('oscillator unavailable');return {frequency:param(),connect(){},disconnect(){},start(){},stop(){}};}createGain(){const n={gain:param(),connect(){},disconnect(){}};nodes.push(n);return n;}close(){this.state='closed';return Promise.resolve();}}
 return {Context,nodes,contexts};
}
test('audio mutes immediately without needing another animation frame',()=>{
 const {Context,nodes}=mockAudio(),a=new Audio({Audio:Context}),g=empty();a.init();g.speed=100;a.step(g,100);assert.ok(nodes[0].gain.value>0);a.tone(440);assert.ok(nodes[1].gain.value>0);a.mute();assert.equal(nodes[0].gain.value,0);assert.equal(nodes[1].gain.value,0);a.setEnabled(false);a.step(g,200);assert.equal(nodes[0].gain.value,0);
});
test('partial audio failures are isolated and created contexts are closed',()=>{
 const m=mockAudio(true),a=new Audio({Audio:m.Context});assert.doesNotThrow(()=>a.init());assert.equal(a.failed,true);assert.equal(m.contexts[0].state,'closed');assert.doesNotThrow(()=>a.tone(200));assert.doesNotThrow(()=>a.step(empty(),0));
 const n=mockAudio(),b=new Audio({Audio:n.Context});b.init();b.context.createOscillator=()=>{throw Error('late failure');};assert.doesNotThrow(()=>b.tone(200));assert.equal(b.failed,true);
});
test('signaling tokens round-trip and reject unsupported or oversized payloads',()=>{
 const p={v:1,type:'offer',sdp:'v=0\r\ns=Enduro\r\n',purpose:'duel'};assert.deepEqual(decode(token(p)),p);assert.throws(()=>decode('bad'));assert.throws(()=>decode(token({...p,purpose:'admin'})));assert.throws(()=>decode('ENDURO1.'+'x'.repeat(25000)));
});
test('all powers combined remain bounded in a long high-speed simulation',()=>{
 const g=new EnduroGame();g.reset();g.applyCode('QUANTUM');for(let i=0;i<60*180;i++){g.step(1/60,{accelerate:true,steer:Math.sin(i/300)*.4});g.takeEvents();assert.ok(g.cars.length<100);assert.ok(g.explosions.length<=24);assert.ok(Number.isFinite(g.x));assert.ok(g.speed<=g.maxSpeed);}assert.equal(g.dayTime,0);assert.equal(g.mode,'playing');assert.ok(g.kilometers>20);
});
