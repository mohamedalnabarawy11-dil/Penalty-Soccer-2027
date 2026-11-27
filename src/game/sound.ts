class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;
  private musicEnabled = true;
  private themeDucked = false;
  private noiseBuffer: AudioBuffer | null = null;
  private ambienceGain: GainNode | null = null;
  private ambienceSource: AudioBufferSourceNode | null = null;

  // Official Egyptian Stadium Cheer Anthem state
  private themeMasterGain: GainNode | null = null;
  private themeTimerId: number | null = null;
  private themeRunning = false;
  private nextStepTime = 0;
  private currentStep = 0;

  public setMuted(muted: boolean) {
    this.muted = muted;
    if (this.ambienceGain && this.ctx) {
      this.ambienceGain.gain.setTargetAtTime(
        muted ? 0 : 0.032,
        this.ctx.currentTime,
        0.1
      );
    }
    this.updateThemeGain();
  }

  public setMusicEnabled(enabled: boolean) {
    this.musicEnabled = enabled;
    if (enabled && !this.themeRunning) {
      this.startOfficialTheme();
    } else {
      this.updateThemeGain();
    }
  }

  public setThemeDucking(ducked: boolean) {
    this.themeDucked = ducked;
    this.updateThemeGain();
  }

  private getTargetThemeVolume(): number {
    if (this.muted || !this.musicEnabled) return 0;
    return this.themeDucked ? 0.11 : 0.22;
  }

  private updateThemeGain() {
    if (this.themeMasterGain && this.ctx) {
      this.themeMasterGain.gain.setTargetAtTime(
        this.getTargetThemeVolume(),
        this.ctx.currentTime,
        0.12
      );
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (!this.noiseBuffer && this.ctx) {
      const sampleRate = this.ctx.sampleRate;
      const length = sampleRate * 2;
      const buffer = this.ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);
      let b0 = 0,
        b1 = 0,
        b2 = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99765 * b0 + white * 0.099046;
        b1 = 0.963 * b1 + white * 0.2965164;
        b2 = 0.57 * b2 + white * 1.0526913;
        data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.11;
      }
      this.noiseBuffer = buffer;
    }
    return this.ctx;
  }

  public unlock() {
    const ctx = this.ensureContext();
    if (ctx && this.musicEnabled && !this.themeRunning) {
      this.startOfficialTheme();
    }
  }

  public startOfficialTheme() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    if (!this.themeMasterGain) {
      this.themeMasterGain = ctx.createGain();
      this.themeMasterGain.gain.value = this.getTargetThemeVolume();
      this.themeMasterGain.connect(ctx.destination);
    }
    this.updateThemeGain();

    if (this.themeRunning) return;
    this.themeRunning = true;
    this.nextStepTime = ctx.currentTime + 0.06;

    // 16th-note step duration at ~122 BPM (~0.123s per 16th note)
    const stepDuration = 60 / 122 / 4;

    this.themeTimerId = window.setInterval(() => {
      if (!this.ctx || !this.themeRunning) return;
      if (this.ctx.state !== 'running') return;

      while (this.nextStepTime < this.ctx.currentTime + 0.2) {
        if (!this.muted && this.musicEnabled) {
          this.scheduleAnthemStep(this.currentStep, this.nextStepTime, stepDuration);
        }
        this.nextStepTime += stepDuration;
        this.currentStep = (this.currentStep + 1) % 64;
      }
    }, 65);
  }

  public stopOfficialTheme() {
    this.themeRunning = false;
    if (this.themeTimerId !== null) {
      window.clearInterval(this.themeTimerId);
      this.themeTimerId = null;
    }
  }

  private scheduleAnthemStep(step: number, time: number, stepDur: number) {
    const ctx = this.ctx;
    const out = this.themeMasterGain;
    if (!ctx || !out) return;

    const barStep = step % 16;

    // 1. Egyptian Maqsoum / Stadium Drum Beat ("Dum - Tak - - Tak - Dum - - Tak - -")
    const isDum = barStep === 0 || barStep === 6 || barStep === 8;
    const isStrongClap = barStep === 4 || barStep === 12;
    const isTablaTak =
      barStep === 2 || barStep === 4 || barStep === 10 || barStep === 12 || barStep === 14;

    if (isDum) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(barStep === 0 ? 128 : 108, time);
      osc.frequency.exponentialRampToValueAtTime(42, time + 0.14);

      gain.gain.setValueAtTime(barStep === 0 ? 0.52 : 0.38, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.16);

      osc.connect(gain);
      gain.connect(out);
      osc.start(time);
      osc.stop(time + 0.17);
    }

    if (isTablaTak && this.noiseBuffer) {
      const clap = ctx.createBufferSource();
      clap.buffer = this.noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(isStrongClap ? 1550 : 2100, time);
      filter.Q.value = isStrongClap ? 1.1 : 2.2;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(isStrongClap ? 0.34 : 0.17, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + (isStrongClap ? 0.11 : 0.065));

      clap.connect(filter);
      filter.connect(gain);
      gain.connect(out);
      clap.start(time);
      clap.stop(time + 0.12);
    }

    // 2. Heroic Egyptian Brass & Stadium Chant Melody (64-step / 4-bar celebratory loop in D Hijaz / D Minor)
    // Notes (Hz): D4=293.66, Eb4=311.13, E4=329.63, F4=349.23, F#4=369.99, G4=392.0, A4=440.0, Bb4=466.16, C5=523.25, D5=587.33
    const melodyMap: Record<number, [number, number]> = {
      // Bar 1: Heroic Pharaohs Stadium Horn Fanfare ("مصر.. يا أم الدنيا")
      0: [293.66, 2],
      2: [440.0, 2],
      4: [466.16, 2],
      6: [440.0, 2],
      8: [392.0, 2],
      10: [369.99, 2],
      12: [392.0, 2],
      14: [440.0, 2],
      // Bar 2: Ascending Cheer ("هيه هيه.. شجع مصر!")
      16: [587.33, 2],
      18: [523.25, 2],
      20: [466.16, 2],
      22: [440.0, 2],
      24: [392.0, 2],
      26: [369.99, 2],
      28: [293.66, 4],
      // Bar 3: Rhythmic Crowd Chant Stabs ("شجع شجع يا مصري!")
      32: [440.0, 2],
      35: [440.0, 1],
      36: [466.16, 2],
      38: [440.0, 2],
      40: [392.0, 2],
      42: [369.99, 2],
      44: [311.13, 2],
      46: [369.99, 2],
      // Bar 4: Triumphant Resolution & Stadium Roar Pickup
      48: [440.0, 3],
      52: [392.0, 2],
      54: [369.99, 2],
      56: [311.13, 2],
      58: [293.66, 6],
    };

    const note = melodyMap[step];
    if (note) {
      const [freq, durSteps] = note;
      const dur = durSteps * stepDur * 0.92;

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(freq, time);
      osc2.frequency.setValueAtTime(freq * 0.5, time); // warm octave reinforcement

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(1750, time);
      lp.frequency.exponentialRampToValueAtTime(950, time + dur);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(0.16, time + 0.025);
      gain.gain.setValueAtTime(0.13, time + Math.max(0.04, dur * 0.65));
      gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

      osc1.connect(lp);
      osc2.connect(lp);
      lp.connect(gain);
      gain.connect(out);

      osc1.start(time);
      osc2.start(time);
      osc1.stop(time + dur + 0.02);
      osc2.stop(time + dur + 0.02);
    }

    // 3. Warm Bassline anchoring each bar (D2 - Gm - Eb - D2)
    const bassMap: Record<number, number> = {
      0: 73.42, // D2
      8: 73.42,
      16: 98.0, // G2
      24: 73.42, // D2
      32: 116.54, // Bb2
      40: 98.0, // G2
      48: 77.78, // Eb2
      56: 73.42, // D2
    };
    const bassFreq = bassMap[step];
    if (bassFreq) {
      const bOsc = ctx.createOscillator();
      const bGain = ctx.createGain();
      bOsc.type = 'triangle';
      bOsc.frequency.setValueAtTime(bassFreq, time);
      bGain.gain.setValueAtTime(0.001, time);
      bGain.gain.linearRampToValueAtTime(0.24, time + 0.03);
      bGain.gain.exponentialRampToValueAtTime(0.001, time + stepDur * 7.2);
      bOsc.connect(bGain);
      bGain.connect(out);
      bOsc.start(time);
      bOsc.stop(time + stepDur * 7.4);
    }

    // 4. Periodic Stadium Crowd Swell ("Oooooh!") on bar 1 and bar 3 downbeats
    if ((step === 0 || step === 32) && this.noiseBuffer) {
      const crowd = ctx.createBufferSource();
      crowd.buffer = this.noiseBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(620, time);
      bp.frequency.linearRampToValueAtTime(980, time + 0.7);
      bp.Q.value = 0.9;

      const cGain = ctx.createGain();
      cGain.gain.setValueAtTime(0.005, time);
      cGain.gain.linearRampToValueAtTime(0.14, time + 0.35);
      cGain.gain.exponentialRampToValueAtTime(0.001, time + 1.4);

      crowd.connect(bp);
      bp.connect(cGain);
      cGain.connect(out);
      crowd.start(time);
      crowd.stop(time + 1.45);
    }
  }

  public startStadiumAmbience() {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer || this.ambienceSource) return;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 580;
    filter.Q.value = 0.65;

    const gain = ctx.createGain();
    gain.gain.value = this.muted ? 0 : 0.032;

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();

    this.ambienceSource = src;
    this.ambienceGain = gain;
  }

  public stopStadiumAmbience() {
    if (this.ambienceSource) {
      try {
        this.ambienceSource.stop();
      } catch {
        // ignore
      }
      this.ambienceSource.disconnect();
      this.ambienceSource = null;
      this.ambienceGain = null;
    }
  }

  public playClick() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(640, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.045);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.055);
  }

  public playWhistle() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const masterGain = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'sine';
    osc1.frequency.setValueAtTime(2820, now);
    osc2.frequency.setValueAtTime(3140, now);

    // Pea-whistle trill modulation
    lfo.frequency.setValueAtTime(38, now);
    lfoGain.gain.setValueAtTime(120, now);
    lfo.connect(lfoGain);
    lfoGain.connect(osc1.frequency);

    masterGain.gain.setValueAtTime(0.001, now);
    masterGain.gain.linearRampToValueAtTime(0.11, now + 0.025);
    masterGain.gain.setValueAtTime(0.1, now + 0.24);
    masterGain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);

    osc1.connect(masterGain);
    osc2.connect(masterGain);
    masterGain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    lfo.start(now);
    osc1.stop(now + 0.35);
    osc2.stop(now + 0.35);
    lfo.stop(now + 0.35);
  }

  public playKick(power = 0.7) {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const vol = 0.22 + power * 0.16;

    // Low punchy leather thump
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(145 + power * 45, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.15);

    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.17);

    // Spin air whoosh
    if (this.noiseBuffer) {
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(900, now);
      filter.frequency.exponentialRampToValueAtTime(2400, now + 0.22);
      filter.Q.value = 1.6;

      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.12 + power * 0.08, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(ctx.destination);
      noise.start(now);
      noise.stop(now + 0.3);
    }
  }

  public playCrossbar() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const freqs = [415, 882, 1345];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.exponentialRampToValueAtTime(f * 0.96, now + 0.55);

      gain.gain.setValueAtTime(0.15 / (idx + 1), now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.58);
    });
  }

  public playSave() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Glove thud
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + 0.14);
    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);

    // Crowd gasp / cheer swell
    if (this.noiseBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(850, now);
      filter.Q.value = 0.8;

      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.01, now);
      nGain.gain.linearRampToValueAtTime(0.16, now + 0.12);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

      src.connect(filter);
      filter.connect(nGain);
      nGain.connect(ctx.destination);
      src.start(now);
      src.stop(now + 0.95);
    }
  }

  public playGoal() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Massive stadium roar
    if (this.noiseBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(600, now);
      filter.frequency.linearRampToValueAtTime(1250, now + 0.45);
      filter.Q.value = 0.6;

      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.02, now);
      nGain.gain.linearRampToValueAtTime(0.28, now + 0.25);
      nGain.gain.setValueAtTime(0.24, now + 1.0);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 2.1);

      src.connect(filter);
      filter.connect(nGain);
      nGain.connect(ctx.destination);
      src.start(now);
      src.stop(now + 2.15);
    }

    // Celebratory stadium brass chord (C5 - E5 - G5 - C6)
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2200, now);

      const start = now + idx * 0.055;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.065, start + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.75);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.8);
    });
  }

  public playMiss() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    if (this.noiseBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(520, now);
      filter.frequency.linearRampToValueAtTime(280, now + 0.7);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.02, now);
      gain.gain.linearRampToValueAtTime(0.14, now + 0.14);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      src.start(now);
      src.stop(now + 0.9);
    }
  }

  public playCoin() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    [987.77, 1318.51].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.07);
      gain.gain.setValueAtTime(0.09, now + i * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.07);
      osc.stop(now + i * 0.07 + 0.24);
    });
  }

  public playVictory() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const melody = [523.25, 659.25, 783.99, 1046.5];
    melody.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t = now + i * 0.11;
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.11, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.48);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.5);
    });
  }
}

export const soundEngine = new SoundEngine();
