/* Independent browser recreation. Original Enduro: Larry Miller / Activision, 1983. */
(() => {
  'use strict';
  const W=160,H=210,HORIZON=52,ROAD_END=166,PLAYER_Y=143,VIEW_DISTANCE=340,DAY_SECONDS=150,MAX_SPEED=120;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const POWERS=Object.freeze({
    DETONA:{id:'blast',name:'Impacto explosivo',description:'Destrói os adversários no impacto sem perder velocidade.'},
    NITRO:{id:'nitro',name:'Supervelocidade',description:'Aceleração extra e velocidade máxima de 481 km/h.'},
    ESCUDO:{id:'shield',name:'Escudo',description:'Atravessa adversários sem sofrer colisões.'},
    TRILHO:{id:'grip',name:'Aderência total',description:'Neutraliza o gelo, a deriva das curvas e a perda de velocidade no acostamento.'},
    FAROL:{id:'vision',name:'Visão ampliada',description:'Enxerga longe na neblina e revela os carros à noite.'},
    TEMPO:{id:'time',name:'Relógio congelado',description:'Congela o tempo do dia; digite novamente para o relógio continuar.'}
  });
  const POWER_IDS=Object.values(POWERS).map(p=>p.id);
  const noise=(n)=>{let x=Math.imul(n|0,374761393)+1983|0;x=Math.imul(x^(x>>>13),1274126177);return ((x^(x>>>16))>>>0)/4294967296;};
  const PHASES=[
    {from:0,to:.12,key:'dawn',name:'AMANHECER'},
    {from:.12,to:.32,key:'day',name:'DIA'},
    {from:.32,to:.46,key:'ice',name:'GELO'},
    {from:.46,to:.59,key:'afternoon',name:'TARDE'},
    {from:.59,to:.69,key:'sunset',name:'ENTARDECER'},
    {from:.69,to:.86,key:'night',name:'NOITE'},
    {from:.86,to:.96,key:'fog',name:'NEBLINA'},
    {from:.96,to:1.01,key:'dawn',name:'AMANHECER'}
  ];
  function curveAt(distance){return Math.sin(distance/960)*.8+Math.sin(distance/470)*.22;}
  class EnduroGame{
    constructor(){this.reset();this.mode='title';}
    reset(powers=[]){
      this.mode='ready';this.previousMode='playing';this.day=1;this.completedDays=0;
      this.dayTime=0;this.elapsed=0;this.distance=0;this.kilometers=0;
      this.speed=0;this.x=0;this.steerVelocity=0;this.curvature=0;
      this.required=200;this.passed=0;this.totalPassed=0;this.qualified=false;
      this.cars=[];this.rowId=0;this.events=[];this.crashTimer=0;this.collisions=0;
      this.offroad=false;this.goalNotice=0;this.dayNotice=0;this.trophy=false;
      this.previousPhase='dawn';this.ensureTraffic();
      this.powers=new Set(powers.filter(p=>POWER_IDS.includes(p)));this.assisted=false;
      this.explosions=[];this.effectId=0;this.shieldFlash=0;
    }
    get remaining(){return this.qualified?0:Math.max(0,this.required-this.passed);}
    get phase(){const t=this.dayTime/DAY_SECONDS;return PHASES.find(p=>t>=p.from&&t<p.to)||PHASES[0];}
    get kph(){return Math.round(this.speed/MAX_SPEED*260);}
    get trafficSpeed(){return 46+Math.min(this.day-1,10)*2.7;}
    get maxSpeed(){return this.has('nitro')?MAX_SPEED*1.85:MAX_SPEED;}
    get visibility(){return this.phase.key==='fog'&&!this.has('vision')?100:VIEW_DISTANCE;}
    has(power){return this.powers.has(power);}
    applyCode(value){
      const code=String(value).trim().toUpperCase();
      if(code==='NORMAL')this.powers.clear();
      else if(code==='QUANTUM')POWER_IDS.forEach(p=>this.powers.add(p));
      else if(POWERS[code]){const id=POWERS[code].id;this.powers.has(id)?this.powers.delete(id):this.powers.add(id);}
      else return {ok:false,message:'Código desconhecido: '+code};
      if(this.powers.size&&(this.mode==='playing'||this.mode==='paused'&&this.previousMode==='playing'))this.assisted=true;
      this.speed=Math.min(this.speed,this.maxSpeed);
      this.emit('power');
      return {ok:true,message:code==='NORMAL'?'Todos os poderes desativados.':code==='QUANTUM'?'Todos os poderes ativados.':POWERS[code].name+(this.has(POWERS[code].id)?' ativado.':' desativado.')};
    }
    emit(type,data={}){this.events.push({type,...data});}
    takeEvents(){const e=this.events;this.events=[];return e;}
    start(){if(this.mode==='ready'){this.mode='playing';if(this.powers.size)this.assisted=true;this.emit('start');}}
    pause(){if(this.mode==='playing'||this.mode==='ready'){this.previousMode=this.mode;this.mode='paused';this.emit('pause');}}
    resume(){if(this.mode==='paused'){this.mode=this.previousMode;this.emit('resume');}}
    ensureTraffic(){
      let far=this.cars.length?Math.max(...this.cars.map(c=>c.rel)):38;
      while(far<VIEW_DISTANCE+40){
        const id=this.rowId++,r=noise(id*9+10),lanes=[-.66,0,.66];
        const first=Math.min(2,Math.floor(noise(id*9+11)*3));
        const selected=[first];
        if(r<Math.min(.72,.45+this.day*.035))selected.push((first+1+(noise(id*9+12)>.5?1:0))%3);
        const gap=31+noise(id*9+13)*13;far+=gap;
        selected.forEach((lane,i)=>{
          const key=id*2+i;
          this.cars.push({id:key,rel:far+i*8,x:lanes[lane],baseX:lanes[lane],
            speedOffset:(noise(key+341)-.5)*5,color:Math.floor(noise(key+73)*6),
            counted:false,passDay:0,phase:noise(key+821)*6.28});
        });
      }
    }
    overtake(car){
      if(car.counted)return;
      car.counted=true;car.passDay=this.day;this.totalPassed++;
      if(!this.qualified){
        this.passed++;
        if(this.passed>=this.required){this.qualified=true;this.goalNotice=4;this.emit('qualified');}
      }
      this.emit('pass');
    }
    losePass(car){
      if(!car.counted)return;
      if(car.passDay===this.day&&!this.qualified)this.passed=Math.max(0,this.passed-1);
      car.counted=false;this.totalPassed=Math.max(0,this.totalPassed-1);
    }
    collide(car){
      if(car.destroyed)return;
      if(this.has('blast')){
        car.destroyed=true;this.overtake(car);
        this.explosions.push({id:this.effectId++,x:car.x,rel:car.rel,life:1.15});
        this.explosions=this.explosions.slice(-24);this.emit('explosion');return;
      }
      if(this.has('shield')){if(this.shieldFlash<=0)this.emit('shield');this.shieldFlash=.25;return;}
      if(this.crashTimer>0)return;
      this.collisions++;this.crashTimer=.85;this.speed*=.24;
      const away=this.x===car.x?(car.id%2?1:-1):Math.sign(this.x-car.x);
      this.x=clamp(this.x+away*.18,-1.22,1.22);this.steerVelocity=away*.7;
      this.emit('collision');
    }
    finishDay(){
      if(!this.qualified){this.mode='gameover';this.emit('gameover');return;}
      this.completedDays++;this.day++;this.dayTime-=DAY_SECONDS;
      this.required=300;this.passed=0;this.qualified=false;this.dayNotice=3;
      if(this.completedDays>=5&&!this.trophy){this.trophy=true;this.emit('trophy');}
      this.emit('newDay',{day:this.day});
    }
    step(dt,input={}){
      if(!Number.isFinite(dt)||dt<=0)return;dt=Math.min(dt,1/30);
      if(this.mode==='ready'&&input.accelerate)this.start();
      if(this.mode!=='playing')return;
      this.elapsed+=dt;if(!this.has('time'))this.dayTime+=dt;
      if(this.powers.size)this.assisted=true;
      this.crashTimer=Math.max(0,this.crashTimer-dt);
      this.shieldFlash=Math.max(0,this.shieldFlash-dt);
      this.goalNotice=Math.max(0,this.goalNotice-dt);this.dayNotice=Math.max(0,this.dayNotice-dt);
      const steering=clamp(Number(input.steer)||0,-1,1);
      const phase=this.phase;
      if(input.brake)this.speed=Math.max(0,this.speed-75*dt);
      else if(input.accelerate&&this.crashTimer<.45)this.speed=Math.min(this.maxSpeed,this.speed+(this.has('nitro')?58:26)*dt);
      // No drag on the road: releasing the Atari fire button keeps the current speed.
      this.curvature=curveAt(this.distance);
      const icy=phase.key==='ice'&&!this.has('grip');
      const targetSteer=steering*(icy?1.8:2.45)*clamp(this.speed/32,0,1);
      const response=icy?2.0:12;
      this.steerVelocity+=(targetSteer-this.steerVelocity)*Math.min(1,dt*response);
      this.x+=this.steerVelocity*dt-(this.has('grip')?0:this.curvature*(this.speed/MAX_SPEED)**2*.44*dt);
      this.x=clamp(this.x,-1.22,1.22);this.offroad=Math.abs(this.x)>.91;
      if(this.offroad&&!this.has('grip')){this.speed=Math.max(0,this.speed-40*dt);this.steerVelocity*=Math.max(0,1-dt*2);}
      this.distance+=this.speed*dt;
      this.kilometers+=this.speed/MAX_SPEED*260/3600*dt;
      for(const car of this.cars){
        const old=car.rel;
        car.rel+=(this.trafficSpeed+car.speedOffset-this.speed)*dt;
        car.x=clamp(car.baseX+Math.sin(this.elapsed*.6+car.phase)*Math.min(.13,Math.max(0,this.day-1)*.025),-.83,.83);
        const crossing=Math.min(old,car.rel)<7&&Math.max(old,car.rel)>-7;
        if(crossing&&Math.abs(car.x-this.x)<.205&&this.crashTimer<=0&&this.speed>4){this.collide(car);continue;}
        if(old>-10&&car.rel<=-10)this.overtake(car);
        if(old<=-10&&car.rel>-10)this.losePass(car);
      }
      for(const effect of this.explosions){effect.life-=dt;effect.rel-=this.speed*dt;}
      this.explosions=this.explosions.filter(e=>e.life>0);
      this.cars=this.cars.filter(car=>!car.destroyed&&car.rel>-115&&car.rel<VIEW_DISTANCE+220);
      this.ensureTraffic();
      if(phase.key!==this.previousPhase){this.previousPhase=phase.key;this.emit('weather',{phase:phase.key,name:phase.name});}
      if(this.dayTime>=DAY_SECONDS)this.finishDay();
    }
    snapshot(){
      const state={version:2};
      for(const key of ['day','completedDays','dayTime','elapsed','distance','kilometers','speed','x','steerVelocity','curvature','required','passed','totalPassed','qualified','rowId','crashTimer','collisions','offroad','goalNotice','dayNotice','trophy','previousPhase','assisted'])state[key]=this[key];
      state.mode=this.mode==='paused'?this.previousMode:this.mode;
      state.powers=[...this.powers];state.cars=this.cars.map(c=>({...c}));return state;
    }
    restore(state){
      if(!EnduroGame.validSnapshot(state))return false;
      this.reset(state.powers);
      for(const key of Object.keys(this.snapshot())){
        if(['version','mode','powers','cars'].includes(key))continue;
        this[key]=state[key];
      }
      this.cars=state.cars.map(c=>({...c}));this.previousMode=state.mode;
      this.mode='paused';this.events=[];return true;
    }
    static validSnapshot(s){
      if(!s||s.version!==2||!['ready','playing'].includes(s.mode))return false;
      const limits={day:[1,100000],completedDays:[0,99999],dayTime:[0,DAY_SECONDS],elapsed:[0,1e9],distance:[0,1e12],kilometers:[0,1e9],speed:[0,MAX_SPEED*1.85],x:[-1.22,1.22],steerVelocity:[-4,4],curvature:[-1.1,1.1],required:[200,300],passed:[0,300],totalPassed:[0,1e9],rowId:[0,1e9],crashTimer:[0,.85],collisions:[0,1e9],goalNotice:[0,4],dayNotice:[0,3]};
      for(const [k,[min,max]] of Object.entries(limits))if(!Number.isFinite(s[k])||s[k]<min||s[k]>max)return false;
      for(const k of ['day','completedDays','required','passed','totalPassed','rowId','collisions'])if(!Number.isInteger(s[k]))return false;
      for(const k of ['qualified','offroad','trophy','assisted'])if(typeof s[k]!=='boolean')return false;
      if(s.day!==s.completedDays+1||s.required!==(s.day===1?200:300)||s.qualified!==(s.passed>=s.required))return false;
      if(!PHASES.some(p=>p.key===s.previousPhase))return false;
      if(!Array.isArray(s.powers)||s.powers.length>6||s.powers.some(p=>!POWER_IDS.includes(p)))return false;
      if(s.speed>(s.powers.includes('nitro')?MAX_SPEED*1.85:MAX_SPEED))return false;
      if(s.mode==='playing'&&s.powers.length&&!s.assisted)return false;
      if(!Array.isArray(s.cars)||s.cars.length>100)return false;
      return s.cars.every(c=>c&&Number.isInteger(c.id)&&c.id>=0&&Number.isFinite(c.rel)&&c.rel>=-120&&c.rel<=600&&Number.isFinite(c.x)&&Math.abs(c.x)<=.84&&Number.isFinite(c.baseX)&&Math.abs(c.baseX)<=.67&&Number.isFinite(c.speedOffset)&&Math.abs(c.speedOffset)<=3&&Number.isInteger(c.color)&&c.color>=0&&c.color<6&&typeof c.counted==='boolean'&&Number.isInteger(c.passDay)&&c.passDay>=0&&c.passDay<=s.day&&Number.isFinite(c.phase)&&c.phase>=0&&c.phase<=6.29);
    }
  }
  globalThis.Enduro={EnduroGame,W,H,HORIZON,ROAD_END,PLAYER_Y,VIEW_DISTANCE,DAY_SECONDS,MAX_SPEED,PHASES,curveAt,clamp,noise,POWERS,POWER_IDS};
  if(typeof module!=='undefined')module.exports=globalThis.Enduro;
})();
