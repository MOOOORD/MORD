// lobby.js — multiplayer lobby UI (P2P WebRTC)
import { LOBBY_STATE, PLAYER_ROLE } from './constants.js';

export class Lobby {
  constructor(p2p, onStartGame) {
    this.p2p = p2p;
    this.onStartGame = onStartGame;
    this.state = LOBBY_STATE.IDLE;
    this.selectedRole = null;
    this._amHost = false;
    this._offer = '';
    this._answer = '';
  }

  render(container, statusEl) {
    this._container = container;
    this._statusEl = statusEl;
    this._drawIdle();
  }

  _drawIdle() {
    this.state = LOBBY_STATE.IDLE;
    this._container.innerHTML = '';
    this._setStatus('', '');

    const info = document.createElement('p');
    info.style.cssText = 'font-size:12px;color:#666;text-align:center;margin-bottom:16px;';
    info.textContent = '两台设备通过 P2P 直连，无需服务器，无需注册';

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
      this.p2p.disconnect();
      document.getElementById('lobby-screen').classList.add('hidden');
      document.getElementById('menu-screen').classList.remove('hidden');
      if (typeof startQuoteRotation === 'function') startQuoteRotation();
    };

    row.appendChild(btnCreate);
    row.appendChild(btnJoin);
    this._container.appendChild(info);
    this._container.appendChild(row);
    this._container.appendChild(btnBack);
  }

  // ==================== Host: create room ====================

  async _drawHostCode() {
    this._amHost = true;
    this._container.innerHTML = '';
    this._setStatus('正在生成连接码...', 'connecting');

    let offer;
    try {
      offer = await this.p2p.createOffer();
    } catch (e) {
      this._setStatus('生成连接失败，请刷新重试', 'error');
      return;
    }

    this._offer = offer;
    this._drawHostWaitAnswer();
  }

  _drawHostWaitAnswer() {
    this.state = LOBBY_STATE.WAITING;
    this._container.innerHTML = '';
    this._setStatus('等待朋友回应...', 'connecting');

    // Step 1: show offer with copy button
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

    // Step 2: input for friend's answer
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
      try {
        await this.p2p.setAnswer(answer);
        // Wait for data channel to open
        await this._waitForConnect();
        this._drawRoleSelect();
      } catch (e) {
        this._setStatus('连接失败，请让朋友重新生成回应码', 'error');
      }
    };

    const btnCancel = document.createElement('button');
    btnCancel.className = 'pixel-btn';
    btnCancel.textContent = '取消';
    btnCancel.style.borderColor = '#888';
    btnCancel.style.color = '#aaa';
    btnCancel.onclick = () => { this.p2p.disconnect(); this._drawIdle(); };

    this._container.appendChild(step1);
    this._container.appendChild(ta);
    this._container.appendChild(btnCopy);
    this._container.appendChild(step2);
    this._container.appendChild(answerTA);
    this._container.appendChild(btnConfirm);
    this._container.appendChild(btnCancel);
  }

  // ==================== Guest: join room ====================

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
      try {
        const answer = await this.p2p.acceptOffer(offer);
        this._answer = answer;
        this._drawGuestAnswer();
      } catch (e) {
        this._setStatus('连接码无效，请检查是否完整复制', 'error');
      }
    };

    const btnBack = document.createElement('button');
    btnBack.className = 'pixel-btn';
    btnBack.textContent = '← 返回';
    btnBack.style.borderColor = '#888';
    btnBack.style.color = '#aaa';
    btnBack.onclick = () => { this.p2p.disconnect(); this._drawIdle(); };

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
    btnCancel.onclick = () => { this.p2p.disconnect(); this._drawIdle(); };

    this._container.appendChild(step2);
    this._container.appendChild(ta);
    this._container.appendChild(btnCopy);
    this._container.appendChild(hint);
    this._container.appendChild(btnCancel);

    // Wait for data channel to open (host will set answer)
    this._waitForConnect().then(() => {
      if (this.p2p.connectionState === 'connected') {
        this._drawRoleSelect();
      }
    });
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
          this.p2p.off('game_event', onGameStart);
          const clientRole = msg.hostRole === 'survivor' ? 'killer' : 'survivor';
          this.onStartGame(false, clientRole, msg);
        }
      };
      this.p2p.on('game_event', onGameStart);
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
      if (this.p2p.connectionState === 'connected') { resolve(); return; }
      const check = setInterval(() => {
        if (this.p2p.connectionState === 'connected') {
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
