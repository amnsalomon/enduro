(() => {
  'use strict';
  const $=id=>document.getElementById(id),{EnduroGame,POWERS}=Enduro;
  const store=new EnduroStore(),g=new EnduroGame(),keys=new Set(),touch=new Map();
  const audio=new EnduroAudio({enabled:store.data.preferences.sound});
  const renderer=new EnduroRenderer($('screen'),{quality:store.data.preferences.quality,dpr:window.devicePixelRatio||1,reducedMotion:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches});
  let runId=EnduroData.uid(),started=false,restored=false,dirty=true,dirtyUi=true,previousTime=0,accumulator=0,lastDraw=0,lastSync=0,lastSave=0,lastPeer=0;
  let activeDialog=null,resumeAfterDialog=false,localPause=false,remotePause=false,gamepadPause=false,gamepadGas=false,rankingAssisted=false,toastUntil=0,pendingTransfer=null;
  let myReady=false,theirReady=false,duel=null,opponent=null,opponentAt=0,countdown=0,renderFailed=false;
  const announce=text=>$('announcement').textContent=text;
  function toast(text){$('toast').textContent=text;$('toast').hidden=false;toastUntil=performance.now()+4000;announce(text);}
  function mark(){dirty=dirtyUi=true;}
  function focusTrack(){const focus=()=>{if(!activeDialog&&!document.hidden)$('screen').focus({preventScroll:true});};focus();requestAnimationFrame(focus);}
  function clearInput(){keys.clear();touch.clear();document.querySelectorAll('[data-control]').forEach(b=>b.classList.remove('held'));}
  function saveProgress(){
    if(started){store.record(g,runId);if(['playing','ready','paused'].includes(g.mode))store.saveRun(g,runId);else if(g.mode==='gameover')store.clearRun();}
    if(started&&peer.connected&&peer.purpose==='duel')peer.send('records',store.data.records);
    dirtyUi=true;
  }
  function stopDuel(notify=true){if(duel&&notify)peer.send('duel-stop',{id:duel.id});duel=null;opponent=null;myReady=theirReady=false;countdown=0;remotePause=false;updatePeerUi();mark();}
  function prepare({forDuel=false}={}){
    saveProgress();if(!forDuel)stopDuel();const powers=[...g.powers];g.reset(powers);runId=EnduroData.uid();started=true;restored=false;localPause=remotePause=false;accumulator=0;previousTime=0;clearInput();audio.init();mark();saveProgress();focusTrack();announce('Dia 1. Ultrapasse 200 carros.');
  }
  function pauseRace({notify=true,local=true}={}){
    if(local)localPause=true;g.pause();audio.mute();clearInput();accumulator=0;saveProgress();mark();
    if(notify&&duel)peer.send('duel-pause',{id:duel.id});
  }
  function resumeRace({notify=true}={}){
    if(activeDialog||document.hidden)return;
    localPause=false;
    if(remotePause){toast('O outro piloto está pausado. Aguarde para continuar.');return;}
    g.resume();restored=false;previousTime=0;accumulator=0;audio.init();mark();focusTrack();
    if(notify&&duel)peer.send('duel-resume',{id:duel.id});
  }
  function togglePause(){if(!started||g.mode==='gameover')return;if(g.mode==='paused')resumeRace();else pauseRace();focusTrack();}
  function openDialog(id){
    if(activeDialog===id)return;
    if(!activeDialog){resumeAfterDialog=g.mode==='playing'||g.mode==='ready';pauseRace();}
    else{const old=activeDialog;activeDialog=null;$(old).close();}
    activeDialog=id;$(id).showModal();audio.mute();mark();
    if(id==='codesDialog'){renderPowers();$('codeInput').focus();}
    if(id==='rankingDialog'){renderRanking();$('nickname').value=store.data.profile.name;}
  }
  function dialogClosed(id){
    if(activeDialog!==id)return;
    activeDialog=null;clearInput();const resume=resumeAfterDialog;resumeAfterDialog=false;
    if(resume&&!document.hidden)resumeRace();else focusTrack();mark();
  }
  function setSound(){audio.setEnabled(!audio.enabled);store.data.preferences.sound=audio.enabled;store.write();mark();focusTrack();}
  async function fullscreen(){
    try{if(document.fullscreenElement)await document.exitFullscreen();else if($('console').requestFullscreen)await $('console').requestFullscreen();else toast('Use a tela cheia do navegador.');}catch{toast('O navegador não permitiu tela cheia.');}
    mark();focusTrack();
  }
  function renderPowers(){
    $('powerBadges').replaceChildren();$('activePowers').replaceChildren();
    for(const [code,p] of Object.entries(POWERS))if(g.has(p.id)){
      const pill=document.createElement('span');pill.textContent=p.name.toUpperCase();$('powerBadges').append(pill);
      const card=document.createElement('div');card.className='power-card';const content=document.createElement('div'),title=document.createElement('strong'),description=document.createElement('p'),button=document.createElement('button');title.textContent=p.name;description.textContent=p.description;content.append(title,description);button.type='button';button.textContent='DESATIVAR';button.addEventListener('click',()=>{g.applyCode(code);renderPowers();saveProgress();mark();$('codeInput').focus();});card.append(content,button);$('activePowers').append(card);
    }
    if(!g.powers.size){const p=document.createElement('p');p.className='note';p.textContent='Nenhum poder ativo. Você está no modo clássico.';$('activePowers').append(p);}
  }
  function applyCodes(){
    const codes=$('codeInput').value.trim().split(/[\s,;]+/).filter(Boolean).slice(0,12);if(!codes.length)return;
    const messages=codes.map(code=>g.applyCode(code).message);$('codeResult').textContent=messages.join('\n');$('codeInput').value='';renderPowers();saveProgress();mark();audio.tone(660,.12,'triangle');$('codeInput').focus();
  }
  function renderRanking(){
    $('leaderboard').replaceChildren();$('classicTab').setAttribute('aria-pressed',String(!rankingAssisted));$('powersTab').setAttribute('aria-pressed',String(rankingAssisted));
    const records=store.leaderboard(rankingAssisted);
    if(!records.length){const p=document.createElement('p');p.className='empty';p.textContent='Sua próxima corrida pode abrir este ranking.';$('leaderboard').append(p);}
    records.forEach((r,i)=>{const li=document.createElement('li'),position=document.createElement('span'),name=document.createElement('span'),small=document.createElement('small'),score=document.createElement('b');position.textContent=String(i+1).padStart(2,'0');name.textContent=r.name;small.textContent=r.days+' dias completos';name.append(small);score.textContent=r.km.toFixed(1)+' km';li.append(position,name,score);$('leaderboard').append(li);});
  }
  function useSavedRun(){
    const saved=store.data.run;
    if(saved&&g.restore(saved.state)){runId=saved.id;started=true;restored=true;localPause=true;}
    else{g.reset();g.mode='title';runId=EnduroData.uid();started=restored=false;}
    clearInput();audio.mute();countdown=0;mark();renderPowers();
  }
  function receiveTransfer(value){
    try{const bundle=EnduroData.validateBundle(value);pendingTransfer=bundle;$('transferSummary').textContent='Perfil: '+bundle.profile.name+'. '+(bundle.run?'Dia '+bundle.run.state.day+', '+bundle.run.state.kilometers.toFixed(1)+' km.':'Sem corrida em andamento.')+' '+bundle.records.length+' registros no ranking.';openDialog('transferDialog');}catch(e){toast(e.message);}
  }
  function updatePeerUi(){
    if(typeof peer==='undefined')return;
    $('connectionDot').classList.toggle('connected',peer.connected);$('disconnect').disabled=!peer.pc;$('connectedActions').hidden=!peer.connected;
    $('readyDuel').hidden=peer.purpose!=='duel';$('duelInfo').hidden=peer.purpose!=='duel';$('sendProgress').hidden=peer.purpose!=='sync';
    $('readyDuel').textContent=myReady?'AGUARDANDO O OUTRO PILOTO…':'PRONTO PARA O DUELO';$('readyDuel').disabled=myReady;
  }
  function beginDuel(id){
    if(activeDialog){const d=activeDialog;activeDialog=null;resumeAfterDialog=false;$(d).close();}
    prepare({forDuel:true});duel={id};countdown=3;localPause=remotePause=false;myReady=theirReady=false;opponent=null;updatePeerUi();mark();toast('Duelo fantasma: prepare-se!');
  }
  function maybeStartDuel(){if(peer.host&&myReady&&theirReady&&!duel){const id=EnduroData.uid();if(peer.send('duel-start',{id}))beginDuel(id);}}
  const peer=new EnduroPeer({
    onStatus:text=>{$('peerStatus').textContent=text;},
    onOpen:()=>{updatePeerUi();peer.send('hello',{name:store.data.profile.name});if(peer.purpose==='duel')peer.send('records',store.data.records);},
    onClose:()=>{if(duel){duel=null;opponent=null;remotePause=false;pauseRace({notify:false});toast('O rival desconectou. Você pode continuar a corrida sozinho.');}myReady=theirReady=false;updatePeerUi();},
    onMessage:(type,payload)=>{
      if(type==='hello'&&payload&&typeof payload.name==='string'){$('peerStatus').textContent='Conectado a '+EnduroData.cleanName(payload.name)+'.';}
      if(type==='records'&&peer.purpose==='duel'){if(store.mergeRecords(payload)){renderRanking();dirtyUi=true;}}
      if(type==='progress'&&peer.purpose==='sync'&&!pendingTransfer)receiveTransfer(payload);
      if(type==='ready'&&peer.purpose==='duel'&&payload===true&&!duel){theirReady=true;maybeStartDuel();}
      if(type==='duel-start'&&!peer.host&&peer.purpose==='duel'&&myReady&&payload&&typeof payload.id==='string'&&/^[\w-]{1,80}$/.test(payload.id))beginDuel(payload.id);
      if(!duel||!payload||payload.id!==duel.id)return;
      if(type==='state'){
        if(!Number.isFinite(payload.distance)||payload.distance<0||payload.distance>1e12||!Number.isFinite(payload.x)||Math.abs(payload.x)>1.22||!Number.isFinite(payload.km)||payload.km<0||payload.km>1e9||!['playing','paused','ready','gameover'].includes(payload.mode)||typeof payload.name!=='string')return;
        opponent={distance:payload.distance,x:payload.x,km:payload.km,name:EnduroData.cleanName(payload.name),mode:payload.mode,assisted:payload.assisted===true};opponentAt=performance.now();dirtyUi=true;
        if(opponent.mode==='gameover'&&g.mode==='gameover')toast(g.kilometers>opponent.km?'Você foi mais longe!':g.kilometers<opponent.km?'O rival foi mais longe. Tente novamente!':'Duelo empatado!');
      }
      if(type==='duel-pause'){remotePause=true;pauseRace({notify:false,local:false});}
      if(type==='duel-resume'){remotePause=false;if(!localPause&&!activeDialog&&!document.hidden)resumeRace({notify:false});}
      if(type==='duel-stop'){stopDuel(false);pauseRace({notify:false});toast('O duelo terminou. Sua corrida continua disponível.');}
    }
  });
  function readInput(){
    const held=name=>[...touch.values()].includes(name);
    let steer=(keys.has('ArrowRight')||keys.has('KeyD')||held('right')?1:0)-(keys.has('ArrowLeft')||keys.has('KeyA')||held('left')?1:0);
    let accelerate=keys.has('Space')||keys.has('ArrowUp')||keys.has('KeyW')||held('accelerate'),brake=keys.has('ArrowDown')||keys.has('KeyS')||held('brake');
    let pads=[];try{pads=navigator.getGamepads?.()||[];}catch{}
    const pad=Array.from(pads).find(p=>p&&p.mapping==='standard');
    if(pad&&!activeDialog&&!document.hidden&&document.hasFocus()){
      const axis=Number(pad.axes[0])||0,padX=(pad.buttons[15]?.pressed?1:0)-(pad.buttons[14]?.pressed?1:0);if(Math.abs(axis)>.18)steer=axis;else if(padX)steer=padX;
      const gas=!!(pad.buttons[0]?.pressed||pad.buttons[7]?.pressed||pad.buttons[12]?.pressed),pause=!!pad.buttons[9]?.pressed;
      accelerate=accelerate||gas;brake=brake||!!(pad.buttons[6]?.pressed||pad.buttons[13]?.pressed)||(pad.axes[1]||0)>.5;
      if(pause&&!gamepadPause){if(!started||g.mode==='gameover')prepare();else togglePause();}
      if(gas&&!gamepadGas&&(!started||g.mode==='gameover'))prepare();gamepadPause=pause;gamepadGas=gas;
    }else{gamepadPause=gamepadGas=false;}
    return {steer,accelerate,brake};
  }
  function processEvents(){
    let trophy=false,newDay=false;
    for(const e of g.takeEvents()){
      if(e.type==='collision')audio.tone(110,.3,'sawtooth',.04,22);
      if(e.type==='explosion')audio.tone(140,.5,'sawtooth',.05,18);
      if(e.type==='shield')audio.tone(480,.12,'triangle',.018,240);
      if(e.type==='qualified'){audio.tone(660,.4,'triangle',.03,1320);toast('META CUMPRIDA · Continue até amanhecer');}
      if(e.type==='trophy')trophy=true;
      if(e.type==='newDay'){newDay=true;saveProgress();audio.tone(880,.3,'triangle',.03,1175);}
      if(e.type==='weather')announce(e.name+(e.phase==='ice'?'. Aderência reduzida.':e.phase==='fog'?'. Visibilidade reduzida.':'.'));
      if(e.type==='gameover'){audio.mute();audio.tone(220,.6,'sawtooth',.025,55);clearInput();saveProgress();peer.send('records',store.data.records);announce('Fim de corrida. '+g.kilometers.toFixed(1)+' quilômetros.');}
      if(e.type==='power')renderPowers();
      mark();
    }
    if(trophy){audio.tone(1320,.7,'triangle',.035,1760);toast('TROFÉU DE RESISTÊNCIA · 5 dias completos! Dia '+g.day+'.');}
    else if(newDay)toast('DIA '+g.day+' · Nova meta: 300 ultrapassagens');
  }
  function sync(){
    const best=store.best();$('record').textContent=best.km.toFixed(1)+' KM';$('recordDays').textContent=best.days+' DIAS COMPLETOS';
    $('day').textContent='DIA '+String(g.day).padStart(2,'0');$('weather').textContent=g.phase.name;$('distance').textContent=g.kilometers.toFixed(1)+' KM';$('speed').textContent=String(g.kph).padStart(3,'0');$('remaining').textContent=g.qualified?'✓':String(g.remaining).padStart(3,'0');$('quotaLabel').textContent=g.qualified?'META CUMPRIDA':'ULTRAPASSAGENS RESTANTES';$('quotaProgress').style.width=Math.min(100,g.passed/g.required*100)+'%';
    $('resolutionBadge').textContent=renderer.canvas.width===3840?'4K UHD':renderer.canvas.width===1920?'FULL HD':renderer.canvas.width+' × '+renderer.canvas.height;
    $('sound').textContent=audio.enabled?'SOM ON':'SOM OFF';$('sound').setAttribute('aria-pressed',String(audio.enabled));$('quality').value=renderer.quality;
    const paused=g.mode==='paused',ended=g.mode==='gameover';$('pause').disabled=!started||ended;$('pause').textContent=paused?'▶ CONTINUAR':'Ⅱ PAUSAR';$('saveStatus').textContent=store.available?(restored?'CORRIDA RECUPERADA':'SALVAMENTO AUTOMÁTICO'):'SEM ARMAZENAMENTO · EXPORTE UM BACKUP';
    let status='PRONTO PARA A ESTRADA';if(g.mode==='ready')status=countdown>0?'LARGADA EM '+Math.ceil(countdown):'SEGURE ESPAÇO OU ACELERAR PARA LARGAR';if(g.mode==='playing')status=g.qualified?'BANDEIRAS VERDES · CONTINUE ATÉ AMANHECER':g.has('time')?'RELÓGIO CONGELADO · TEMPO PARA DESATIVAR':g.offroad&&!g.has('grip')?'VOLTE PARA A PISTA':g.remaining+' CARROS · '+(g.assisted?'CORRIDA COM PODERES':'MODO CLÁSSICO');if(paused)status=remotePause?'PAUSADO · AGUARDANDO O OUTRO PILOTO':'PAUSADO · P PARA CONTINUAR';if(ended)status='AMANHECEU · FALTARAM '+g.remaining+' CARROS';$('status').textContent=status;
    $('overlay').hidden=!(paused||ended||!started);$('newInstead').hidden=!restored;$('overlayKicker').textContent=restored?'SEU PRÓXIMO CAPÍTULO':ended?'ATÉ A PRÓXIMA LARGADA':paused?'RESPIRA. A ESTRADA ESPERA.':'O CLÁSSICO. UM NOVO HORIZONTE.';
    $('overlayTitle').textContent=restored?'De onde você parou.':ended?'Fim de corrida.':paused?'Uma pausa.':'Vá além.';
    $('overlayText').textContent=restored?'Dia '+g.day+' · '+g.kilometers.toFixed(1)+' km · '+g.remaining+' carros para a meta.':ended?g.kilometers.toFixed(1)+' km · '+g.completedDays+' dias completos · '+(g.assisted?'com poderes':'clássico'):paused?(remotePause?'O outro piloto pausou o duelo.':'Seu progresso está guardado neste navegador.'):'200 carros. Um dia. Uma estrada sem fim.';
    $('continue').textContent=paused?(restored?'RETOMAR CORRIDA →':'CONTINUAR →'):ended?'TENTAR NOVAMENTE →':'LARGAR →';$('overlayHint').textContent=paused?'Ç PARA CÓDIGOS · P PARA CONTINUAR':'ESPAÇO PARA ACELERAR · Ç PARA SUPERPODERES';
    const live=opponent&&performance.now()-opponentAt<3500;$('opponent').hidden=!duel||!live;if(live)$('opponent').textContent=opponent.name+' · '+opponent.km.toFixed(1)+' KM'+(opponent.assisted?' · PODERES':'');
    dirtyUi=false;
  }
  $('reset').addEventListener('click',()=>prepare());$('newInstead').addEventListener('click',()=>prepare());$('continue').addEventListener('click',()=>{if(g.mode==='paused')resumeRace();else prepare();});$('pause').addEventListener('click',togglePause);
  $('sound').addEventListener('click',setSound);$('fullscreen').addEventListener('click',fullscreen);$('codes').addEventListener('click',()=>openDialog('codesDialog'));$('help').addEventListener('click',()=>openDialog('helpDialog'));$('ranking').addEventListener('click',()=>openDialog('rankingDialog'));$('connect').addEventListener('click',()=>openDialog('peerDialog'));
  for(const dialog of document.querySelectorAll('dialog')){dialog.addEventListener('close',()=>dialogClosed(dialog.id));dialog.addEventListener('cancel',()=>clearInput());}
  document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.close).close()));
  $('codeForm').addEventListener('submit',e=>{e.preventDefault();applyCodes();});
  $('quality').addEventListener('change',()=>{renderer.setQuality($('quality').value,window.devicePixelRatio||1);store.data.preferences.quality=renderer.quality;store.write();mark();focusTrack();});
  $('nickname').addEventListener('change',()=>{store.setName($('nickname').value);$('nickname').value=store.data.profile.name;renderRanking();peer.send('hello',{name:store.data.profile.name});});
  $('classicTab').addEventListener('click',()=>{rankingAssisted=false;renderRanking();});$('powersTab').addEventListener('click',()=>{rankingAssisted=true;renderRanking();});
  $('exportSave').addEventListener('click',()=>{saveProgress();const blob=new Blob([store.export()],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='enduro-progresso.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  $('importSave').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>EnduroData.MAX_BYTES)throw Error('Arquivo muito grande.');receiveTransfer(await file.text());}catch(error){$('importStatus').textContent=error.message;}finally{e.target.value='';}});
  $('acceptTransfer').addEventListener('click',()=>{if(!pendingTransfer)return;stopDuel();store.import(pendingTransfer);pendingTransfer=null;resumeAfterDialog=false;$('transferDialog').close();useSavedRun();audio.setEnabled(store.data.preferences.sound);renderer.setQuality(store.data.preferences.quality,window.devicePixelRatio||1);toast('Progresso importado. Pronto para continuar.');focusTrack();});
  $('transferDialog').addEventListener('close',()=>{pendingTransfer=null;});
  $('createOffer').addEventListener('click',async()=>{const b=$('createOffer');b.disabled=true;try{$('localSignal').value=await peer.invite($('peerPurpose').value);$('remoteSignal').value='';}catch(e){$('peerStatus').textContent=e.message;}finally{b.disabled=false;updatePeerUi();}});
  $('acceptSignal').addEventListener('click',async()=>{const b=$('acceptSignal');b.disabled=true;try{const signal=await peer.accept($('remoteSignal').value);if(signal)$('localSignal').value=signal;$('peerPurpose').value=peer.purpose;}catch(e){$('peerStatus').textContent=e.message;}finally{b.disabled=false;updatePeerUi();}});
  $('copySignal').addEventListener('click',async()=>{if(!$('localSignal').value)return;try{await navigator.clipboard.writeText($('localSignal').value);$('peerStatus').textContent='Código copiado. Envie ao outro navegador.';}catch{$('localSignal').select();$('peerStatus').textContent='Selecione e copie o código manualmente.';}});
  $('disconnect').addEventListener('click',()=>{peer.close();$('peerStatus').textContent='Desconectado.';updatePeerUi();});
  $('sendProgress').addEventListener('click',()=>{saveProgress();$('peerStatus').textContent=peer.send('progress',store.data)?'Progresso enviado. O outro dispositivo precisa aceitar.':'Não foi possível enviar. Reconecte e tente novamente.';});
  $('readyDuel').addEventListener('click',()=>{if(!peer.connected)return;if(duel)stopDuel();myReady=true;peer.send('ready',true);updatePeerUi();maybeStartDuel();});
  document.addEventListener('keydown',e=>{
    const editing=e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement||e.target instanceof HTMLSelectElement||e.target?.isContentEditable;
    if(activeDialog||editing||e.ctrlKey||e.metaKey||e.altKey)return;
    if((e.key||'').toLowerCase()==='ç'||e.code==='F2'){e.preventDefault();if(!e.repeat)openDialog('codesDialog');return;}
    if(e.target instanceof HTMLButtonElement&&(e.code==='Enter'||e.code==='Space'))return;
    const codes=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyA','KeyD','KeyW','KeyS','Space','Enter','KeyR','KeyP','Escape','KeyM','KeyF'];if(!codes.includes(e.code))return;e.preventDefault();
    if(!e.repeat){if(e.code==='Enter'||e.code==='KeyR'){prepare();return;}if(e.code==='KeyP'||e.code==='Escape'){togglePause();return;}if(e.code==='KeyM'){setSound();return;}if(e.code==='KeyF'){fullscreen();return;}if((!started||g.mode==='gameover')&&['Space','ArrowUp','KeyW'].includes(e.code))prepare();}
    keys.add(e.code);audio.init();
  });
  document.addEventListener('keyup',e=>keys.delete(e.code));
  document.querySelectorAll('[data-control]').forEach(button=>{
    button.addEventListener('pointerdown',e=>{e.preventDefault();if(activeDialog)return;if(!started||g.mode==='gameover')prepare();audio.init();button.setPointerCapture(e.pointerId);touch.set(e.pointerId,button.dataset.control);button.classList.add('held');});
    const release=e=>{touch.delete(e.pointerId);if(![...touch.values()].includes(button.dataset.control))button.classList.remove('held');};['pointerup','pointercancel','lostpointercapture'].forEach(n=>button.addEventListener(n,release));
  });
  function suspend(){resumeAfterDialog=false;pauseRace();audio.mute();previousTime=0;}
  window.addEventListener('blur',suspend);document.addEventListener('visibilitychange',()=>{if(document.hidden)suspend();else{previousTime=0;mark();}});window.addEventListener('pagehide',()=>{saveProgress();audio.mute();});
  window.addEventListener('resize',()=>{if(renderer.quality==='auto')renderer.setQuality('auto',window.devicePixelRatio||1);mark();});
  document.addEventListener('fullscreenchange',()=>{$('fullscreen').textContent=document.fullscreenElement?'⛶ SAIR':'⛶ TELA CHEIA';mark();focusTrack();});
  function frame(now){
    requestAnimationFrame(frame);
    const elapsed=previousTime?Math.min(Math.max(0,(now-previousTime)/1000),.1):0;previousTime=now;
    const controls=readInput();
    if(!activeDialog&&!document.hidden&&!localPause&&!remotePause&&countdown>0){countdown=Math.max(0,countdown-elapsed);dirtyUi=true;if(countdown===0){g.start();toast('VALENDO!');}}
    if(!activeDialog&&!document.hidden&&countdown===0){accumulator+=elapsed;while(accumulator>=1/60){g.step(1/60,controls);accumulator-=1/60;}}else accumulator=0;
    processEvents();
    if(g.mode==='playing')audio.step(g,now);
    if(!document.hidden&&(dirty||g.mode==='playing')&&(now-lastDraw>=1000/60-1||dirty)&&!renderFailed){
      try{renderer.draw(g,now,controls.brake,duel&&now-opponentAt<3500?opponent:null);dirty=false;lastDraw=now;}catch(e){renderFailed=true;pauseRace();console.error(e);toast('Falha no desenho. Recarregue para recuperar sua corrida.');}
    }
    if(dirtyUi||g.mode==='playing'&&now-lastSync>100){sync();lastSync=now;}
    if(started&&g.mode==='playing'&&now-lastSave>5000){saveProgress();lastSave=now;}
    if(duel&&peer.connected&&now-lastPeer>100){peer.send('state',{id:duel.id,name:store.data.profile.name,distance:g.distance,x:g.x,km:g.kilometers,mode:g.mode,assisted:g.assisted});lastPeer=now;}
    if(toastUntil&&now>toastUntil){$('toast').hidden=true;toastUntil=0;}
  }
  useSavedRun();updatePeerUi();sync();requestAnimationFrame(frame);
})();
