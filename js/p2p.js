// p2p.js — WebRTC peer-to-peer client, no server needed
// Manual copy-paste signaling: host generates offer, guest returns answer

export class P2PClient {
  constructor() {
    this.pc = null;
    this.dc = null;
    this.handlers = new Map();
    this._state = 'disconnected';
  }

  get connectionState() { return this._state; }

  // ---- WebRTC lifecycle ----

  async createOffer() {
    this._makePC();
    this.dc = this.pc.createDataChannel('game');
    this._setupDataChannel();

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    await this._waitForIceComplete();

    if (this._iceFailed) {
      throw new Error('网络连接失败，请检查防火墙设置');
    }

    this._state = 'signaling';
    return btoa(JSON.stringify(this.pc.localDescription));
  }

  async acceptOffer(offerB64) {
    this._makePC();

    this.pc.ondatachannel = (e) => {
      this.dc = e.channel;
      this._setupDataChannel();
    };

    let desc;
    try {
      desc = JSON.parse(atob(offerB64));
    } catch {
      throw new Error('连接码格式无效，请检查是否完整复制');
    }

    await this.pc.setRemoteDescription(new RTCSessionDescription(desc));
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);

    await this._waitForIceComplete();

    if (this._iceFailed) {
      throw new Error('网络连接失败，请检查防火墙设置');
    }

    this._state = 'signaling';
    return btoa(JSON.stringify(this.pc.localDescription));
  }

  async setAnswer(answerB64) {
    let desc;
    try {
      desc = JSON.parse(atob(answerB64));
    } catch {
      throw new Error('回应码格式无效，请检查是否完整复制');
    }
    await this.pc.setRemoteDescription(new RTCSessionDescription(desc));
  }

  _makePC() {
    this._iceFailed = false;
    this.pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.miwifi.com:3478' },
        { urls: 'stun:stun.qq.com:3478' },
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun.syncthing.net:3478' },
      ],
      iceCandidatePoolSize: 2,
    });

    this.pc.oniceconnectionstatechange = () => {
      const s = this.pc.iceConnectionState;
      if (s === 'failed' || s === 'disconnected') {
        if (this._state === 'signaling') {
          this._iceFailed = true;
          this._state = 'disconnected';
          this._emit('peer_disconnected', {});
        } else if (this._state === 'connected') {
          this._state = 'disconnected';
          this._emit('peer_disconnected', {});
        }
      }
    };

    this.pc.onicegatheringstatechange = () => {
      if (this.pc.iceGatheringState === 'complete') {
        // Check if we got any candidates
        const localDesc = this.pc.localDescription;
        if (localDesc && localDesc.sdp) {
          const hasCand = localDesc.sdp.includes('a=candidate');
          if (!hasCand) {
            this._iceFailed = true;
          }
        }
      }
    };
  }

  _setupDataChannel() {
    this.dc.onopen = () => {
      this._state = 'connected';
      // Quick connectivity check — send a ping
      this.send('ping', {});
      this._emit('*', { type: 'connected' });
    };

    this.dc.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      if (msg.type === 'ping') {
        this.send('pong', {});
      }
      this._emit(msg.type, msg);
      this._emit('*', msg);
    };

    this.dc.onclose = () => {
      this._state = 'disconnected';
      this._emit('peer_disconnected', {});
    };

    this.dc.onerror = () => {
      // onclose will fire after this
    };
  }

  _waitForIceComplete() {
    return new Promise((resolve) => {
      if (this.pc.iceGatheringState === 'complete') {
        setTimeout(resolve, 200);
        return;
      }
      if (this._iceFailed) { resolve(); return; }

      const check = setInterval(() => {
        if (this.pc.iceGatheringState === 'complete' || this._iceFailed) {
          clearInterval(check);
          setTimeout(resolve, 200);
        }
      }, 100);

      setTimeout(() => {
        clearInterval(check);
        // If still gathering after timeout, check for candidates
        const ld = this.pc.localDescription;
        if (ld && ld.sdp && !ld.sdp.includes('a=candidate')) {
          this._iceFailed = true;
        }
        resolve();
      }, 5000);
    });
  }

  // ---- Same interface as NetworkClient ----

  connect() {
    if (this._state === 'connected') return;
  }

  disconnect() {
    if (this.dc) { this.dc.close(); this.dc = null; }
    if (this.pc) { this.pc.close(); this.pc = null; }
    this._state = 'disconnected';
  }

  send(type, data = {}) {
    if (this.dc && this.dc.readyState === 'open') {
      this.dc.send(JSON.stringify({ type, ...data }));
    }
  }

  on(type, callback) {
    if (!this.handlers.has(type)) this.handlers.set(type, []);
    this.handlers.get(type).push(callback);
  }

  off(type, callback) {
    const cbs = this.handlers.get(type);
    if (!cbs) return;
    const idx = cbs.indexOf(callback);
    if (idx !== -1) cbs.splice(idx, 1);
  }

  _emit(type, data) {
    const cbs = this.handlers.get(type);
    if (cbs) cbs.forEach(fn => fn(data));
  }
}
