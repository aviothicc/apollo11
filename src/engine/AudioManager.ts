class AudioManagerClass {
  private ctx: AudioContext | null = null;
  private isMuted = false;
  private roverOsc: OscillatorNode | null = null;
  private roverGain: GainNode | null = null;
  private ambientNoiseNode: AudioBufferSourceNode | null = null;
  private currentAudioSource: AudioBufferSourceNode | null = null;
  private currentAudioElement: HTMLAudioElement | null = null;
  private speakGeneration = 0;
  private initialized = false;
  private voices: SpeechSynthesisVoice[] = [];

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.loadVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        this.loadVoices();
      };
    }
  }

  private loadVoices() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.voices = window.speechSynthesis.getVoices();
    }
  }

  private getContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public init() {
    if (!this.initialized) {
      try {
        const ctx = this.getContext();
        this.setupRoverHum(ctx);
        this.setupBackgroundCosmicStatic(ctx);
        this.initialized = true;
      } catch {
        // Ignore autoplay restrictions until user gesture
      }
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.roverGain && this.ctx && muted) {
      this.roverGain.gain.setValueAtTime(0, this.ctx.currentTime);
    }
    if (muted) {
      this.stopSpeaking();
    }
  }

  public getIsMuted() {
    return this.isMuted;
  }

  public playQuindarTone(type: 'intro' | 'outro' = 'intro') {
    if (this.isMuted) return;
    try {
      const ctx = this.getContext();
      const freq = type === 'intro' ? 2525 : 2475;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.08, now + 0.015);
      gain.gain.setValueAtTime(0.08, now + 0.22);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.26);
      this.playStaticBurst(0.18, 0.03);
    } catch {
      // Ignore audio errors
    }
  }

  public playTypeBeep() {
    if (this.isMuted) return;
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(2400, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.025, now + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.027);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.03);
    } catch {
      // Ignore
    }
  }

  public playStaticBurst(duration = 0.2, volume = 0.04) {
    if (this.isMuted) return;
    try {
      const ctx = this.getContext();
      const length = Math.floor(ctx.sampleRate * duration);
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1400;
      filter.Q.value = 2.5;
      const gain = ctx.createGain();
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      source.start(now);
    } catch {
      // Ignore
    }
  }

  public playLaserPulse() {
    if (this.isMuted) return;
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(2200, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.45);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3200, now);
      filter.frequency.exponentialRampToValueAtTime(400, now + 0.45);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.52);

      setTimeout(() => {
        if (this.isMuted) return;
        const echoOsc = ctx.createOscillator();
        const echoGain = ctx.createGain();
        echoOsc.type = 'sine';
        echoOsc.frequency.setValueAtTime(880, ctx.currentTime);
        echoGain.gain.setValueAtTime(0.08, ctx.currentTime);
        echoGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        echoOsc.connect(echoGain);
        echoGain.connect(ctx.destination);
        echoOsc.start();
        echoOsc.stop(ctx.currentTime + 0.35);
      }, 700);
    } catch {
      // Ignore
    }
  }

  private setupRoverHum(ctx: AudioContext) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = 45;
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    this.roverOsc = osc;
    this.roverGain = gain;
  }

  public updateRoverSpeed(normalizedSpeed: number) {
    if (this.isMuted || !this.roverOsc || !this.roverGain || !this.ctx) return;
    const now = this.ctx.currentTime;
    const freq = 45 + normalizedSpeed * 85;
    const vol = normalizedSpeed > 0.05 ? 0.02 + normalizedSpeed * 0.04 : 0.004;
    this.roverOsc.frequency.setTargetAtTime(freq, now, 0.08);
    this.roverGain.gain.setTargetAtTime(vol, now, 0.08);
  }

  private setupBackgroundCosmicStatic(ctx: AudioContext) {
    try {
      const length = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.01;
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 600;
      filter.Q.value = 1;
      const gain = ctx.createGain();
      gain.gain.value = 0.005;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      source.start();
      this.ambientNoiseNode = source;
    } catch {
      // Ignore
    }
  }

  public playSuccessChime() {
    if (this.isMuted) return;
    try {
      const ctx = this.getContext();
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const start = ctx.currentTime + idx * 0.08;
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.exponentialRampToValueAtTime(0.1, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.38);
      });
    } catch {
      // Ignore
    }
  }

  public playClickSound() {
    if (this.isMuted) return;
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.04);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch {
      // Ignore
    }
  }

  private getBestMaleVoice(): SpeechSynthesisVoice | null {
    if (this.voices.length === 0 && 'speechSynthesis' in window) {
      this.voices = window.speechSynthesis.getVoices();
    }
    const enVoices = this.voices.filter((v) => v.lang.startsWith('en'));
    if (enVoices.length === 0) return null;
    const femaleNames = ['female', 'samantha', 'victoria', 'karen', 'zira', 'fiona', 'veena', 'susan', 'allison'];
    const maleNames = ['male', 'david', 'mark', 'george', 'daniel', 'james', 'richard', 'guy', 'alex', 'fred'];
    for (const v of enVoices) {
      const lower = v.name.toLowerCase();
      if (!femaleNames.some((f) => lower.includes(f)) && maleNames.some((m) => lower.includes(m))) {
        return v;
      }
    }
    return enVoices[0];
  }

  public async speakDialogue(text: string, speaker: string, onEnd?: () => void, clipId?: string) {
    if (this.isMuted) {
      onEnd?.();
      return;
    }
    this.stopSpeaking();
    const gen = this.speakGeneration;
    this.playQuindarTone('intro');

    if (clipId) {
      const played = await this.playLocalAudioClip(clipId, onEnd, gen);
      if (gen !== this.speakGeneration || played) return;
    }

    if (gen === this.speakGeneration) {
      this.speakClientFallback(text, speaker, onEnd);
    }
  }

  private async playLocalAudioClip(clipId: string, onEnd: (() => void) | undefined, gen: number): Promise<boolean> {
    try {
      const url = `/assets/audio/voiceovers/${clipId}.mp3`;
      return new Promise((resolve) => {
        const audio = new Audio();
        let settled = false;
        const finish = (ok: boolean) => {
          if (!settled) {
            settled = true;
            resolve(ok);
          }
        };
        const tryPlay = async () => {
          if (settled || gen !== this.speakGeneration) {
            finish(false);
          } else {
            settled = true;
            try {
              this.currentAudioElement = audio;
              audio.onended = () => {
                if (this.currentAudioElement === audio) {
                  this.currentAudioElement = null;
                }
                this.playQuindarTone('outro');
                onEnd?.();
              };
              await audio.play();
              resolve(true);
            } catch {
              audio.onended = null;
              if (this.currentAudioElement === audio) {
                this.currentAudioElement = null;
              }
              resolve(false);
            }
          }
        };
        audio.preload = 'auto';
        audio.oncanplaythrough = () => tryPlay();
        audio.onerror = () => finish(false);
        audio.src = url;
        if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
          tryPlay();
        }
        window.setTimeout(() => finish(false), 3500);
      });
    } catch {
      return false;
    }
  }

  private speakClientFallback(text: string, speaker: string, onEnd?: () => void) {
    if (!('speechSynthesis' in window)) {
      if (onEnd) {
        const words = text.split(' ').length;
        const duration = Math.max(2500, (words / 2.5) * 1000);
        setTimeout(() => {
          this.playQuindarTone('outro');
          onEnd();
        }, duration);
      }
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    if (speaker.includes('Neil')) {
      utter.pitch = 0.78;
      utter.rate = 0.88;
    } else {
      utter.pitch = 0.95;
      utter.rate = 0.95;
    }
    const voice = this.getBestMaleVoice();
    if (voice) utter.voice = voice;
    utter.onend = () => {
      this.playQuindarTone('outro');
      onEnd?.();
    };
    utter.onerror = () => {
      this.playQuindarTone('outro');
      onEnd?.();
    };
    window.speechSynthesis.speak(utter);
  }

  public stopSpeaking() {
    this.speakGeneration += 1;
    if (this.currentAudioSource) {
      try {
        this.currentAudioSource.stop();
        this.currentAudioSource.disconnect();
      } catch {
        // Ignore
      }
      this.currentAudioSource = null;
    }
    if (this.currentAudioElement) {
      try {
        this.currentAudioElement.pause();
        this.currentAudioElement.currentTime = 0;
      } catch {
        // Ignore
      }
      this.currentAudioElement = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }
}

export const AudioManager = new AudioManagerClass();
