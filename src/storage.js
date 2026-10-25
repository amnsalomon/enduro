(() => {
  'use strict';
  const KEY='enduro-save-v2',MAX_RECORDS=100,MAX_BYTES=300000;
  const uid=()=>typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():'race-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,12);
  const cleanName=v=>String(v||'Piloto').replace(/[\u0000-\u001f<>]/g,'').trim().slice(0,24)||'Piloto';
  const validId=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(v);
  const finite=(v,max)=>Number.isFinite(v)&&v>=0&&v<=max;
  function cleanRecord(r){
    if(!r||!validId(r.id)||!validId(r.playerId)||!finite(r.km,1e9)||!Number.isInteger(r.days)||!finite(r.days,99999)||typeof r.assisted!=='boolean'||!finite(r.at,1e15))return null;
    return {id:r.id,playerId:r.playerId,name:cleanName(r.name),km:r.km,days:r.days,assisted:r.assisted,at:r.at};
  }
  function validateBundle(value){
    const text=typeof value==='string'?value:JSON.stringify(value);
    if(text.length>MAX_BYTES)throw Error('Arquivo de progresso muito grande.');
    const d=JSON.parse(text);
    if(!d||d.version!==2||!d.profile||!validId(d.profile.id)||typeof d.profile.name!=='string'||!Array.isArray(d.records)||d.records.length>MAX_RECORDS)throw Error('Formato de progresso inválido.');
    const records=d.records.map(cleanRecord);if(records.some(r=>!r))throw Error('Ranking inválido no arquivo.');
    let run=null;
    if(d.run){if(!validId(d.run.id)||!finite(d.run.savedAt,1e15)||!Enduro.EnduroGame.validSnapshot(d.run.state))throw Error('Corrida salva inválida.');run={id:d.run.id,savedAt:d.run.savedAt,state:d.run.state};}
    const prefs=d.preferences||{};
    return {version:2,profile:{id:d.profile.id,name:cleanName(d.profile.name)},records,run,preferences:{sound:prefs.sound!==false,quality:['4k','hd','auto'].includes(prefs.quality)?prefs.quality:'4k'},updatedAt:finite(d.updatedAt,1e15)?d.updatedAt:0};
  }
  class EnduroStore{
    constructor(options={}){
      this.available=true;
      try{this.backend=options.backend===undefined?globalThis.localStorage:options.backend;}catch{this.backend=null;}
      this.data={version:2,profile:{id:uid(),name:'Piloto'},records:[],run:null,preferences:{sound:true,quality:'4k'},updatedAt:0};
      try{const raw=this.backend?.getItem(KEY);if(raw)this.data=validateBundle(raw);else this.migrate();}catch{this.available=false;}
      if(!this.backend)this.available=false;
    }
    migrate(){
      if(!this.backend)return;
      const km=Number(this.backend.getItem('enduro-best-km')),days=Number(this.backend.getItem('enduro-best-days'));
      if(finite(km,1e9)&&km>0)this.data.records.push({id:'legacy-'+this.data.profile.id,playerId:this.data.profile.id,name:'Piloto · anterior',km,days:Number.isInteger(days)&&finite(days,99999)?days:0,assisted:false,at:0});
      this.data.preferences.sound=this.backend.getItem('enduro-sound')!=='off';
    }
    write(){this.data.updatedAt=Date.now();try{if(!this.backend)throw Error('blocked');this.backend.setItem(KEY,JSON.stringify(this.data));this.available=true;return true;}catch{this.available=false;return false;}}
    setName(name){this.data.profile.name=cleanName(name);for(const r of this.data.records)if(r.playerId===this.data.profile.id)r.name=this.data.profile.name;this.write();}
    saveRun(game,id){const state=game.snapshot();if(!['ready','playing'].includes(state.mode))return false;this.data.run={id,savedAt:Date.now(),state};return this.write();}
    clearRun(){this.data.run=null;this.write();}
    record(game,id){
      if(game.kilometers<=0)return;
      const entry={id,playerId:this.data.profile.id,name:this.data.profile.name,km:game.kilometers,days:game.completedDays,assisted:game.assisted,at:Date.now()};
      this.mergeRecords([entry]);
    }
    mergeRecords(records){
      if(!Array.isArray(records)||records.length>MAX_RECORDS)return false;
      const clean=records.map(cleanRecord);if(clean.some(r=>!r))return false;
      const map=new Map(this.data.records.map(r=>[r.id,r]));
      for(const r of clean){const old=map.get(r.id);if(!old)map.set(r.id,r);else if(old.playerId===r.playerId){map.set(r.id,{...(r.at>=old.at?r:old),km:Math.max(old.km,r.km),days:Math.max(old.days,r.days),assisted:old.assisted||r.assisted});}}
      // Keep a balanced history so assisted scores cannot evict all classic results.
      const all=[...map.values()],sort=(a,b)=>b.km-a.km||b.days-a.days||b.at-a.at;
      this.data.records=[...all.filter(r=>!r.assisted).sort(sort).slice(0,50),...all.filter(r=>r.assisted).sort(sort).slice(0,50)];
      this.write();return true;
    }
    leaderboard(assisted=false){return this.data.records.filter(r=>r.assisted===assisted).sort((a,b)=>b.km-a.km||b.days-a.days).slice(0,20);}
    best(){const own=this.data.records.filter(r=>r.playerId===this.data.profile.id&&!r.assisted);return {km:Math.max(0,...own.map(r=>r.km)),days:Math.max(0,...own.map(r=>r.days))};}
    export(){return JSON.stringify(this.data,null,2);}
    import(bundle){const next=validateBundle(bundle),old=this.data.records;this.data=next;this.mergeRecords(old);this.write();return next;}
  }
  globalThis.EnduroStore=EnduroStore;globalThis.EnduroData={uid,cleanName,validateBundle,cleanRecord,MAX_BYTES};
  if(typeof module!=='undefined')module.exports={EnduroStore,uid,cleanName,validateBundle,cleanRecord};
})();
