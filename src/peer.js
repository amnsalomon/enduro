/* Manual signaling keeps multiplayer usable on static hosting without account keys. */
(() => {
  'use strict';
  const PREFIX='ENDURO1.',MAX_SIGNAL=24000,MAX_PACKET=300000;
  const token=(payload)=>PREFIX+btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  function decode(value){
    const v=String(value).trim();if(v.length>MAX_SIGNAL||!v.startsWith(PREFIX))throw Error('Código de conexão inválido.');
    let d;try{d=JSON.parse(decodeURIComponent(escape(atob(v.slice(PREFIX.length)))));}catch{throw Error('Código de conexão incompleto ou inválido.');}
    if(d.v!==1||!['offer','answer'].includes(d.type)||typeof d.sdp!=='string'||d.sdp.length>16000||!d.sdp.startsWith('v=0')||!['duel','sync'].includes(d.purpose))throw Error('Formato de conexão incompatível.');
    return d;
  }
  class EnduroPeer{
    constructor(options={}){this.Peer=options.Peer||globalThis.RTCPeerConnection;this.onStatus=options.onStatus||(()=>{});this.onMessage=options.onMessage||(()=>{});this.onOpen=options.onOpen||(()=>{});this.onClose=options.onClose||(()=>{});this.pc=null;this.channel=null;this.host=false;this.purpose='duel';this.timer=null;this.session=0;}
    get connected(){return this.channel?.readyState==='open';}
    get supported(){return !!this.Peer;}
    open(purpose,host){
      this.close();if(!this.Peer)throw Error('Este navegador não oferece conexão direta. Use os arquivos de backup.');
      this.purpose=purpose;this.host=host;const session=++this.session;
      const pc=this.pc=new this.Peer({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});
      pc.ondatachannel=e=>{if(this.pc===pc)this.attach(e.channel);};
      pc.onconnectionstatechange=()=>{if(this.pc!==pc)return;if(['failed','closed','disconnected'].includes(pc.connectionState)){this.onStatus('Conexão interrompida. Crie um novo convite. Algumas redes bloqueiam conexões diretas.');this.close();}};
      this.timer=setTimeout(()=>{if(this.session===session&&!this.connected){this.onStatus('Conexão não concluída. Confira os códigos ou tente a mesma rede Wi-Fi.');this.close();}},90000);
      this.onStatus('Preparando conexão…');return pc;
    }
    attach(channel){
      this.channel=channel;
      channel.onopen=()=>{clearTimeout(this.timer);this.onStatus('Conectado. '+(this.purpose==='duel'?'Compartilhe recordes ou prepare o duelo.':'Envie seu progresso para o outro dispositivo.'));this.onOpen();};
      channel.onclose=()=>{if(this.channel===channel){this.channel=null;this.onClose();}};
      channel.onerror=()=>this.onStatus('Falha de rede. Reconecte para continuar.');
      channel.onmessage=e=>{
        if(typeof e.data!=='string'||e.data.length>MAX_PACKET)return;
        try{const packet=JSON.parse(e.data);if(packet&&packet.v===1&&typeof packet.type==='string'&&packet.type.length<30)this.onMessage(packet.type,packet.payload);}catch{this.onStatus('Uma mensagem inválida foi ignorada.');}
      };
    }
    gather(pc){return new Promise((resolve,reject)=>{
      let timeout;const done=()=>{clearTimeout(timeout);pc.removeEventListener('icegatheringstatechange',check);if(this.pc!==pc){reject(Error('Convite cancelado.'));return;}if(!(pc.localDescription?.sdp||'').includes('a=candidate:')){this.close();reject(Error('Este navegador ou rede não forneceu uma rota de conexão direta. Tente outra rede Wi-Fi ou transfira o progresso por backup.'));return;}resolve();};
      const check=()=>{if(pc.iceGatheringState==='complete')done();};
      timeout=setTimeout(done,7000);pc.addEventListener('icegatheringstatechange',check);check();
    });}
    async invite(purpose='duel'){
      const pc=this.open(purpose==='sync'?'sync':'duel',true);this.attach(pc.createDataChannel('enduro',{ordered:true}));
      await pc.setLocalDescription(await pc.createOffer());await this.gather(pc);
      this.onStatus('Convite pronto. Envie ao outro navegador e cole a resposta aqui.');return token({v:1,type:'offer',sdp:pc.localDescription.sdp,purpose:this.purpose});
    }
    async accept(value){
      const signal=decode(value);
      if(signal.type==='offer'){
        const pc=this.open(signal.purpose,false);await pc.setRemoteDescription({type:'offer',sdp:signal.sdp});await pc.setLocalDescription(await pc.createAnswer());await this.gather(pc);
        this.onStatus('Resposta pronta. Devolva este código ao criador do convite.');return token({v:1,type:'answer',sdp:pc.localDescription.sdp,purpose:this.purpose});
      }
      if(!this.pc||!this.host||this.pc.signalingState!=='have-local-offer'||signal.purpose!==this.purpose)throw Error('Crie um convite primeiro ou cole a resposta correspondente.');
      await this.pc.setRemoteDescription({type:'answer',sdp:signal.sdp});this.onStatus('Conectando…');return null;
    }
    send(type,payload){
      if(!this.connected)return false;
      try{const value=JSON.stringify({v:1,type,payload});if(value.length>MAX_PACKET||this.channel.bufferedAmount>MAX_PACKET)return false;this.channel.send(value);return true;}catch{return false;}
    }
    close(){
      clearTimeout(this.timer);const channel=this.channel,pc=this.pc;this.channel=null;this.pc=null;this.session++;
      if(channel){channel.onclose=null;try{channel.close();}catch{}}
      if(pc){pc.onconnectionstatechange=null;try{pc.close();}catch{}}
      if(channel||pc)this.onClose();
    }
  }
  globalThis.EnduroPeer=EnduroPeer;if(typeof module!=='undefined')module.exports={EnduroPeer,decode,token};
})();
