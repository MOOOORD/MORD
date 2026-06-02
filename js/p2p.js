// p2p.js — WebRTC peer-to-peer client, no server needed
// Manual copy-paste signaling: host generates offer, guest returns answer
// Falls back to free TURN relay if STUN hole-punch fails

export class P2PClient {
  constructor() {
    this.pc = null;
    this.dc = null;
    this.handlers = new Map();
    this._state = 'disconnected';
    this._statusText = '';
    this._onStatus = null;
  }

  get connectionState() { return this._state; }
  get statusText() { return this._statusText; }

  onStatusChange(fn) { this._onStatus = fn; }

  _setStatus(s) {
    this._statusText = s;
    if (this._onStatus) this._onStatus(s);
  }

  // ---- WebRTC lifecycle ----

  async createOffer() {
    this._makePC();
    this.dc = this.pc.createDataChannel('game');
    this._setupDataChannel();

    this._setStatus('正在生成连接...');
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    this._setStatus('正在收集网络信息...');
    await this._waitForIceComplete();

    if (this._iceFailed) {
      throw new Error('网络连接失败，请检查防火墙设置');
    }

    this._state = 'signaling';
    this._setStatus('等待对方连接...');

    const ld = this.pc.localDescription;
    if (!ld || ld.type !== 'offer') {
      throw new Error('生成连接失败，请刷新重试');
    }
    return btoa(encodeURIComponent(JSON.stringify(ld)));
  }

  async acceptOffer(offerB64) {
    this._makePC();

    this.pc.ondatachannel = (e) => {
      this.dc = e.channel;
      this._setupDataChannel();
    };

    this._setStatus('正在解析连接...');
    let raw;
    try {
      raw = decodeURIComponent(atob(offerB64));
    } catch {
      throw new Error('连接码格式无效，请检查是否完整复制');
    }

    let desc;
    try {
      desc = JSON.parse(raw);
    } catch {
      throw new Error('连接码格式无效，请检查是否完整复制');
    }

    if (desc.type !== 'offer') {
      throw new Error('连接码类型错误，请确认复制的是"连接码"而非"回应码"');
    }

    this._setStatus('正在建立连接...');
    await this.pc.setRemoteDescription(new RTCSessionDescription(desc));
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);

    this._setStatus('正在收集网络信息...');
    await this._waitForIceComplete();

    if (this._iceFailed) {
      throw new Error('网络连接失败，请检查防火墙设置');
    }

    this._state = 'signaling';
    this._setStatus('等待对方确认...');

    const ld = this.pc.localDescription;
    if (!ld || ld.type !== 'answer') {
      throw new Error('生成回应失败，请刷新重试');
    }
    return btoa(encodeURIComponent(JSON.stringify(ld)));
  }

  async setAnswer(answerB64) {
    let raw;
    try {
      raw = decodeURIComponent(atob(answerB64));
    } catch {
      throw new Error('回应码格式无效，请检查是否完整复制');
    }

    let desc;
    try {
      desc = JSON.parse(raw);
    } catch {
      throw new Error('回应码格式无效，请检查是否完整复制');
    }

    if (desc.type !== 'answer') {
      throw new Error('回应码类型错误，请确认复制的是"回应码"而非"连接码"');
    }

    const st = this.pc.signalingState;
    if (st !== 'have-local-offer') {
      throw new Error(
        st === 'stable'
          ? '连接状态异常，请重新创建房间'
          : '连接状态异常(' + st + ')，请重试');
    }

    this._setStatus('正在验证连接...');
    await this.pc.setRemoteDescription(new RTCSessionDescription(desc));

    // ICE should now complete
    this._setStatus('正在建立P2P通道...');
  }

  _makePC() {
    this._iceFailed = false;
    this._iceStart = Date.now();
    this.pc = new RTCPeerConnection({
      iceServers: [
        // STUN servers — hole-punching (China-accessible first)
        { urls: 'stun:stun.miwifi.com:3478' },
        { urls: 'stun:stun.qq.com:3478' },
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        // Free TURN relay — fallback when P2P fails
        { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
        { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
        { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
      ],
      iceCandidatePoolSize: 2,
    });

    this.pc.oniceconnectionstatechange = () => {
      const s = this.pc.iceConnectionState;
      this._setStatus('ICE: ' + s);

      if (s === 'checking') {
        this._setStatus('正在尝试连接...');
      } else if (s === 'connected' || s === 'completed') {
        this._setStatus('网络已连接');
      } else if (s === 'failed') {
        this._iceFailed = true;
        if (this._state === 'signaling') {
          this._setStatus('连接失败，双方网络无法互通');
          this._state = 'disconnected';
          this._emit('peer_disconnected', {});
        }
      } else if (s === 'disconnected') {
        if (this._state === 'connected') {
          this._state = 'disconnected';
          this._emit('peer_disconnected', {});
        }
      }
    };

    this.pc.onicegatheringstatechange = () => {
      if (this.pc.iceGatheringState === 'complete') {
        const ld = this.pc.localDescription;
        if (ld && ld.sdp) {
          const hasCand = ld.sdp.includes('a=candidate');
          if (!hasCand) {
            this._iceFailed = true;
            this._setStatus('无法获取网络信息，请检查网络');
          }
        }
      }
    };
  }

  _setupDataChannel() {
    this.dc.onopen = () => {
      this._state = 'connected';
      this._setStatus('已连接');
    };

    this.dc.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      this._emit(msg.type, msg);
      this._emit('*', msg);
    };

    this.dc.onclose = () => {
      this._state = 'disconnected';
      this._setStatus('连接断开');
      this._emit('peer_disconnected', {});
    };

    this.dc.onerror = () => {};
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
        const ld = this.pc.localDescription;
        if (ld && ld.sdp && !ld.sdp.includes('a=candidate')) {
          this._iceFailed = true;
        }
        resolve();
      }, 8000);
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
    this._setStatus('');
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
