/**
 * Deck & Tackle — Comprehensive Lovecraftian Audio Engine
 * Handles seamless soundtrack looping, Web Audio API gain routing,
 * polyphonic horror sound effects, dynamic boat engine modulation, and browser autoplay policies.
 */

export type SFXName =
  | 'sfx_boat_engine_loop'
  | 'sfx_water_lap'
  | 'sfx_bell_buoy'
  | 'sfx_foghorn'
  | 'sfx_dock_bump'
  | 'sfx_cast_whoosh'
  | 'sfx_bobber_splash'
  | 'sfx_nibble_twitch'
  | 'sfx_bite_splash'
  | 'sfx_card_draw'
  | 'sfx_card_play'
  | 'sfx_reel_ratchet'
  | 'sfx_drag_release'
  | 'sfx_tension_strike'
  | 'sfx_fish_thrash'
  | 'sfx_fish_deep_dive'
  | 'sfx_line_warning'
  | 'sfx_line_snap'
  | 'sfx_catch_victory'
  | 'sfx_gold_coins'
  | 'sfx_button_click';

export type MusicMode = 'menu' | 'overworld' | 'storefront';

export class AudioManager {
  private static instance: AudioManager | null = null;

  // Web Audio Context & Gain Hierarchy
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  // Volume settings (0.0 to 1.0)
  public masterVolume: number = 0.8;
  public bgmVolume: number = 0.65;
  public sfxVolume: number = 0.60;
  public isMuted: boolean = false;
  public isMusicMuted: boolean = false;

  // Background Music Channels (Menu, Overworld & Storefront)
  public currentMusicMode: MusicMode = 'menu';
  private previousMusicMode: MusicMode | null = null;
  private bgmMenu: HTMLAudioElement | null = null;
  private bgmOverworld: HTMLAudioElement | null = null;
  private bgmStorefront: HTMLAudioElement | null = null;
  private crossfadeProgress: number = 1.0; // 0.0 = beginning of crossfade, 1.0 = transition complete
  private crossfadeDuration: number = 1.8; // smooth transition seconds
  private targetDuckFactor: number = 1.0;
  private currentDuckFactor: number = 1.0;
  private userHasInteracted: boolean = false;
  private isAttemptingBgmPlay: boolean = false;
  private interactionHandlers: Array<{ target: EventTarget; event: string; fn: EventListener }> = [];

  // Audio Buffers Cache for low-latency Web Audio playback
  private sfxBuffers: Map<SFXName, AudioBuffer> = new Map();
  private sfxLoading: Set<SFXName> = new Set();

  // Engine loop audio
  private engineAudio: HTMLAudioElement | null = null;
  private isEnginePlaying: boolean = false;
  private engineTargetVolume: number = 0;
  private engineCurrentVolume: number = 0;

  // Debounce timers
  private lastCollisionSoundTime: number = 0;
  private lastWarningSoundTime: number = 0;
  private lastAmbientSoundTime: number = 0;

  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  private constructor() {
    this.loadSettings();
    this.setupUserInteractionListener();
    // Attempt playback immediately on boot (works if browser allows or MEI is satisfied)
    this.startSoundtrack();
  }

  /**
   * Initializes the AudioContext upon user interaction (browser autoplay policy)
   */
  public initContext(): void {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.bgmGain = this.ctx.createGain();
        this.sfxGain = this.ctx.createGain();

        this.bgmGain.connect(this.masterGain);
        this.sfxGain.connect(this.masterGain);
        this.masterGain.connect(this.ctx.destination);

        this.applyVolumes();
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    this.ensureActiveMusicPlaying();
  }

  private setupUserInteractionListener(): void {
    const handleInteraction = () => {
      this.userHasInteracted = true;
      this.initContext();
      this.ensureActiveMusicPlaying();
    };

    const events = ['click', 'pointerdown', 'mousedown', 'keydown', 'touchstart'];
    const targets: EventTarget[] = [window, document];

    events.forEach((evt) => {
      targets.forEach((tgt) => {
        tgt.addEventListener(evt, handleInteraction, { capture: true, passive: true });
        this.interactionHandlers.push({ target: tgt, event: evt, fn: handleInteraction });
      });
    });
  }

  public removeInteractionListeners(): void {
    for (const h of this.interactionHandlers) {
      h.target.removeEventListener(h.event, h.fn, { capture: true } as EventListenerOptions);
    }
    this.interactionHandlers = [];
  }

  private loadSettings(): void {
    try {
      const savedMute = localStorage.getItem('deck_and_tackle_mute');
      if (savedMute !== null) this.isMuted = savedMute === 'true';

      const savedMusicMute = localStorage.getItem('deck_and_tackle_music_mute');
      if (savedMusicMute !== null) this.isMusicMuted = savedMusicMute === 'true';

      const savedVol = localStorage.getItem('deck_and_tackle_volume');
      if (savedVol !== null) this.masterVolume = parseFloat(savedVol);
    } catch {
      // Ignore local storage errors
    }
  }

  public saveSettings(): void {
    try {
      localStorage.setItem('deck_and_tackle_mute', String(this.isMuted));
      localStorage.setItem('deck_and_tackle_music_mute', String(this.isMusicMuted));
      localStorage.setItem('deck_and_tackle_volume', String(this.masterVolume));
    } catch {
      // Ignore
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    this.applyVolumes();
    this.saveSettings();
    return this.isMuted;
  }

  public toggleMusicMute(): boolean {
    this.isMusicMuted = !this.isMusicMuted;
    this.applyVolumes();
    this.saveSettings();
    return this.isMusicMuted;
  }

  public setMasterVolume(val: number): void {
    this.masterVolume = Math.max(0, Math.min(1, val));
    this.applyVolumes();
    this.saveSettings();
  }

  private applyVolumes(): void {
    const effectiveMaster = this.isMuted ? 0 : this.masterVolume;
    const effectiveBgmVolume = (this.isMuted || this.isMusicMuted) ? 0 : this.bgmVolume;

    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(effectiveMaster, this.ctx.currentTime, 0.05);
    }
    if (this.bgmGain && this.ctx) {
      this.bgmGain.gain.setTargetAtTime(effectiveBgmVolume, this.ctx.currentTime, 0.05);
    }
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setTargetAtTime(this.sfxVolume, this.ctx.currentTime, 0.05);
    }

    const baseBgm = effectiveMaster * effectiveBgmVolume * this.currentDuckFactor;

    // Crossfade weights for each channel
    let menuGain = 0;
    let overworldGain = 0;
    let storefrontGain = 0;

    if (this.crossfadeProgress >= 1.0 || !this.previousMusicMode) {
      if (this.currentMusicMode === 'menu') menuGain = 1.0;
      else if (this.currentMusicMode === 'overworld') overworldGain = 1.0;
      else if (this.currentMusicMode === 'storefront') storefrontGain = 1.0;
    } else {
      // Sinusoidal equal-power crossfade curve: cos for outgoing, sin for incoming
      const incomingWeight = Math.sin(this.crossfadeProgress * Math.PI * 0.5);
      const outgoingWeight = Math.cos(this.crossfadeProgress * Math.PI * 0.5);

      if (this.currentMusicMode === 'menu') menuGain = incomingWeight;
      else if (this.currentMusicMode === 'overworld') overworldGain = incomingWeight;
      else if (this.currentMusicMode === 'storefront') storefrontGain = incomingWeight;

      if (this.previousMusicMode === 'menu') menuGain = outgoingWeight;
      else if (this.previousMusicMode === 'overworld') overworldGain = outgoingWeight;
      else if (this.previousMusicMode === 'storefront') storefrontGain = outgoingWeight;
    }

    // Apply normalized volume levels (fight music is -13.1 LUFS so trimmed to 0.72 to match overworld -16.0 LUFS)
    if (this.bgmMenu) {
      this.bgmMenu.volume = Math.max(0, Math.min(1, baseBgm * menuGain * 0.72));
    }
    if (this.bgmOverworld) {
      this.bgmOverworld.volume = Math.max(0, Math.min(1, baseBgm * overworldGain * 1.0));
    }
    if (this.bgmStorefront) {
      this.bgmStorefront.volume = Math.max(0, Math.min(1, baseBgm * storefrontGain * 0.85));
    }

    if (this.engineAudio) {
      this.engineAudio.volume = effectiveMaster * this.sfxVolume * this.engineCurrentVolume;
    }
  }

  // ==========================================
  // BACKGROUND SOUNDTRACK (BGM) & CROSSFADING
  // ==========================================

  private ensureMusicElementsCreated(): void {
    if (!this.bgmMenu) {
      this.bgmMenu = new Audio('/audio/music/fight_music.mp3');
      this.bgmMenu.loop = true;
      this.bgmMenu.preload = 'auto';
    }
    if (!this.bgmOverworld) {
      this.bgmOverworld = new Audio('/audio/music/Overworld_Slow_Suite.mp3');
      this.bgmOverworld.loop = true;
      this.bgmOverworld.preload = 'auto';
    }
    if (!this.bgmStorefront) {
      this.bgmStorefront = new Audio('/audio/music/storefront_music.mp3');
      this.bgmStorefront.loop = true;
      this.bgmStorefront.preload = 'auto';
    }
  }

  private getAudioElement(mode: MusicMode): HTMLAudioElement | null {
    if (mode === 'menu') return this.bgmMenu;
    if (mode === 'overworld') return this.bgmOverworld;
    if (mode === 'storefront') return this.bgmStorefront;
    return null;
  }

  public startSoundtrack(): void {
    this.ensureMusicElementsCreated();
    this.applyVolumes();
    this.ensureActiveMusicPlaying();
  }

  /**
   * Ensures the appropriate track for the current music mode is playing.
   * If blocked by browser autoplay policy, it safely retries as soon as user interaction occurs.
   */
  public ensureActiveMusicPlaying(): void {
    if (this.isAttemptingBgmPlay) return;

    this.ensureMusicElementsCreated();
    const active = this.getAudioElement(this.currentMusicMode);
    if (active && active.paused) {
      this.isAttemptingBgmPlay = true;
      this.applyVolumes();
      active.play()
        .then(() => {
          this.isAttemptingBgmPlay = false;
          this.removeInteractionListeners();
        })
        .catch(() => {
          this.isAttemptingBgmPlay = false;
        });
    }
  }

  /**
   * Smoothly crossfades between any music modes (menu, overworld, storefront).
   * Uses an equal-power sinusoidal curve so the perceived volume remains consistent with zero jarring cuts.
   */
  public transitionToMusic(mode: MusicMode, duration: number = 1.8): void {
    if (this.currentMusicMode === mode && this.crossfadeProgress >= 1.0) return;

    this.previousMusicMode = this.currentMusicMode;
    this.currentMusicMode = mode;
    this.crossfadeDuration = Math.max(0.2, duration);
    this.crossfadeProgress = 0.0;

    this.ensureMusicElementsCreated();

    // Wake up the incoming track at 0 volume so it crossfades in smoothly
    const incoming = this.getAudioElement(mode);
    if (incoming && incoming.paused) {
      incoming.volume = 0;
      incoming.play().catch(() => {});
    }

    this.applyVolumes();
  }

  public duckSoundtrack(factor: number = 0.45): void {
    this.targetDuckFactor = factor;
  }

  public unduckSoundtrack(): void {
    this.targetDuckFactor = 1.0;
  }

  // ==========================================
  // SOUND EFFECTS (SFX) PLAYBACK
  // ==========================================

  /**
   * Preload an audio file into AudioBuffer for zero-latency Web Audio triggering
   */
  public preloadSFX(name: SFXName): void {
    if (this.sfxBuffers.has(name) || this.sfxLoading.has(name)) return;
    this.sfxLoading.add(name);

    fetch(`/audio/sfx/${name}.mp3`)
      .then((res) => res.arrayBuffer())
      .then((data) => {
        if (this.ctx) {
          return this.ctx.decodeAudioData(data);
        }
        return null;
      })
      .then((decoded) => {
        if (decoded) {
          this.sfxBuffers.set(name, decoded);
        }
        this.sfxLoading.delete(name);
      })
      .catch(() => {
        this.sfxLoading.delete(name);
      });
  }

  /**
   * Play any sound effect by name with optional volume scaling and pitch variance
   */
  public play(name: SFXName, volumeScale: number = 1.0, pitchShift: number = 1.0): void {
    if (this.isMuted) return;
    this.initContext();

    // Prefer Web Audio API buffer if ready for ultra-low latency polyphony
    const buffer = this.sfxBuffers.get(name);
    if (this.ctx && this.sfxGain && buffer) {
      try {
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = pitchShift;

        const gainNode = this.ctx.createGain();
        gainNode.gain.value = volumeScale;

        source.connect(gainNode);
        gainNode.connect(this.sfxGain);

        source.start(0);
        return;
      } catch {
        // Fall back to HTMLAudioElement below
      }
    }

    // HTMLAudioElement Fallback
    try {
      const audio = new Audio(`/audio/sfx/${name}.mp3`);
      audio.volume = Math.max(0, Math.min(1, this.masterVolume * this.sfxVolume * volumeScale));
      audio.playbackRate = pitchShift;
      audio.play().catch(() => {});
    } catch {
      // Ignore
    }

    // Also initiate background buffer preload for subsequent plays
    this.preloadSFX(name);
  }

  // ==========================================
  // GAMEPLAY CONVENIENCE METHODS
  // ==========================================

  /**
   * Updates dynamic continuous audio parameters (engine loop, ambient events, soundtrack crossfading)
   */
  public update(dt: number, boatSpeed: number, isOverworld: boolean): void {
    // 1. Advance soundtrack crossfade progress towards 1.0
    if (this.crossfadeProgress < 1.0) {
      this.crossfadeProgress = Math.min(1.0, this.crossfadeProgress + dt / Math.max(0.1, this.crossfadeDuration));

      // Pause dormant outgoing track when crossfade is complete to free CPU
      if (this.crossfadeProgress >= 1.0 && this.previousMusicMode && this.previousMusicMode !== this.currentMusicMode) {
        const prev = this.getAudioElement(this.previousMusicMode);
        if (prev && !prev.paused) {
          prev.pause();
        }
      }
    }

    // 2. Smooth duck factor interpolation towards targetDuckFactor
    if (Math.abs(this.targetDuckFactor - this.currentDuckFactor) > 0.001) {
      this.currentDuckFactor += (this.targetDuckFactor - this.currentDuckFactor) * Math.min(1.0, dt * 5);
    } else {
      this.currentDuckFactor = this.targetDuckFactor;
    }

    // Apply updated music and ducking gains to audio elements
    this.applyVolumes();

    // Ensure active music is playing if it was delayed by initial browser autoplay restrictions
    const currentAudio = this.getAudioElement(this.currentMusicMode);
    if (currentAudio?.paused && this.crossfadeProgress >= 0.95 && this.userHasInteracted) {
      this.ensureActiveMusicPlaying();
    }

    // 3. Boat Engine Audio
    if (isOverworld) {
      if (!this.engineAudio) {
        this.engineAudio = new Audio('/audio/sfx/sfx_boat_engine_loop.mp3');
        this.engineAudio.loop = true;
        this.engineAudio.preload = 'auto';
      }

      if (boatSpeed > 5) {
        const speedRatio = Math.min(1.0, boatSpeed / 125);
        this.engineTargetVolume = 0.08 + 0.28 * speedRatio;
        if (!this.isEnginePlaying) {
          this.engineAudio.play().then(() => {
            this.isEnginePlaying = true;
          }).catch(() => {});
        }
      } else {
        this.engineTargetVolume = 0;
      }

      // Smooth volume interpolation
      this.engineCurrentVolume += (this.engineTargetVolume - this.engineCurrentVolume) * Math.min(1.0, dt * 4);
      if (this.engineAudio) {
        this.engineAudio.volume = this.isMuted ? 0 : this.masterVolume * this.sfxVolume * this.engineCurrentVolume;
      }

      // 2. Occasional distant ambient sound (Foghorn or Bell Buoy every 35-50s)
      this.lastAmbientSoundTime += dt;
      if (this.lastAmbientSoundTime > 40) {
        this.lastAmbientSoundTime = 0;
        if (Math.random() > 0.45) {
          this.play('sfx_foghorn', 0.5);
        } else {
          this.play('sfx_bell_buoy', 0.45);
        }
      }
    } else {
      // In combat or shop, mute boat engine
      if (this.engineAudio && this.isEnginePlaying) {
        this.engineAudio.pause();
        this.isEnginePlaying = false;
        this.engineCurrentVolume = 0;
      }
    }
  }

  public playDockBump(): void {
    const now = performance.now();
    if (now - this.lastCollisionSoundTime > 1200) {
      this.lastCollisionSoundTime = now;
      this.play('sfx_dock_bump', 0.85);
    }
  }

  public playWaterLap(): void {
    this.play('sfx_water_lap', 0.6);
  }

  public playCastWhoosh(): void {
    this.play('sfx_cast_whoosh', 0.55);
  }

  public playBobberSplash(): void {
    this.play('sfx_bobber_splash', 0.60);
  }

  public playNibbleTwitch(): void {
    this.play('sfx_nibble_twitch', 0.50);
  }

  public playBiteSplash(): void {
    this.duckSoundtrack(0.45);
    this.play('sfx_bite_splash', 0.70);
    setTimeout(() => this.unduckSoundtrack(), 2000);
  }

  public playCardDraw(): void {
    this.play('sfx_card_draw', 0.40);
  }

  public playCardPlay(cardType?: string): void {
    this.play('sfx_card_play', 0.50);

    if (cardType === 'technique') {
      this.play('sfx_tension_strike', 0.85, 0.65);
    } else if (cardType === 'reel') {
      this.play('sfx_reel_ratchet', 0.50);
    } else if (cardType === 'drag') {
      this.play('sfx_drag_release', 0.45);
    } else if (cardType === 'strike') {
      this.play('sfx_tension_strike', 0.55);
    }
  }

  public playFishThrash(): void {
    this.play('sfx_fish_thrash', 0.60);
  }

  public playFishDeepDive(): void {
    this.play('sfx_fish_deep_dive', 0.65);
  }

  public playLineWarning(): void {
    const now = performance.now();
    if (now - this.lastWarningSoundTime > 2500) {
      this.lastWarningSoundTime = now;
      this.play('sfx_line_warning', 0.50);
    }
  }

  public playLineSnap(): void {
    this.duckSoundtrack(0.2);
    this.play('sfx_line_snap', 0.75);
    setTimeout(() => this.unduckSoundtrack(), 2500);
  }

  public playCatchVictory(): void {
    this.duckSoundtrack(0.45);
    this.play('sfx_catch_victory', 0.65);
    setTimeout(() => this.unduckSoundtrack(), 3500);
  }

  public playGoldCoins(): void {
    this.play('sfx_gold_coins', 0.45);
  }

  public playUpgradeAcquired(): void {
    this.play('sfx_gold_coins', 0.55);
    setTimeout(() => {
      this.play('sfx_tension_strike', 0.65, 0.5);
    }, 80);
  }

  public playButtonClick(): void {
    this.play('sfx_button_click', 0.45);
  }
}
