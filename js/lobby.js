// lobby.js — multiplayer lobby UI (P2P + Server relay)
import { LOBBY_STATE, PLAYER_ROLE } from './constants.js';
import { P2PClient } from './p2p.js';
import { NetworkClient } from './network.js';

const SERVER_URL = 'ws://localhost:3000';

export class Lobby {
  constructor(onStartGame) {
    this.onStartGame = onStartGame;
    this.network = null;
    this.mode = null;       // 'p2p' or 'server'
    this.state = LOBBY_STATE.IDLE;
    this.selectedRole = null;
    this._amHost = false;
    this._offer = '';
    this._answer = '';
    this._roomCode = '';
    this._serverUrl = SERVER_URL;
  }

  getNetwork() { return this.network; }

  render(container, statusEl) {
    this._container = container;
    this._statusEl = statusEl;
    this._drawModeSelect();
  }

  // ==================== Mode select ====================

  _drawModeSelect() {
    this.state = LOBBY_STATE.IDLE;
    this._container.innerHTML = '';
    this._setStatus('', '');

    const title = document.createElement('p');
    title.style.cssText = 'font-size:14px;color:#ccc;text-align:center;margin-bottom:20px';
    title.textContent = '选择联机方式';

    const row = document.createElement('div');
    row.className = 'lobby-row';

    const btnP2P = document.createElement('button');
    btnP2P.className = 'pixel-btn';
    btnP2P.textContent = 'P2P 直连';
    btnP2P.title = '无需服务器，通过复制粘贴连接码建立直连';
    btnP2P.onclick = () => this._startP2P();

    const btnServer = document.createElement('button');
    btnServer.className = 'pixel-btn';
    btnServer.textContent = '服务器中继';
    btnServer.title = '通过中继服务器转发，更稳定可靠';
    btnServer.style.borderColor = '#4ecca3';
    btnServer.style.color = '#4ecca3';
    btnServer.onclick = () => this._drawServerConnect();

    const p2pHint = document.createElement('p');
    p2pHint.style.cssText = 'font-size:10px;color:#666;text-align:center;margin-top:4px';
    p2pHint.textContent = '复制粘贴连接码，无需服务器';

    const srvHint = document.createElement('p');
    srvHint.style.cssText = 'font-size:10px;color:#4ecca3;text-align:center;margin-top:4px';
    srvHint.textContent = '需要房主运行服务器 · 更稳定';

    const btnBack = document.createElement('button');
    btnBack.className = 'pixel-btn';
    btnBack.textContent = '← 返回';
    btnBack.style.borderColor = '#888';
    btnBack.style.color = '#aaa';
    btnBack.onclick = () => {
      document.getElementById('lobby-screen').classList.add('hidden');
      document.getElementById('menu-screen').classList.remove('hidden');
      if (typeof window.startQuoteRotation === 'function') window.startQuoteRotation();
    };

    row.appendChild(btnP2P);
    row.appendChild(btnServer);
    this._container.appendChild(title);
    this._container.appendChild(row);
    this._container.appendChild(p2pHint);
    this._container.appendChild(srvHint);
    this._container.appendChild(btnBack);
  }

  // ==================== P2P mode ====================

  _startP2P() {
    this.mode = 'p2p';
    this.network = new P2PClient();
    this._drawP2PIdle();
  }

  _drawP2PIdle() {
    this.state = LOBBY_STATE.IDLE;
    this._container.innerHTML = '';
    this._setStatus('P2P 直连模式', '');

    const info = document.createElement('p');
    info.style.cssText = 'font-size:12px;color:#666;text-align:center;margin-bottom:16px;';
    info.textContent = '两台设备通过 WebRTC 直连，无需服务器，无需注册';

    const row = document.createElement('div');
    row.className = 'lobby-row';

    const btnCreate = document.createElement('button');
    btnCreate.className = 'pixel-btn';
    btnCreate.textContent = '创建房间';
    btnCreate.onclick = () => this._drawHostCode();

    const btnJoin = document.createElement('button');
    btnJoin.className = 'pixel-btn';
    btnJoin.textContent = '加入房间';
    btnJoin.onclick = () => this._drawGuestInput();

    const btnBack = document.createElement('button');
    btnBack.className = 'pixel-btn';
    btnBack.textContent = '← 返回';
    btnBack.style.borderColor = '#888';
    btnBack.style.color = '#aaa';
    btnBack.onclick = () => {
      this.network.disconnect();
      this._drawModeSelect();
    };

    row.appendChild(btnCreate);
    row.appendChild(btnJoin);
    this._container.appendChild(info);
    this._container.appendChild(row);
    this._container.appendChild(btnBack);
  }

  // --- P2P Host ---

  async _drawHostCode() {
    this._amHost = true;
    this._container.innerHTML = '';
    this._setStatus('正在生成连接码...', 'connecting');

    let offer;
    try {
      offer = await this.network.createOffer();
    } catch (e) {
      this._setStatus(e.message || '生成连接失败，请刷新重试', 'error');
      return;
    }

    this._offer = offer;
    this._drawHostWaitAnswer();
  }

  _drawHostWaitAnswer() {
    this.state = LOBBY_STATE.WAITING;
    this._container.innerHTML = '';
    this._setStatus('等待朋友回应...', 'connecting');

    const step1 = document.createElement('p');
    step1.style.cssText = 'font-size:13px;color:#f0c040;margin-bottom:4px';
    step1.textContent = '① 复制下方连接码，发给朋友（微信/QQ 都行）';

    const ta = document.createElement('textarea');
    ta.readOnly = true;
    ta.style.cssText =
      'width:100%;height:60px;background:#111;border:1px solid #444;color:#aaa;' +
      'font-size:10px;font-family:monospace;resize:none;padding:4px;border-radius:2px;';
    ta.value = this._offer;

    const btnCopy = document.createElement('button');
    btnCopy.className = 'pixel-btn';
    btnCopy.textContent = '📋 复制连接码';
    btnCopy.style.cssText = 'margin-top:4px;font-size:13px;';
    btnCopy.onclick = () => {
      navigator.clipboard.writeText(this._offer).catch(() => {
        ta.select();
        document.execCommand('copy');
      });
      btnCopy.textContent = '已复制 ✓';
      setTimeout(() => { btnCopy.textContent = '📋 复制连接码'; }, 2000);
    };

    const step2 = document.createElement('p');
    step2.style.cssText = 'font-size:13px;color:#f0c040;margin:16px 0 4px';
    step2.textContent = '② 粘贴朋友发回的回应码：';

    const answerTA = document.createElement('textarea');
    answerTA.placeholder = '在这里粘贴朋友的回应码...';
    answerTA.style.cssText =
      'width:100%;height:60px;background:#111;border:1px solid #4ecca3;color:#ccc;' +
      'font-size:10px;font-family:monospace;resize:none;padding:4px;border-radius:2px;';

    const btnConfirm = document.createElement('button');
    btnConfirm.className = 'pixel-btn';
    btnConfirm.textContent = '✓ 确认连接';
    btnConfirm.style.cssText = 'margin-top:4px;font-size:13px;';
    btnConfirm.onclick = async () => {
      const answer = answerTA.value.trim();
      if (!answer) { this._setStatus('请先粘贴朋友的回应码', 'error'); return; }
      this._setStatus('正在建立连接...', 'connecting');
      btnConfirm.disabled = true;
      btnConfirm.textContent = '连接中...';
      try {
        await this.network.setAnswer(answer);
        await this._waitForConnect();
        this._drawRoleSelect();
      } catch (e) {
        this._setStatus(e.message || '连接失败，请让朋友重新生成回应码', 'error');
        btnConfirm.disabled = false;
        btnConfirm.textContent = '✓ 确认连接';
      }
    };

    const btnCancel = document.createElement('button');
    btnCancel.className = 'pixel-btn';
    btnCancel.textContent = '取消';
    btnCancel.style.borderColor = '#888';
    btnCancel.style.color = '#aaa';
    btnCancel.onclick = () => { this.network.disconnect(); this._drawP2PIdle(); };

    this._container.appendChild(step1);
    this._container.appendChild(ta);
    this._container.appendChild(btnCopy);
    this._container.appendChild(step2);
    this._container.appendChild(answerTA);
    this._container.appendChild(btnConfirm);
    this._container.appendChild(btnCancel);
  }

  // --- P2P Guest ---

  _drawGuestInput() {
    this._amHost = false;
    this._container.innerHTML = '';
    this._setStatus('粘贴朋友的连接码', '');

    const step1 = document.createElement('p');
    step1.style.cssText = 'font-size:13px;color:#f0c040;margin-bottom:4px';
    step1.textContent = '① 粘贴朋友发给你的连接码：';

    const ta = document.createElement('textarea');
    ta.placeholder = '在这里粘贴连接码...';
    ta.style.cssText =
      'width:100%;height:60px;background:#111;border:1px solid #4ecca3;color:#ccc;' +
      'font-size:10px;font-family:monospace;resize:none;padding:4px;border-radius:2px;';

    const btnNext = document.createElement('button');
    btnNext.className = 'pixel-btn';
    btnNext.textContent = '下一步 →';
    btnNext.style.cssText = 'margin-top:4px;font-size:13px;';
    btnNext.onclick = async () => {
      const offer = ta.value.trim();
      if (!offer) { this._setStatus('请先粘贴连接码', 'error'); return; }
      this._setStatus('正在生成回应...', 'connecting');
      btnNext.disabled = true;
      btnNext.textContent = '处理中...';
      try {
        const answer = await this.network.acceptOffer(offer);
        this._answer = answer;
        this._drawGuestAnswer();
      } catch (e) {
        this._setStatus(e.message || '连接码无效，请检查是否完整复制', 'error');
        btnNext.disabled = false;
        btnNext.textContent = '下一步 →';
      }
    };

    const btnBack = document.createElement('button');
    btnBack.className = 'pixel-btn';
    btnBack.textContent = '← 返回';
    btnBack.style.borderColor = '#888';
    btnBack.style.color = '#aaa';
    btnBack.onclick = () => { this.network.disconnect(); this._drawP2PIdle(); };

    this._container.appendChild(step1);
    this._container.appendChild(ta);
    this._container.appendChild(btnNext);
    this._container.appendChild(btnBack);
  }

  _drawGuestAnswer() {
    this.state = LOBBY_STATE.READY;
    this._container.innerHTML = '';
    this._setStatus('将回应码发给朋友即可连接', 'connected');

    const step2 = document.createElement('p');
    step2.style.cssText = 'font-size:13px;color:#f0c040;margin-bottom:4px';
    step2.textContent = '② 复制下方回应码，发回给朋友：';

    const ta = document.createElement('textarea');
    ta.readOnly = true;
    ta.style.cssText =
      'width:100%;height:60px;background:#111;border:1px solid #4ecca3;color:#aaa;' +
      'font-size:10px;font-family:monospace;resize:none;padding:4px;border-radius:2px;';
    ta.value = this._answer;

    const btnCopy = document.createElement('button');
    btnCopy.className = 'pixel-btn';
    btnCopy.textContent = '📋 复制回应码';
    btnCopy.style.cssText = 'margin-top:4px;font-size:13px;';
    btnCopy.onclick = () => {
      navigator.clipboard.writeText(this._answer).catch(() => {
        ta.select();
        document.execCommand('copy');
      });
      btnCopy.textContent = '已复制 ✓';
      setTimeout(() => { btnCopy.textContent = '📋 复制回应码'; }, 2000);
    };

    const hint = document.createElement('p');
    hint.style.cssText = 'font-size:11px;color:#888;margin-top:12px';
    hint.textContent = '朋友粘贴后双方自动连接，等待角色选择...';

    const btnCancel = document.createElement('button');
    btnCancel.className = 'pixel-btn';
    btnCancel.textContent = '取消';
    btnCancel.style.borderColor = '#888';
    btnCancel.style.color = '#aaa';
    btnCancel.onclick = () => { this.network.disconnect(); this._drawP2PIdle(); };

    this._container.appendChild(step2);
    this._container.appendChild(ta);
    this._container.appendChild(btnCopy);
    this._container.appendChild(hint);
    this._container.appendChild(btnCancel);

    this._waitForConnect().then(() => {
      if (this.network.connectionState === 'connected') {
        this._drawRoleSelect();
      }
    });
  }

  // ==================== Server mode ====================

  _drawServerConnect() {
    this.mode = 'server';
    this.state = LOBBY_STATE.IDLE;
    this._container.innerHTML = '';
    this._setStatus('服务器中继模式', '');

    const info = document.createElement('p');
    info.style.cssText = 'font-size:12px;color:#aaa;text-align:center;margin-bottom:8px';
    info.textContent = '房主需先在终端运行 node start-server.js --tunnel';

    const urlLabel = document.createElement('p');
    urlLabel.style.cssText = 'font-size:12px;color:#888;margin:12px 0 4px';
    urlLabel.textContent = '服务器地址：';

    const urlInput = document.createElement('input');
    urlInput.type = 'text';
    urlInput.value = this._serverUrl;
    urlInput.style.cssText =
      'width:100%;padding:8px;background:#111;border:1px solid #444;color:#ccc;' +
      'font-size:12px;font-family:monospace;border-radius:2px;';
    urlInput.onchange = () => { this._serverUrl = urlInput.value.trim(); };

    const row = document.createElement('div');
    row.className = 'lobby-row';
    row.style.marginTop = '16px';

    const btnHost = document.createElement('button');
    btnHost.className = 'pixel-btn';
    btnHost.textContent = '创建房间';
    btnHost.style.borderColor = '#4ecca3';
    btnHost.style.color = '#4ecca3';
    btnHost.onclick = () => this._serverCreateRoom();

    const btnGuest = document.createElement('button');
    btnGuest.className = 'pixel-btn';
    btnGuest.textContent = '加入房间';
    btnGuest.onclick = () => this._serverJoinRoom();

    const btnBack = document.createElement('button');
    btnBack.className = 'pixel-btn';
    btnBack.textContent = '← 返回';
    btnBack.style.borderColor = '#888';
    btnBack.style.color = '#aaa';
    btnBack.onclick = () => this._drawModeSelect();

    row.appendChild(btnHost);
    row.appendChild(btnGuest);
    this._container.appendChild(info);
    this._container.appendChild(urlLabel);
    this._container.appendChild(urlInput);
    this._container.appendChild(row);
    this._container.appendChild(btnBack);
  }

  _connectServer() {
    this.network = new NetworkClient(this._serverUrl);

    // Error handler
    this.network.on('error', (msg) => {
      this._setStatus(msg.message || '服务器错误', 'error');
    });

    // Peer events
    this.network.on('peer_joined', () => {
      this._setStatus('对手已加入！', 'connected');
      if (this._amHost) {
        this._drawRoleSelect();
      }
    });

    this.network.on('peer_disconnected', () => {
      this._setStatus('对手断开连接', 'error');
    });

    this.network.connect();
  }

  _serverCreateRoom() {
    this._amHost = true;
    this._container.innerHTML = '';
    this._setStatus('正在连接服务器...', 'connecting');

    this._connectServer();

    this.network.on('room_created', (msg) => {
      this._roomCode = msg.code;
      this.state = LOBBY_STATE.WAITING;
      this._drawServerHostWait();
    });

    // Wait for connection then create room
    const checkConn = setInterval(() => {
      if (this.network.connectionState === 'connected') {
        clearInterval(checkConn);
        this.network.send('create_room');
      }
    }, 100);
    setTimeout(() => { clearInterval(checkConn); }, 10000);
  }

  _drawServerHostWait() {
    this._container.innerHTML = '';
    this._setStatus('等待对手加入...', 'connecting');

    const title = document.createElement('p');
    title.style.cssText = 'font-size:14px;color:#4ecca3;text-align:center;margin-bottom:8px';
    title.textContent = '房间已创建';

    const codeLabel = document.createElement('p');
    codeLabel.style.cssText = 'font-size:12px;color:#888;margin-bottom:4px';
    codeLabel.textContent = '把房间码发给朋友：';

    const codeDisplay = document.createElement('div');
    codeDisplay.style.cssText =
      'font-size:36px;font-weight:bold;color:#f0c040;text-align:center;' +
      'letter-spacing:8px;padding:16px;background:#111;border:2px solid #f0c040;border-radius:4px;margin-bottom:8px';
    codeDisplay.textContent = this._roomCode;

    const btnCopy = document.createElement('button');
    btnCopy.className = 'pixel-btn';
    btnCopy.textContent = '📋 复制房间码';
    btnCopy.onclick = () => {
      navigator.clipboard.writeText(this._roomCode).catch(() => {});
      btnCopy.textContent = '已复制 ✓';
      setTimeout(() => { btnCopy.textContent = '📋 复制房间码'; }, 2000);
    };

    const hint = document.createElement('p');
    hint.style.cssText = 'font-size:11px;color:#666;margin-top:8px';
    hint.textContent = '朋友在"加入房间"中输入此码即可';

    const btnCancel = document.createElement('button');
    btnCancel.className = 'pixel-btn';
    btnCancel.textContent = '取消';
    btnCancel.style.borderColor = '#888';
    btnCancel.style.color = '#aaa';
    btnCancel.style.marginTop = '16px';
    btnCancel.onclick = () => { this.network.disconnect(); this._drawServerConnect(); };

    this._container.appendChild(title);
    this._container.appendChild(codeLabel);
    this._container.appendChild(codeDisplay);
    this._container.appendChild(btnCopy);
    this._container.appendChild(hint);
    this._container.appendChild(btnCancel);
  }

  _serverJoinRoom() {
    this._amHost = false;
    this._container.innerHTML = '';
    this._setStatus('输入房间码', '');

    const label = document.createElement('p');
    label.style.cssText = 'font-size:13px;color:#f0c040;margin-bottom:8px';
    label.textContent = '输入朋友给你的 4 位房间码：';

    const codeInput = document.createElement('input');
    codeInput.type = 'text';
    codeInput.maxLength = 4;
    codeInput.placeholder = '0000';
    codeInput.style.cssText =
      'width:100%;padding:12px;background:#111;border:2px solid #4ecca3;color:#f0c040;' +
      'font-size:28px;font-family:monospace;text-align:center;letter-spacing:8px;border-radius:4px;';

    const btnJoin = document.createElement('button');
    btnJoin.className = 'pixel-btn';
    btnJoin.textContent = '加入房间';
    btnJoin.style.marginTop = '12px';
    btnJoin.onclick = () => {
      const code = codeInput.value.trim();
      if (code.length !== 4 || isNaN(code)) {
        this._setStatus('请输入 4 位数字房间码', 'error');
        return;
      }
      this._setStatus('正在连接服务器...', 'connecting');
      this._connectServer();

      this.network.on('room_joined', () => {
        this.state = LOBBY_STATE.READY;
        this._setStatus('已加入房间！', 'connected');
        this._roomCode = code;
        this._drawRoleSelect();
      });

      const checkConn = setInterval(() => {
        if (this.network.connectionState === 'connected') {
          clearInterval(checkConn);
          this.network.send('join_room', { code });
        }
      }, 100);
      setTimeout(() => { clearInterval(checkConn); }, 10000);
    };

    const btnBack = document.createElement('button');
    btnBack.className = 'pixel-btn';
    btnBack.textContent = '← 返回';
    btnBack.style.borderColor = '#888';
    btnBack.style.color = '#aaa';
    btnBack.onclick = () => { if (this.network) this.network.disconnect(); this._drawServerConnect(); };

    this._container.appendChild(label);
    this._container.appendChild(codeInput);
    this._container.appendChild(btnJoin);
    this._container.appendChild(btnBack);
  }

  // ==================== Role select (shared) ====================

  _drawRoleSelect() {
    this.state = LOBBY_STATE.READY;
    this._container.innerHTML = '';
    this._setStatus('已连接！选择你的角色', 'connected');

    const cards = document.createElement('div');
    cards.className = 'role-cards';

    const survCard = document.createElement('div');
    survCard.className = 'role-card survivor';
    survCard.innerHTML = `
      <div class="role-icon">🏃</div>
      <div class="role-name">陈飞飞</div>
      <div class="role-hint">修理发电机<br>给大门通电<br>逃离阴沟的追捕</div>
    `;
    survCard.addEventListener('click', () => {
      this.selectedRole = PLAYER_ROLE.SURVIVOR;
      survCard.classList.add('selected-survivor');
      killCard.classList.remove('selected-killer');
      this._showReadyButton();
    });

    const killCard = document.createElement('div');
    killCard.className = 'role-card killer';
    killCard.innerHTML = `
      <div class="role-icon">🔪</div>
      <div class="role-name">阴沟</div>
      <div class="role-hint">追击逃生者<br>击倒并挂上钩子<br>阻止他们逃脱</div>
    `;
    killCard.addEventListener('click', () => {
      this.selectedRole = PLAYER_ROLE.KILLER;
      killCard.classList.add('selected-killer');
      survCard.classList.remove('selected-survivor');
      this._showReadyButton();
    });

    cards.appendChild(survCard);
    cards.appendChild(killCard);
    this._container.appendChild(cards);

    this._roleCards = { survCard, killCard };
    this._startBtn = null;
  }

  _showReadyButton() {
    if (this._startBtn) this._startBtn.remove();

    if (this._amHost) {
      const btnStart = document.createElement('button');
      btnStart.className = 'pixel-btn';
      btnStart.textContent = '开始游戏';
      btnStart.onclick = () => this._startGame();
      this._container.appendChild(btnStart);
      this._startBtn = btnStart;
    } else {
      const waitMsg = document.createElement('p');
      waitMsg.style.cssText = 'font-size:14px;color:#888;text-align:center;margin-top:12px';
      waitMsg.textContent = '等待房主开始游戏...';
      this._container.appendChild(waitMsg);
      this._startBtn = waitMsg;

      // Listen for game_start from host
      const onGameStart = (msg) => {
        if (msg.event === 'game_start') {
          this.network.off('game_event', onGameStart);
          const clientRole = msg.hostRole === 'survivor' ? 'killer' : 'survivor';
          this.onStartGame(false, clientRole, msg);
        }
      };
      this.network.on('game_event', onGameStart);
    }
  }

  _startGame() {
    if (!this.selectedRole) return;
    this._setStatus('正在开始游戏...', 'connected');
    this.onStartGame(true, this.selectedRole, null);
  }

  // ==================== Helpers ====================

  _waitForConnect(timeout = 30000) {
    return new Promise((resolve, reject) => {
      if (this.network.connectionState === 'connected') { resolve(); return; }
      const check = setInterval(() => {
        if (this.network.connectionState === 'connected') {
          clearInterval(check);
          resolve();
        }
      }, 100);
      setTimeout(() => { clearInterval(check); reject(new Error('timeout')); }, timeout);
    });
  }

  _setStatus(msg, cls) {
    if (this._statusEl) {
      this._statusEl.textContent = msg;
      this._statusEl.className = cls || '';
    }
  }
}
