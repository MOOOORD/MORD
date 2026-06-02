// network.js — WebSocket client for multiplayer

export class NetworkClient {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.handlers = new Map();
    this._state = 'disconnected'; // disconnected | connecting | connected
    this._reconnectTimer = null;
    this._reconnectDelay = 1000;
    this._intentional = false;
    this._queue = [];
  }

  get connectionState() { return this._state; }

  connect() {
    if (this.ws && (this.ws.readyState === 0 || this.ws.readyState === 1)) return;
    this._intentional = false;
    this._doConnect();
  }

  disconnect() {
    this._intentional = true;
    if (this._reconnectTimer) { clearTimeout(this._reconnectTimer); this._reconnectTimer = null; }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this._state = 'disconnected';
  }

  _doConnect() {
    if (this.ws && (this.ws.readyState === 0 || this.ws.readyState === 1)) return;
    this._state = 'connecting';
    try {
      this.ws = new WebSocket(this.url);
    } catch {
      this._scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this._state = 'connected';
      this._reconnectDelay = 1000;
      // flush queued messages
      while (this._queue.length > 0) {
        this._sendRaw(this._queue.shift());
      }
    };

    this.ws.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      if (msg.type === 'pong') return;
      const cbs = this.handlers.get(msg.type);
      if (cbs) cbs.forEach(fn => fn(msg));
      // also fire '*' wildcard
      const wild = this.handlers.get('*');
      if (wild) wild.forEach(fn => fn(msg));
    };

    this.ws.onclose = () => {
      if (this._intentional) { this._state = 'disconnected'; return; }
      this._state = 'disconnected';
      this._scheduleReconnect();
    };

    this.ws.onerror = () => {
      // onclose will fire after this
    };
  }

  _scheduleReconnect() {
    if (this._intentional) return;
    if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
    this._reconnectTimer = setTimeout(() => {
      this._doConnect();
    }, this._reconnectDelay);
    this._reconnectDelay = Math.min(this._reconnectDelay * 2, 10000);
  }

  _sendRaw(data) {
    if (this.ws && this.ws.readyState === 1) {
      this.ws.send(JSON.stringify(data));
    }
  }

  send(type, data = {}) {
    const msg = { type, ...data };
    if (this.ws && this.ws.readyState === 1) {
      this._sendRaw(msg);
    } else {
      // Queue for later (max 50 messages to avoid memory issues)
      if (this._queue.length < 50) this._queue.push(msg);
      if (!this._intentional && this._state === 'disconnected') {
        this._doConnect();
      }
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
}
