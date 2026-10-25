(() => {
  'use strict';
  class EnduroAudio{
    constructor(options={}){this.Audio=options.Audio||(typeof window!=='undefined'&&(window.AudioContext||window.webkitAudioContext));this.enabled=options.enabled!==false;this.context=null;this.osc=null;this.gain=null;this.effects=new Set();this.failed=false;this.lastRoad=0;}
    disableFailed(){this.failed=true;this.mute();try{this.osc?.stop();this.osc?.disconnect();this.gain?.disconnect();const p=this.context?.close();p?.catch(()=>{});}catch{}this.context=this.osc=this.gain=null;}
    init(){
      if(!this.enabled||this.failed||!this.Audio)return;
      try{
        if(!this.context){const context=this.context=new this.Audio(),osc=this.osc=context.createOscillator(),gain=this.gain=context.createGain();osc.type='sawtooth';osc.frequency.value=35;gain.gain.value=0;osc.connect(gain);gain.connect(context.destination);osc.start();}
        if(this.context.state==='suspended')this.context.resume().catch(()=>this.disableFailed());
      }catch{this.disableFailed();}
    }
    mute(){for(const node of [this.gain,...this.effects])try{if(node&&this.context){const p=node.gain;p.cancelScheduledValues(this.context.currentTime);p.setValueAtTime(0,this.context.currentTime);}}catch{}}
    setEnabled(value){this.enabled=!!value;if(this.enabled)this.init();else this.mute();}
    tone(freq,duration=.1,type='square',volume=.025,end=freq){
      if(!this.enabled||this.failed||this.context?.state!=='running')return;
      try{const a=this.context,o=a.createOscillator(),v=a.createGain(),t=a.currentTime;this.effects.add(v);o.type=type;o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(Math.max(15,end),t+duration);v.gain.setValueAtTime(volume,t);v.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(v);v.connect(a.destination);o.start(t);o.stop(t+duration+.02);o.onended=()=>{this.effects.delete(v);try{o.disconnect();v.disconnect();}catch{}};}catch{this.disableFailed();}
    }
    step(g,now){
      if(!this.context||!this.gain||this.failed)return;
      if(g.mode!=='playing'||!this.enabled){this.mute();return;}
      try{const t=this.context.currentTime;this.gain.gain.setTargetAtTime(.009+Math.min(g.speed/120,1.85)*.009,t,.04);this.osc.frequency.setTargetAtTime(32+g.speed*.9-Math.min(5,Math.floor(g.speed/33))*16,t,.06);if(g.offroad&&!g.has('grip')&&now-this.lastRoad>150){this.tone(52,.08,'square',.02,24);this.lastRoad=now;}}catch{this.disableFailed();}
    }
  }
  globalThis.EnduroAudio=EnduroAudio;if(typeof module!=='undefined')module.exports=EnduroAudio;
})();
