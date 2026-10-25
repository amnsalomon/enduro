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
      for(const c of [...COLORS,'#ececdf','#7ac8e9'])this.sprites.set(c,this.makeCar(c));
      this.scenery=new Map();
    }
    makeCar(color){
      const c=this.factory(448,672),ctx=c.getContext('2d');ctx.scale(4,4);
      ellipse(ctx,56,145,47,14,'#08120e50');
      // Open-wheel silhouette, sculpted sidepods, tread, cockpit and rear wing.
      const tire=(x,y,w,h)=>{
        ctx.fillStyle=gradient(ctx,x,y,x+w,y,['#131c23','#4b5559','#101b23']);ctx.fillRect(x,y,w,h);
        ctx.fillStyle='#070e14';ctx.fillRect(x+2,y,2,h);ctx.fillRect(x+w-4,y,2,h);
        ctx.strokeStyle='#81908b66';ctx.lineWidth=.65;for(let yy=y+3;yy<y+h-2;yy+=4){ctx.beginPath();ctx.moveTo(x+4,yy);ctx.lineTo(x+w-5,yy+1);ctx.stroke();}
      };
      tire(19,28,20,34);tire(73,28,20,34);
      path(ctx,[[33,46],[79,46],[80,50],[32,50]],'#83948f');
      path(ctx,[[44,8],[68,8],[72,58],[88,123],[77,145],[35,145],[24,123],[40,58]],'#16282f');
      path(ctx,[[46,10],[66,10],[69,57],[80,125],[32,125],[43,57]],gradient(ctx,30,0,82,0,[color,'#f4f0d0',color]));
      ctx.fillStyle='#20333b';ctx.fillRect(35,13,42,8);ctx.fillStyle=color;ctx.fillRect(36,12,40,5);
      ctx.fillStyle='#fff3c4';ctx.fillRect(38,12,36,1);ctx.fillStyle='#f5e6bc';ctx.fillRect(53,25,6,23);
      path(ctx,[[36,62],[45,74],[41,125],[24,122],[24,87]],gradient(ctx,24,0,46,0,['#253b3d',color,'#f2d9a3']));
      path(ctx,[[76,62],[88,87],[88,122],[71,125],[67,74]],gradient(ctx,66,0,88,0,[color,color,'#27363c']));
      path(ctx,[[44,48],[68,48],[73,75],[68,100],[44,100],[39,75]],'#91bbbd');
      path(ctx,[[46,51],[66,51],[69,75],[64,95],[48,95],[43,75]],'#152c38');
      ctx.strokeStyle='#edf1d9';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(43,72);ctx.lineTo(47,52);ctx.lineTo(64,52);ctx.stroke();
      ellipse(ctx,56,71,8,10,'#f6d18b');ellipse(ctx,56,70,7,8,'#e7a55c');
      path(ctx,[[48,69],[64,69],[63,74],[49,74]],'#1b3440');ctx.fillStyle='#90b8b8';ctx.fillRect(50,70,12,1);
      path(ctx,[[46,84],[51,82],[61,82],[66,84],[67,95],[45,95]],'#34464c');
      ctx.fillStyle='#eadfc4';ctx.fillRect(44,99,24,4);ctx.fillStyle='#233940';ctx.fillRect(49,106,14,23);
      ctx.fillStyle='#efd69c';ctx.fillRect(53,109,6,14);ctx.fillStyle='#15262e';ctx.fillRect(31,110,8,13);ctx.fillRect(73,110,8,13);
      tire(8,103,24,49);tire(80,103,24,49);
      ctx.fillStyle='#b2b9a2';ctx.fillRect(29,110,3,31);ctx.fillRect(80,110,3,31);
      path(ctx,[[29,129],[83,129],[88,144],[24,144]],'#14282f');
      ctx.fillStyle=gradient(ctx,0,130,0,143,[color,'#1c3034']);ctx.fillRect(26,128,60,15);
      ctx.fillStyle='#eee9cc';ctx.fillRect(28,128,56,2);ctx.fillStyle=color;ctx.fillRect(28,132,56,4);
      ctx.fillStyle='#182d36';ctx.fillRect(37,143,38,7);ctx.fillStyle='#ff7151';ctx.fillRect(29,140,10,3);ctx.fillRect(73,140,10,3);
      ctx.fillStyle='#b9c3b4';ctx.fillRect(44,148,6,8);ctx.fillRect(62,148,6,8);ctx.fillStyle='#223741';ctx.fillRect(45,152,4,4);ctx.fillRect(63,152,4,4);
      return c;
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
        if(night&&!player&&!ghost&&!g.has('vision')){
          ellipse(ctx,q.x-12*s,q.y+16*s,7*s,3*s,'#fb695338');ellipse(ctx,q.x+12*s,q.y+16*s,7*s,3*s,'#fb695338');
          ctx.fillStyle='#ff725c';ctx.fillRect(q.x-15*s,q.y+14*s,5*s,2*s);ctx.fillRect(q.x+10*s,q.y+14*s,5*s,2*s);continue;
        }
        if(player&&g.has('nitro')&&g.speed>125){
          const flicker=this.reducedMotion?1:1+Math.sin(now*.07)*.18;
          path(ctx,[[q.x-8,q.y+27],[q.x,q.y+27+30*flicker],[q.x+8,q.y+27]],'#5bdff299');
          path(ctx,[[q.x-4,q.y+27],[q.x,q.y+27+21*flicker],[q.x+4,q.y+27]],'#edffff');
        }
        if(ghost)ctx.globalAlpha=.5;
        const color=player?'#ececdf':ghost?'#7ac8e9':COLORS[car.color];
        if(player&&g.crashTimer>0&&!this.reducedMotion)ctx.globalAlpha=Math.floor(now/90)%2?.6:1;
        ctx.drawImage(this.sprites.get(color),q.x-37*s,q.y-71*s,74*s,111*s);ctx.globalAlpha=1;
        if(player&&braking){ctx.fillStyle='#ff624d';ctx.fillRect(q.x-17,q.y+21,7,3);ctx.fillRect(q.x+10,q.y+21,7,3);}
        if(player&&g.has('shield')){ctx.strokeStyle=g.shieldFlash>0?'#e2ffff':'#82ececb3';ctx.lineWidth=g.shieldFlash>0?3:1.5;ctx.beginPath();ctx.ellipse(q.x,q.y-13,40,62,0,0,Math.PI*2);ctx.stroke();}
        if(ghost){ctx.fillStyle='#d4f5ff';ctx.font='bold 9px Arial';ctx.textAlign='center';ctx.fillText('RIVAL',q.x,q.y-77*s);}
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
