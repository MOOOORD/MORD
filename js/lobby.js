// lobby.js — multiplayer lobby UI
import { LOBBY_STATE, PLAYER_ROLE } from './constants.js';

export class Lobby {
  constructor(network, onStartGame) {
    this.network = network;
    this.onStartGame = onStartGame;
    this.state = LOBBY_STATE.IDLE;
    this.roomCode = null;
    this.selectedRole = null; // player's own role choice
    this.peerJoined = false;
    this._codeDigits = ['', '', '', ''];
    this._digitInputs = [];
  }

  render(container, statusEl) {
    this._container = container;
    this._statusEl = statusEl;
    this._drawIdle();
  }

  _drawIdle() {
    this.state = LOBBY_STATE.IDLE;
    this._container.innerHTML = '';
    this._statusEl.textContent = '';
    this._statusEl.className = '';

    const row = document.createElement('div');
    row.className = 'lobby-row';

    const btnCreate = document.createElement('button');
    btnCreate.className = 'pixel-btn';
    btnCreate.textContent = '创建房间';
    btnCreate.onclick = () => this._createRoom();

    const btnJoin = document.createElement('button');
    btnJoin.className = 'pixel-btn';
    btnJoin.textContent = '加入房间';
    btnJoin.onclick = () => this._drawJoinInput();

    const btnBack = document.createElement('button');
    btnBack.className = 'pixel-btn';
    btnBack.textContent = '← 返回';
    btnBack.style.borderColor = '#888';
    btnBack.style.color = '#aaa';
    btnBack.onclick = () => {
      this.network.disconnect();
      document.getElementById('lobby-screen').classList.add('hidden');
      document.getElementById('menu-screen').classList.remove('hidden');
      if (typeof startQuoteRotation === 'function') startQuoteRotation();
    };

    row.appendChild(btnCreate);
    row.appendChild(btnJoin);
    this._container.appendChild(row);
    this._container.appendChild(btnBack);
  }

  _createRoom() {
    if (this.network.connectionState !== 'connected') {
      this.network.connect();
      this._setStatus('正在连接服务器...', 'connecting');
      const check = setInterval(() => {
        if (this.network.connectionState === 'connected') {
          clearInterval(check);
          this._doCreate();
        }
      }, 200);
      setTimeout(() => {
        clearInterval(check);
        if (this.network.connectionState !== 'connected') {
          this._setStatus('无法连接服务器，请检查网络', 'error');
        }
      }, 8000);
    } else {
      this._doCreate();
    }
  }

  _doCreate() {
    this.state = LOBBY_STATE.CREATING;
    this._amHost = true;

    const onCreated = (msg) => {
      this.roomCode = msg.code;
      this.network.off('room_created', onCreated);
      this.network.off('error', onError);
      this._drawWaitingForPeer();
    };
    const onError = (msg) => {
      this.network.off('room_created', onCreated);
      this.network.off('error', onError);
      this._setStatus(msg.message || '创建失败', 'error');
    };

    this.network.on('room_created', onCreated);
    this.network.on('error', onError);
    this.network.send('create_room');
  }

  _drawWaitingForPeer() {
    this.state = LOBBY_STATE.WAITING;
    this._container.innerHTML = '';
    this._setStatus('等待对手加入...', 'connecting');

    const label = document.createElement('p');
    label.style.cssText = 'font-size:14px;color:#888;margin-bottom:8px';
    label.textContent = '房间号（分享给朋友）：';

    const codeDiv = document.createElement('div');
    codeDiv.className = 'room-code-display';
    codeDiv.textContent = this.roomCode;

    const btnCopy = document.createElement('button');
    btnCopy.className = 'pixel-btn';
    btnCopy.textContent = '复制房间号';
    btnCopy.onclick = () => {
      navigator.clipboard.writeText(this.roomCode).catch(() => {});
      btnCopy.textContent = '已复制！';
      setTimeout(() => { btnCopy.textContent = '复制房间号'; }, 1500);
    };

    const btnCancel = document.createElement('button');
    btnCancel.className = 'pixel-btn';
    btnCancel.textContent = '取消';
    btnCancel.style.borderColor = '#888';
    btnCancel.style.color = '#aaa';
    btnCancel.onclick = () => {
      this.network.disconnect();
      this._drawIdle();
    };

    this._container.appendChild(label);
    this._container.appendChild(codeDiv);
    this._container.appendChild(btnCopy);
    this._container.appendChild(btnCancel);

    // Listen for peer joining
    const onPeer = () => {
      this.peerJoined = true;
      this.network.off('peer_joined', onPeer);
      this._drawRoleSelect();
    };
    this.network.on('peer_joined', onPeer);

    // Handle disconnect while waiting
    const onDisconnect = () => {
      this.network.off('peer_disconnected', onDisconnect);
      this._setStatus('对手已断开连接', 'error');
      this.peerJoined = false;
    };
    this.network.on('peer_disconnected', onDisconnect);
  }

  _drawJoinInput() {
    this.state = LOBBY_STATE.JOINING;
    this._container.innerHTML = '';
    this._setStatus('输入4位房间号', '');
    this._codeDigits = ['', '', '', ''];

    const label = document.createElement('p');
    label.style.cssText = 'font-size:14px;color:#888;margin-bottom:8px';
    label.textContent = '请输入4位房间号：';

    const inputRow = document.createElement('div');
    inputRow.className = 'room-code-input';
    this._digitInputs = [];

    for (let i = 0; i < 4; i++) {
      const inp = document.createElement('input');
      inp.className = 'code-digit';
      inp.maxLength = 1;
      inp.inputMode = 'numeric';
      inp.pattern = '[0-9]';
      inp.dataset.index = i;
      inp.addEventListener('input', (e) => {
        const val = e.target.value.replace(/[^0-9]/g, '');
        e.target.value = val;
        this._codeDigits[i] = val;
        if (val && i < 3) this._digitInputs[i + 1].focus();
        this._checkCodeComplete();
      });
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !this._codeDigits[i] && i > 0) {
          this._digitInputs[i - 1].focus();
        }
      });
      inp.addEventListener('paste', (e) => {
        e.preventDefault();
        const paste = (e.clipboardData.getData('text') || '').replace(/[^0-9]/g, '').slice(0, 4);
        for (let j = 0; j < 4; j++) {
          this._codeDigits[j] = paste[j] || '';
          this._digitInputs[j].value = paste[j] || '';
        }
        if (paste.length === 4) this._checkCodeComplete();
        else if (paste.length > 0) this._digitInputs[Math.min(paste.length, 3)].focus();
      });
      inputRow.appendChild(inp);
      this._digitInputs.push(inp);
    }

    const btnBack = document.createElement('button');
    btnBack.className = 'pixel-btn';
    btnBack.textContent = '← 返回';
    btnBack.style.borderColor = '#888';
    btnBack.style.color = '#aaa';
    btnBack.onclick = () => this._drawIdle();

    this._container.appendChild(label);
    this._container.appendChild(inputRow);
    this._container.appendChild(btnBack);

    setTimeout(() => { if (this._digitInputs[0]) this._digitInputs[0].focus(); }, 100);
  }

  _checkCodeComplete() {
    const code = this._codeDigits.join('');
    if (code.length === 4) {
      this._joinRoom(code);
    }
  }

  _joinRoom(code) {
    if (this.network.connectionState !== 'connected') {
      this.network.connect();
      this._setStatus('正在连接...', 'connecting');
      const check = setInterval(() => {
        if (this.network.connectionState === 'connected') {
          clearInterval(check);
          this._doJoin(code);
        }
      }, 200);
      setTimeout(() => {
        clearInterval(check);
        if (this.network.connectionState !== 'connected') {
          this._setStatus('无法连接服务器', 'error');
        }
      }, 8000);
    } else {
      this._doJoin(code);
    }
  }

  _doJoin(code) {
    this._amHost = false;
    this._setStatus('正在加入房间...', 'connecting');

    const onJoined = (msg) => {
      this.roomCode = msg.code;
      this.peerJoined = true;
      this.network.off('room_joined', onJoined);
      this.network.off('error', onError);
      this._drawRoleSelect();
    };
    const onError = (msg) => {
      this.network.off('room_joined', onJoined);
      this.network.off('error', onError);
      this._setStatus(msg.message || '加入失败', 'error');
    };

    this.network.on('room_joined', onJoined);
    this.network.on('error', onError);
    this.network.send('join_room', { code });
  }

  _drawRoleSelect() {
    this.state = LOBBY_STATE.READY;
    this._container.innerHTML = '';
    this._setStatus('对手已加入！选择你的角色', 'connected');

    const cards = document.createElement('div');
    cards.className = 'role-cards';

    // Survivor card
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

    // Killer card
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

    // Store reference for start button
    this._roleCards = { survCard, killCard };
    this._startBtn = null;
  }

  _showReadyButton() {
    // Remove existing start button if any
    if (this._startBtn) this._startBtn.remove();

    const btnStart = document.createElement('button');
    btnStart.className = 'pixel-btn';
    btnStart.textContent = '开始游戏';
    btnStart.onclick = () => this._startGame();
    this._container.appendChild(btnStart);
    this._startBtn = btnStart;
  }

  _startGame() {
    if (!this.selectedRole) return;
    this._setStatus('正在开始游戏...', 'connected');
    this.onStartGame(!!this._amHost, this.selectedRole);
  }

  _setStatus(msg, cls) {
    if (this._statusEl) {
      this._statusEl.textContent = msg;
      this._statusEl.className = cls || '';
    }
  }
}
