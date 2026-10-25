/* Vector artwork is rasterized at the selected resolution; physics stays independent. */
(() => {
  'use strict';
  const V={width:960,height:540,horizon:152,player:414,end:540};
  const {noise,clamp}=Enduro;
  const PALETTES={
    dawn:{sky:['#142b46','#8e7985','#efc39e'],sun:'#ffdc9c',ground:'#71834c',grass:'#788b50',road:'#657648',edge:'#e4d8b0',mountain:'#6e7968',far:'#969a88',tree:'#364c38'},
    day:{sky:['#427cab','#8cbacf','#e2e1bd'],sun:'#fff0bc',ground:'#799346',grass:'#819c4d',road:'#6a8347',edge:'#f1e4c0',mountain:'#748264',far:'#a1b29b',tree:'#324c31'},
    ice:{sky:['#537d9b','#afc8d2','#e4e9da'],sun:'#fcf0cd',ground:'#c7d6d2',grass:'#d5e1dd',road:'#9fb7b7',edge:'#f0f4e9',mountain:'#879e9f',far:'#bdceca',tree:'#5e7770'},
    afternoon:{sky:['#4a86b0','#a0c3ce','#e9d5a7'],sun:'#ffe5a1',ground:'#88954b',grass:'#929f52',road:'#7b824a',edge:'#f1dfb6',mountain:'#7a8260',far:'#a4b099',tree:'#4a5831'},
    sunset:{sky:['#192944','#9b747c','#f8b77a'],sun:'#ffdd96',ground:'#6e7050',grass:'#777a52',road:'#68634b',edge:'#e8cba3',mountain:'#686a62',far:'#9d8b80',tree:'#36473b'},
    night:{sky:['#06121f','#152a3e','#48646b'],sun:'#e3edda',ground:'#193333',grass:'#203e38',road:'#253c3a',edge:'#bdcfc0',mountain:'#263e45',far:'#3d565b',tree:'#142c2b'},
    fog:{sky:['#9bafad','#b6c7c0','#d4d8c9'],sun:'#ebe8d2',ground:'#91a78d',grass:'#99ae92',road:'#889d87',edge:'#d7e0c8',mountain:'#9dafa4',far:'#bac7ba',tree:'#738d76'}
  };
  const COLORS=['#d2504d','#5a8ac5','#e6bb52','#a47cb5','#56a790','#e7965c'];
  function path(ctx,points,fill){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();}
  function ellipse(ctx,x,y,rx,ry,fill){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();}
  function gradient(ctx,x0,y0,x1,y1,stops){const g=ctx.createLinearGradient(x0,y0,x1,y1);stops.forEach((s,i)=>g.addColorStop(i/(stops.length-1),s));return g;}
  class EnduroRenderer{
    constructor(canvas,options={}){
      this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});
      if(!this.ctx)throw Error('Canvas 2D indisponível');
      this.factory=options.createCanvas||((w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;});
      this.quality='4k';this.ratio=4;this.backgrounds=new Map();this.sprites=new Map();this.drawCount=0;
      this.reducedMotion=!!options.reducedMotion;this.setQuality(options.quality||'4k',options.dpr||1);
    }
    setQuality(value,dpr=1){
      this.quality=['4k','hd','auto'].includes(value)?value:'4k';
      const cssWidth=this.canvas.clientWidth||960;
      this.ratio=this.quality==='4k'?4:this.quality==='hd'?2:clamp(Math.ceil(cssWidth*Math.min(dpr,2)/960),1,4);
      this.canvas.width=V.width*this.ratio;this.canvas.height=V.height*this.ratio;
      this.ctx.imageSmoothingEnabled=true;this.ctx.imageSmoothingQuality='high';
      this.backgrounds.clear();this.sprites.clear();
      for(const c of [...COLORS,'#ececdf','#7ac8e9'])for(const turn of [-1,0,1])this.sprites.set(turn?c+':'+turn:c,this.makeCar(c,turn));
      this.scenery=new Map();
    }
    makeCar(color,turn=0){
      const c=this.factory(512,320),ctx=c.getContext('2d');ctx.scale(4,4);
      const yaw=turn*.12,faces=[];
      const shade=(hex,k)=>'#'+[1,3,5].map(i=>Math.round(k<=1?parseInt(hex.slice(i,i+2),16)*k:parseInt(hex.slice(i,i+2),16)+(255-parseInt(hex.slice(i,i+2),16))*(k-1)).toString(16).padStart(2,'0')).join('');
      const rotate=([x,y,z])=>[x*Math.cos(yaw)+(z-1.3)*Math.sin(yaw),y,(z-1.3)*Math.cos(yaw)-x*Math.sin(yaw)+1.3];
      const face=(points,fill)=>{const vertices=points.map(rotate);faces.push({points:vertices.map(p=>this.carPoint(p)),depth:vertices.reduce((sum,p)=>sum+p[2]-.18*p[1],0)/vertices.length,fill});};
      const box=(x0,x1,y0,y1,z0,z1,paint)=>{
        face([[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0]],shade(paint,.72));
        face([[x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1]],shade(paint,1.15));
        face([[x0,y0,z0],[x0,y1,z0],[x0,y1,z1],[x0,y0,z1]],shade(paint,.88));
        face([[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[x1,y0,z1]],shade(paint,.5));
      };
      const hull=(sections,paint)=>{
        for(let i=0;i<sections.length-1;i++){
          const [z,a,b,w]=sections[i],[zz,aa,bb,ww]=sections[i+1];
          face([[-w,b,z],[w,b,z],[ww,bb,zz],[-ww,bb,zz]],shade(paint,1.06));
          face([[-w,a,z],[-w,b,z],[-ww,bb,zz],[-ww,aa,zz]],shade(paint,.78));
          face([[w,a,z],[w,b,z],[ww,bb,zz],[ww,aa,zz]],shade(paint,.53));
        }
        const [z,a,b,w]=sections[0];face([[-w,a,z],[w,a,z],[w,b,z],[-w,b,z]],shade(paint,.66));
      };
      const wheel=(x,z,r,width)=>{
        const n=20;
        for(let i=0;i<n;i++){
          const a=i*Math.PI*2/n,b=(i+1)*Math.PI*2/n;
          const y0=r+Math.sin(a)*r,z0=z+Math.cos(a)*r,y1=r+Math.sin(b)*r,z1=z+Math.cos(b)*r;
          const light=.65+Math.max(0,Math.sin((a+b)/2))*.55;
          face([[x-width/2,y0,z0],[x+width/2,y0,z0],[x+width/2,y1,z1],[x-width/2,y1,z1]],shade('#30383a',light));
          for(const side of [-1,1])face([[x+side*width/2,r,z],[x+side*width/2,y0,z0],[x+side*width/2,y1,z1]],side<0?'#293338':'#141f25');
        }
        // Longitudinal grooves follow the curved tread instead of a flat rectangle.
        for(const dx of [-width*.28,width*.28])for(let i=0;i<n;i++){
          const a=i*Math.PI*2/n,b=(i+1)*Math.PI*2/n;
          face([[x+dx-.012,r+Math.sin(a)*(r+.002),z+Math.cos(a)*(r+.002)],[x+dx+.012,r+Math.sin(a)*(r+.002),z+Math.cos(a)*(r+.002)],[x+dx+.012,r+Math.sin(b)*(r+.002),z+Math.cos(b)*(r+.002)],[x+dx-.012,r+Math.sin(b)*(r+.002),z+Math.cos(b)*(r+.002)]],'#131d22');
        }
      };
      // The camera sits behind and slightly above the car. Depth is foreshortened;
      // rear-axle ground contact is the anchor used by the road projection.
      ellipse(ctx,64,67,51,7,'#06151424');ellipse(ctx,64,70,45,4,'#06151448');
      for(const side of [-1,1]){wheel(side*1.14,0,.36,.46);wheel(side*.91,2.55,.29,.34);}
      box(-1.1,1.1,.22,.27,-.01,.12,'#879995');
      box(-.92,.92,.20,.24,2.49,2.61,'#879995');
      hull([[-.23,.17,.43,.71],[.78,.17,.58,.81],[1.65,.14,.39,.58],[2.65,.11,.23,.2],[3.25,.1,.16,.11]],color);
      // Sidepods, dark air intakes and a raised engine cover give the body volume.
      for(const side of [-1,1]){
        const a=side<0?[-.79,-.48]:[.48,.79];
        box(a[0],a[1],.3,.43,.62,.85,'#192b31');
        box(a[0],a[1],.16,.20,-.15,.58,'#24363a');
      }
      hull([[.1,.43,.61,.32],[.72,.53,.84,.23],[1.2,.36,.68,.28]],color);
      box(-.11,.11,.615,.625,.1,.68,'#eee6cc');
      hull([[1.25,.31,.49,.29],[2.08,.27,.46,.25]],'#243c44');
      // Back of the helmet: no front-facing visor on a car driving away.
      for(let lat=0;lat<6;lat++)for(let lon=0;lon<12;lon++){
        const vertex=(a,b)=>[Math.cos(a)*Math.sin(b)*.21,.79+Math.cos(b)*.22,1.65+Math.sin(a)*Math.sin(b)*.21];
        const a=lon*Math.PI/6,b=(lon+1)*Math.PI/6,u=lat*Math.PI/6,v=(lat+1)*Math.PI/6;
        face([vertex(a,u),vertex(b,u),vertex(b,v),vertex(a,v)],shade(lat===2?'#f8e9b8':'#e7bb68',.72+(1-lat/6)*.48));
      }
      box(-.24,-.17,.49,.99,1.16,1.24,'#e8e7cf');box(.17,.24,.49,.99,1.16,1.24,'#c6cabb');
      box(-.24,.24,.94,1.01,1.16,1.24,'#e8e7cf');
      // Low rear wing, supports and an actual rear fascia, all in the same view.
      box(-.52,-.46,.35,.68,-.06,.08,'#596c70');box(.46,.52,.35,.68,-.06,.08,'#596c70');
      box(-1.17,1.17,.65,.73,-.23,.17,color);
      box(-1.21,-1.16,.57,.77,-.27,.22,'#24373e');box(1.16,1.21,.57,.77,-.27,.22,'#24373e');
      box(-1.14,1.14,.728,.741,-.23,-.18,'#f4e9c9');
      box(-.99,.99,.14,.19,3.03,3.32,color);
      box(-.66,.66,.15,.27,-.28,-.22,'#172b32');
      for(const x of [-.51,.51])box(x-.12,x+.12,.31,.37,-.255,-.235,'#ef6953');
      for(const x of [-.22,.22])box(x-.065,x+.065,.16,.25,-.39,-.24,'#879593');
      for(const x of [-.45,-.15,.15,.45])box(x-.018,x+.018,.10,.18,-.33,-.1,'#34464a');
      faces.sort((a,b)=>b.depth-a.depth);for(const f of faces)path(ctx,f.points,f.fill);
      return c;
    }
    carPoint([x,height,depth],turn=0){
      if(turn){const yaw=turn*.12,z=depth-1.3;[x,depth]=[x*Math.cos(yaw)+z*Math.sin(yaw),z*Math.cos(yaw)-x*Math.sin(yaw)+1.3];}
      const perspective=1/(1+depth*.105);return [64+x*37*perspective,72-height*37*perspective-depth*6.6];
    }
    background(phase){
      if(this.backgrounds.has(phase))return this.backgrounds.get(phase);
      const p=PALETTES[phase],c=this.factory(960*this.ratio,220*this.ratio),ctx=c.getContext('2d');ctx.scale(this.ratio,this.ratio);
      ctx.fillStyle=gradient(ctx,0,0,0,185,p.sky);ctx.fillRect(0,0,960,220);
      if(phase==='night'){
        for(let i=0;i<80;i++)ellipse(ctx,noise(i+80)*960,noise(i+911)*110,.3+noise(i+8)*.8,.3+noise(i+8)*.8,'#dae6d6a0');
        ellipse(ctx,753,57,17,17,p.sun);ellipse(ctx,759,52,16,16,p.sky[0]);
      }else if(phase!=='fog'){
        const x=phase==='sunset'?735:220,y=['dawn','sunset'].includes(phase)?126:60;
        const glow=ctx.createRadialGradient(x,y,2,x,y,80);glow.addColorStop(0,'#ffe2a44d');glow.addColorStop(1,'#ffe2a400');ctx.fillStyle=glow;ctx.fillRect(x-80,y-80,160,160);
        ellipse(ctx,x,y,19,19,p.sun);
        for(let i=0;i<5;i++){const xx=noise(i+30)*960,yy=25+noise(i+44)*64;ctx.globalAlpha=.13;ellipse(ctx,xx,yy,75+noise(i+4)*50,5,p.sun);ellipse(ctx,xx+34,yy-4,44,7,p.sun);}ctx.globalAlpha=1;
      }
      for(let layer=0;layer<3;layer++){
        const points=[[0,200]];
        for(let x=-10;x<=970;x+=4){const wave=Math.sin(x/(90-layer*20)+layer)*15+Math.sin(x/(37-layer*7)+2)*8+Math.sin(x/15)*2;points.push([x,135+layer*14-wave*(1-layer*.13)]);}
        points.push([970,220]);path(ctx,points,[p.far,p.mountain,p.tree][layer]);
        if(layer===1&&phase==='ice'){for(let x=20;x<960;x+=155)path(ctx,[[x,137],[x+40,108],[x+75,146],[x+48,128],[x+35,134]],'#edf0df70');}
      }
      if(this.backgrounds.size>=2)this.backgrounds.delete(this.backgrounds.keys().next().value);
      this.backgrounds.set(phase,c);return c;
    }
    road(g,y){const t=(y-V.horizon)/(V.player-V.horizon);return {center:480+g.curvature*150*Math.max(0,1-t)**2,half:14+310*t};}
    project(g,rel,x=0){const scale=75/(75+Math.max(-24,rel)),y=V.horizon+(V.player-V.horizon)*scale,r=this.road(g,y);return {x:r.center+x*r.half,y,scale};}
    scenerySprite(key,p){
      if(this.scenery.has(key))return this.scenery.get(key);
      const c=this.factory(160,224),ctx=c.getContext('2d');
      ctx.fillStyle='#524f3c';ctx.fillRect(77,122,7,85);
      for(let i=0;i<4;i++){const y=16+i*31,w=26+i*12;path(ctx,[[80,y],[80-w,y+62],[80+w,y+62]],p.tree);path(ctx,[[80,y],[80-w,y+62],[80,y+53]],key==='ice'?'#ebf0dd':'#90a06050');}
      this.scenery.set(key,c);return c;
    }
    draw(g,now=0,braking=false,opponent=null){
      this.drawCount++;const ctx=this.ctx,p=PALETTES[g.phase.key],night=g.phase.key==='night',fog=g.phase.key==='fog'&&!g.has('vision');
      ctx.setTransform(this.ratio,0,0,this.ratio,0,0);ctx.globalAlpha=1;ctx.drawImage(this.background(g.phase.key),0,0,960,220);
      ctx.fillStyle=p.ground;ctx.fillRect(0,V.horizon,960,540-V.horizon);
      // Two-pixel scanlines are shared by the terrain, shoulders and perspective markings.
      for(let y=V.horizon;y<540;y+=2){
        const t=Math.max(.015,(y-V.horizon)/(V.player-V.horizon)),z=75*(1/t-1),r=this.road(g,y),band=Math.floor((g.distance+z)/23)%2;
        ctx.fillStyle=band?p.grass:p.ground;ctx.fillRect(0,y,960,2);
        ctx.fillStyle='#b4a67b';ctx.fillRect(r.center-r.half-4*t,y,r.half*2+8*t,2);
        ctx.fillStyle=band?p.road:p.ground;ctx.fillRect(r.center-r.half,y,r.half*2,2);
        if(Math.floor((g.distance+z)/18)%3===0){ctx.fillStyle=night?'#d0ddc332':'#efebd026';ctx.fillRect(r.center-r.half/3,y,.4+t*.7,2);ctx.fillRect(r.center+r.half/3,y,.4+t*.7,2);}
      }
      for(const side of [-1,1]){
        const outside=[],inside=[];
        for(let y=V.horizon;y<=540;y+=2){const r=this.road(g,y),t=(y-V.horizon)/(V.player-V.horizon),x=r.center+side*r.half;outside.push([x,y]);inside.push([x-side*(1+1.4*t),y]);}
        path(ctx,[...outside,...inside.reverse()],p.edge);
      }
      const tree=this.scenerySprite(g.phase.key,p),first=Math.floor((g.distance-30)/36),last=Math.ceil((g.distance+g.visibility)/36);
      for(let id=last;id>=first;id--){
        const rel=id*36-g.distance;if(rel<-22||rel>g.visibility)continue;
        const q=this.project(g,rel),r=this.road(g,q.y),s=q.scale;
        for(const side of [-1,1]){
          const x=r.center+side*r.half*(1.18+noise(id*3+side)*.4),sz=(27+noise(id+39)*24)*s;
          if(x<-80||x>1040)continue;
          if(id%3===0)ctx.drawImage(tree,x-sz*.38,q.y-sz,sz*.76,sz);
          else if(id%3===1){ellipse(ctx,x,q.y-3*s,11*s,5*s,p.tree);ellipse(ctx,x-4*s,q.y-7*s,7*s,6*s,g.phase.key==='ice'?'#e7ecdd':p.grass);}
          else{path(ctx,[[x-8*s,q.y],[x-5*s,q.y-8*s],[x+4*s,q.y-10*s],[x+10*s,q.y]],g.phase.key==='ice'?'#e1e7dc':'#7b826a');}
          if(id%2===0){const post=r.center+side*r.half*1.055;ctx.fillStyle=p.edge;ctx.fillRect(post-s,q.y-16*s,2*s,16*s);ctx.fillStyle=night?'#ffc682':'#bd6b3f';ctx.fillRect(post-s,q.y-14*s,2*s,4*s);}
        }
      }
      const cars=g.cars.filter(c=>c.rel<=g.visibility&&c.rel>=-24).map(c=>({...c,kind:'rival'}));
      if(opponent&&opponent.distance-g.distance>=-24&&opponent.distance-g.distance<=g.visibility)cars.push({rel:opponent.distance-g.distance,x:opponent.x,kind:'ghost'});
      cars.push({rel:0,x:g.x,kind:'player'});cars.sort((a,b)=>b.rel-a.rel);
      for(const car of cars){
        const q=this.project(g,car.rel,car.x),s=q.scale,player=car.kind==='player',ghost=car.kind==='ghost';
        const turn=player?Math.round(clamp(g.steerVelocity/2.45,-1,1)):0;
        const unit=88/128*s,at=(point)=>{const [x,y]=this.carPoint(point,turn);return [q.x+(x-64)*unit,q.y+(y-72)*unit];};
        const lamp=(side,lit)=>{
          const [x,y]=at([side*.51,.34,-.26]);
          if(night)ellipse(ctx,x,y,5*s,2*s,lit?'#ff765750':'#ed624b30');
          ctx.fillStyle=lit?'#ff7659':'#ef6953';ctx.fillRect(x-2.7*s,y-.7*s,5.4*s,1.4*s);
        };
        if(night&&!player&&!ghost&&!g.has('vision')){lamp(-1,false);lamp(1,false);continue;}
        if(player&&g.has('nitro')&&g.speed>125){
          const [x,y]=at([0,.2,-.35]),flicker=this.reducedMotion?1:1+Math.sin(now*.07)*.18;
          path(ctx,[[x-5*s,y],[x,y+22*s*flicker],[x+5*s,y]],'#5bdff299');
          path(ctx,[[x-2.5*s,y],[x,y+14*s*flicker],[x+2.5*s,y]],'#edffff');
        }
        if(ghost)ctx.globalAlpha=.5;
        const color=player?'#ececdf':ghost?'#7ac8e9':COLORS[car.color];
        if(player&&g.crashTimer>0&&!this.reducedMotion)ctx.globalAlpha=Math.floor(now/90)%2?.6:1;
        ctx.drawImage(this.sprites.get(turn?color+':'+turn:color),q.x-44*s,q.y-49.5*s,88*s,55*s);
        // Moving tread highlights follow distance, so they stop with the wheels.
        if(!this.reducedMotion){
          const rotation=(g.distance+car.rel)*.55;
          for(const side of [-1,1])for(let i=0;i<3;i++){
            const angle=rotation+i*Math.PI*2/3,z=Math.cos(angle)*.363,height=.36+Math.sin(angle)*.363;
            if(z>=-.05||height>.57||height<.06)continue;
            path(ctx,[[side*1.14-.14,height-.009,z],[side*1.14+.14,height-.009,z],[side*1.14+.14,height+.009,z],[side*1.14-.14,height+.009,z]].map(at),'#84918b55');
          }
        }
        ctx.globalAlpha=1;
        if(player&&braking){lamp(-1,true);lamp(1,true);}
        if(player&&g.has('shield')){ctx.strokeStyle=g.shieldFlash>0?'#e2ffff':'#82ececb3';ctx.lineWidth=g.shieldFlash>0?3:1.5;ctx.beginPath();ctx.ellipse(q.x,q.y-15*s,43*s,23*s,0,0,Math.PI*2);ctx.stroke();}
        if(ghost){ctx.fillStyle='#d4f5ff';ctx.font='bold 9px Arial';ctx.textAlign='center';ctx.fillText('RIVAL',q.x,q.y-38*s);}
      }
      for(const e of g.explosions){
        const q=this.project(g,e.rel,e.x),age=1.15-e.life,fade=Math.min(1,e.life*2.8);ctx.globalAlpha=fade;
        if(!this.reducedMotion){
          for(let i=0;i<14;i++){const angle=i*2.4,dist=age*(16+noise(i+e.id)*65),size=(7+noise(i+2)*9)*(1-age*.55)*q.scale;ellipse(ctx,q.x+Math.cos(angle)*dist*q.scale,q.y-20+Math.sin(angle)*dist*q.scale,size,size,['#ffc65b','#ed8740','#e8dfb7','#9e6c4950'][i%4]);}
          ctx.strokeStyle='#ffdf8a';ctx.lineWidth=2*fade;ctx.beginPath();ctx.ellipse(q.x,q.y-16,age*100*q.scale,age*55*q.scale,0,0,Math.PI*2);ctx.stroke();
        }else ellipse(ctx,q.x,q.y-15,25*q.scale,18*q.scale,'#edb75a');
        ctx.globalAlpha=1;
      }
      if(fog){const mist=ctx.createLinearGradient(0,142,0,360);mist.addColorStop(0,'#c1cfc4ee');mist.addColorStop(.5,'#c1cfc488');mist.addColorStop(1,'#c1cfc400');ctx.fillStyle=mist;ctx.fillRect(0,140,960,260);}
      if(night){const light=ctx.createRadialGradient(480+g.x*324,397,15,480+g.x*324,397,210);light.addColorStop(0,'#fff2b608');light.addColorStop(1,'#fff2b600');ctx.fillStyle=light;ctx.fillRect(0,180,960,360);}
      const vignette=ctx.createRadialGradient(480,280,160,480,280,620);vignette.addColorStop(0,'#061a1900');vignette.addColorStop(1,'#061a194d');ctx.fillStyle=vignette;ctx.fillRect(0,0,960,540);
    }
  }
  globalThis.EnduroRenderer=EnduroRenderer;
  if(typeof module!=='undefined')module.exports={EnduroRenderer,V,PALETTES};
})();
