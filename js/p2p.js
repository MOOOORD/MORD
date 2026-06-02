// p2p.js — WebRTC peer-to-peer client, no server needed
// Manual copy-paste signaling: host generates offer, guest returns answer

export class P2PClient {
  constructor() {
    this.pc = null;
    this.dc = null;
    this.handlers = new Map();
    this._state = 'disconnected';
    this._offer = null;
    this._pendingCandidates = [];
  }

  get connectionState() { return this._state; }

  // ---- WebRTC lifecycle ----

  async createOffer() {
    this._makePC();
    this.dc = this.pc.createDataChannel('game');
    this._setupDataChannel();

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    // Wait for ICE candidates to collect
    await this._waitForIceComplete();

    this._state = 'signaling';
    return btoa(JSON.stringify(this.pc.localDescription));
  }

  async acceptOffer(offerB64) {
    this._makePC();

    this.pc.ondatachannel = (e) => {
      this.dc = e.channel;
      this._setupDataChannel();
    };

    const desc = JSON.parse(atob(offerB64));
    await this.pc.setRemoteDescription(new RTCSessionDescription(desc));

    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);

    await this._waitForIceComplete();

    this._state = 'signaling';
    return btoa(JSON.stringify(this.pc.localDescription));
  }

  async setAnswer(answerB64) {
    const desc = JSON.parse(atob(answerB64));
    await this.pc.setRemoteDescription(new RTCSessionDescription(desc));
    // Connection will complete when dc opens
  }

  _makePC() {
    this.pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });

    this.pc.oniceconnectionstatechange = () => {
      if (this.pc.iceConnectionState === 'disconnected' ||
          this.pc.iceConnectionState === 'failed') {
        if (this._state === 'connected') {
          this._state = 'disconnected';
          this._emit('peer_disconnected', {});
        }
      }
    };
  }

  _setupDataChannel() {
    this.dc.onopen = () => {
      this._state = 'connected';
      this._emit('*', { type: 'connected' });
    };

    this.dc.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      this._emit(msg.type, msg);
      this._emit('*', msg);
    };

    this.dc.onclose = () => {
      this._state = 'disconnected';
      this._emit('peer_disconnected', {});
    };
  }

  _waitForIceComplete() {
    return new Promise((resolve) => {
      if (this.pc.iceGatheringState === 'complete') {
        // Tiny delay to collect final candidates
        setTimeout(resolve, 200);
        return;
      }
      const check = setInterval(() => {
        if (this.pc.iceGatheringState === 'complete') {
          clearInterval(check);
          setTimeout(resolve, 200);
        }
      }, 100);
      // Safety timeout
      setTimeout(() => { clearInterval(check); resolve(); }, 3000);
    });
  }

  // ---- Same interface as NetworkClient ----

  connect() {
    // P2P: connection is established via createOffer/acceptOffer/setAnswer
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
