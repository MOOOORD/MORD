// audio.js — Volume settings for BGM and SFX
const STORAGE_KEY = 'mord_audio_settings';

class AudioManager {
  constructor() {
    const saved = this._load();
    this._bgmVolume = saved.bgm ?? 0.7;
    this._sfxVolume = saved.sfx ?? 1.0;
    this._bgm = document.getElementById('bgm-menu');
    this._apply();
  }

  _load() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch { return {}; }
  }

  _save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      bgm: this._bgmVolume,
      sfx: this._sfxVolume,
    }));
  }

  _apply() {
    if (this._bgm) this._bgm.volume = this._bgmVolume;
    const chaseBgm = document.getElementById('bgm-chase');
    if (chaseBgm) chaseBgm.volume = this._bgmVolume;
  }

  get bgmVolume() { return this._bgmVolume; }
  get sfxVolume() { return this._sfxVolume; }

  setBgmVolume(v) {
    this._bgmVolume = Math.max(0, Math.min(1, v));
    this._apply();
    this._save();
  }

  setSfxVolume(v) {
    this._sfxVolume = Math.max(0, Math.min(1, v));
    this._save();
  }

  /** Call when playing a sound effect: AudioManager.playSfx(audioElement) */
  playSfx(audio) {
    if (!audio) return;
    const clone = audio.cloneNode();
    clone.volume = this._sfxVolume;
    clone.play().catch(() => {});
  }
}

export const audio = new AudioManager();
