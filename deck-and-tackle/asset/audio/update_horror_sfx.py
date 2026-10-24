import math
import struct
import random
import wave
import os
import subprocess

SR = 48000
ASSET_SFX_DIR = "deck-and-tackle/asset/audio/sfx"
PUBLIC_SFX_DIR = "deck-and-tackle/public/audio/sfx"
os.makedirs(ASSET_SFX_DIR, exist_ok=True)
os.makedirs(PUBLIC_SFX_DIR, exist_ok=True)

def clamp(val, low=-1.0, high=1.0):
    return max(low, min(high, val))

def soft_clip(x):
    if x > 1.0:
        return 1.0 - math.exp(-(x - 1.0)) * 0.5
    elif x < -1.0:
        return -1.0 + math.exp(x + 1.0) * 0.5
    return x - (x ** 3) / 6.0

def save_wav(filepath, left, right=None, target_peak=0.80):
    if right is None:
        right = list(left)
    assert len(left) == len(right)
    max_peak = max(max(abs(s) for s in left), max(abs(s) for s in right))
    gain = target_peak / max_peak if max_peak > 0 else 1.0
    
    with wave.open(filepath, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        frames = bytearray()
        for l, r in zip(left, right):
            sl = int(clamp(soft_clip(l * gain)) * 32767)
            sr = int(clamp(soft_clip(r * gain)) * 32767)
            frames.extend(struct.pack('<hh', sl, sr))
        w.writeframes(frames)

class Biquad:
    def __init__(self, filter_type, freq, q=0.707):
        self.set_coeffs(filter_type, freq, q)
        self.x1 = self.x2 = self.y1 = self.y2 = 0.0

    def set_coeffs(self, filter_type, freq, q=0.707):
        freq = clamp(freq, 20.0, SR * 0.48)
        w0 = 2.0 * math.pi * freq / SR
        alpha = math.sin(w0) / (2.0 * q)
        cos_w0 = math.cos(w0)

        if filter_type == 'lp':
            b0 = (1.0 - cos_w0) / 2.0
            b1 = 1.0 - cos_w0
            b2 = (1.0 - cos_w0) / 2.0
            a0 = 1.0 + alpha
            a1 = -2.0 * cos_w0
            a2 = 1.0 - alpha
        elif filter_type == 'bp':
            b0 = alpha
            b1 = 0.0
            b2 = -alpha
            a0 = 1.0 + alpha
            a1 = -2.0 * cos_w0
            a2 = 1.0 - alpha
        else:
            b0, b1, b2, a0, a1, a2 = 1.0, 0.0, 0.0, 1.0, 0.0, 0.0

        self.b0 = b0 / a0
        self.b1 = b1 / a0
        self.b2 = b2 / a0
        self.a1 = a1 / a0
        self.a2 = a2 / a0

    def process(self, x):
        y = self.b0 * x + self.b1 * self.x1 + self.b2 * self.x2 - self.a1 * self.y1 - self.a2 * self.y2
        self.x2, self.x1 = self.x1, x
        self.y2, self.y1 = self.y1, y
        return y

class PinkNoise:
    def __init__(self):
        self.b0 = self.b1 = self.b2 = self.b3 = self.b4 = self.b5 = self.b6 = 0.0

    def next(self):
        white = random.uniform(-1.0, 1.0)
        self.b0 = 0.99886 * self.b0 + white * 0.0555179
        self.b1 = 0.99332 * self.b1 + white * 0.0750759
        self.b2 = 0.96900 * self.b2 + white * 0.1538520
        self.b3 = 0.86650 * self.b3 + white * 0.3104856
        self.b4 = 0.55000 * self.b4 + white * 0.5329522
        self.b5 = -0.7616 * self.b5 - white * 0.0168980
        pink = self.b0 + self.b1 + self.b2 + self.b3 + self.b4 + self.b5 + self.b6 + white * 0.5362
        self.b6 = white * 0.115926
        return pink * 0.11

# ==============================================================
# REFINED QUIETER & DARKER / NON-HAPPY RECIPES
# ==============================================================

# 1. BOAT ENGINE: Soft, warm, muffled vintage underwater/hull purr
def gen_boat_engine_muffled():
    duration = 3.0
    N = int(SR * duration)
    left, right = [0.0]*N, [0.0]*N
    pulse_rate = 5.0
    period_samples = int(SR / pulse_rate)
    num_pulses = int(duration * pulse_rate)
    pink = PinkNoise()
    lp = Biquad('lp', 340, 1.0) # Heavy lowpass: removes harsh clatter
    
    for p in range(num_pulses):
        p_start = p * period_samples
        for j in range(period_samples):
            idx = p_start + j
            if idx >= N: break
            t_pulse = j / SR
            
            # Soft, warm sub-thump (42 Hz)
            thump_env = math.exp(-t_pulse / 0.08)
            thump = math.sin(2.0 * math.pi * 42.0 * t_pulse) * thump_env * 0.8
            
            # Muffled water exhaust puff
            puff_env = math.sin(math.pi * min(1.0, t_pulse / 0.10)) * math.exp(-t_pulse / 0.12)
            puff = lp.process(pink.next()) * puff_env * 0.5
            
            val = thump + puff
            left[idx] += val
            right[idx] += val * 0.98
            
    # Smoothing loop boundaries
    fade = int(SR * 0.05)
    for i in range(fade):
        w = i / fade
        left[i] *= w
        right[i] *= w
        left[N - 1 - i] *= w
        right[N - 1 - i] *= w
        
    return left, right

# 2. CATCH VICTORY: Completely non-happy! Single mournful C-minor church toll + heavy wet abomination flop
def gen_catch_victory_grim():
    duration = 3.6
    N = int(SR * duration)
    left, right = [0.0]*N, [0.0]*N
    
    # Single heavy, dark, mournful toll (C3 130.8 Hz fundamental with cold decaying partials)
    # ZERO ascending chords!
    bell_f0 = 130.81
    bell_modes = [
        (1.0, 1.0, 3.4),     # C3
        (1.5, 0.45, 2.8),    # G3 fifth
        (2.0, 0.35, 2.2),    # C4
        (2.38, 0.40, 1.8),   # Eb4 minor 3rd (dark mournful dissonance)
        (3.14, 0.20, 1.2),   # F#4 tritone
    ]
    
    for ratio, amp, decay in bell_modes:
        freq = bell_f0 * ratio
        for i in range(N):
            t = i / SR
            env = math.exp(-t / (decay * 0.8))
            val = math.sin(2.0 * math.pi * freq * t) * env * amp * 0.4
            left[i] += val
            right[i] += val * 0.94
            
    # Heavy, grotesque wet abomination landed onto the wooden bilge/creel at 0.5s
    pink = PinkNoise()
    lp = Biquad('lp', 550, 1.4)
    k_idx = int(0.48 * SR)
    for j in range(int(SR * 0.45)):
        idx = k_idx + j
        if idx >= N: break
        t_rel = j / SR
        env = math.exp(-t_rel / 0.14)
        thump = math.sin(2.0 * math.pi * 58.0 * t_rel) * env * 0.9
        slither = lp.process(pink.next()) * env * 0.75
        val = thump + slither
        left[idx] += val
        right[idx] += val * 0.92
        
    return left, right

# 3. GOLD COINS: Dense, heavy, dull ancient Innsmouth bullion (no casino pings)
def gen_gold_coins_grim():
    duration = 1.4
    N = int(SR * duration)
    left, right = [0.0]*N, [0.0]*N
    
    # Low, leaden metal clunks: 320Hz to 850Hz (muffled, dark)
    coin_freqs = [340.0, 480.0, 620.0, 750.0]
    delays = [0.05, 0.22, 0.38, 0.54]
    
    for c_i, (freq, delay) in enumerate(zip(coin_freqs, delays)):
        d_idx = int(delay * SR)
        pan = 0.4 + 0.2 * (c_i / 3.0)
        for j in range(int(SR * 0.35)):
            idx = d_idx + j
            if idx >= N: break
            t_rel = j / SR
            env = math.exp(-t_rel / 0.14)
            # Low, tarnished leaden clunk
            thud = math.sin(2.0 * math.pi * 140.0 * t_rel) * math.exp(-t_rel / 0.03) * 0.6
            clunk = math.sin(2.0 * math.pi * freq * t_rel) * env * 0.45
            val = thud + clunk
            left[idx] += val * pan
            right[idx] += val * (1.0 - pan)
            
    return left, right

# 4. CARD DRAW: Quiet, dry, muted parchment rustle
def gen_card_draw_dark():
    duration = 0.45
    N = int(SR * duration)
    left, right = [0.0]*N, [0.0]*N
    pink = PinkNoise()
    bp = Biquad('bp', 650, 1.8)
    
    for i in range(N):
        t = i / SR
        env = (math.sin(math.pi * (t / duration)) ** 1.8) * 0.8
        val = bp.process(pink.next()) * env * 1.2
        left[i] = val
        right[i] = val * 0.95
        
    return left, right

# 5. CARD PLAY: Muffled ritual thud & sub-pulse (no high chime)
def gen_card_play_dark():
    duration = 0.75
    N = int(SR * duration)
    left, right = [0.0]*N, [0.0]*N
    
    for i in range(N):
        t = i / SR
        # Muffled wooden altar thud (50 Hz)
        thud_env = math.exp(-t / 0.12)
        thud = math.sin(2.0 * math.pi * 50.0 * t) * thud_env * 1.2
        
        # Low, dark resonant hum (C2 65.4 Hz + subtle Eb2 77.8 Hz)
        hum_env = math.sin(math.pi * min(1.0, t / 0.6)) * math.exp(-t / 0.5)
        hum = (math.sin(2.0 * math.pi * 65.41 * t) * 0.6 + math.sin(2.0 * math.pi * 77.78 * t) * 0.3) * hum_env * 0.5
        
        val = soft_clip(thud + hum)
        left[i] = val
        right[i] = val * 0.94
        
    return left, right

# 6. REEL RATCHET: Heavy, dark, rusted iron winch gear clunks (not high/zippy)
def gen_reel_ratchet_dark():
    duration = 1.1
    N = int(SR * duration)
    left, right = [0.0]*N, [0.0]*N
    num_clicks = 18  # Slower, heavier gear teeth
    
    for c in range(num_clicks):
        t_click = 0.05 + 0.95 * ((c / num_clicks) ** 1.1)
        c_idx = int(t_click * SR)
        for j in range(int(SR * 0.04)):
            idx = c_idx + j
            if idx >= N: break
            t_rel = j / SR
            
            # Lower-pitched iron gear click (750 Hz instead of 3200 Hz)
            click_env = math.exp(-t_rel / 0.007)
            click = math.sin(2.0 * math.pi * 750.0 * t_rel) * click_env * 0.9
            
            # Chassis iron clatter
            chassis_env = math.exp(-t_rel / 0.025)
            chassis = math.sin(2.0 * math.pi * 320.0 * t_rel) * chassis_env * 0.6
            
            val = click + chassis
            left[idx] += val
            right[idx] += val * 0.93
            
    return left, right

# 7. DRAG RELEASE: Muffled clutch slip hiss (no high screech)
def gen_drag_release_dark():
    duration = 1.3
    N = int(SR * duration)
    left, right = [0.0]*N, [0.0]*N
    pink = PinkNoise()
    bp = Biquad('bp', 1200, 2.2) # Filtered down from 2200 Hz
    
    for i in range(N):
        t = i / SR
        env = math.sin(math.pi * (t / duration)) ** 1.4
        flutter = 1.0 + 0.5 * math.sin(2.0 * math.pi * 38.0 * t)
        hiss = bp.process(pink.next()) * env * flutter * 1.3
        
        # Deep hull shudder
        shudder = math.sin(2.0 * math.pi * 44.0 * t) * env * 0.35
        val = soft_clip(hiss + shudder)
        left[i] = val
        right[i] = val * 0.95
        
    return left, right

# 8. TENSION STRIKE: Blunt, brutal heavy impact (no bright twang)
def gen_tension_strike_dark():
    duration = 0.9
    N = int(SR * duration)
    left, right = [0.0]*N, [0.0]*N
    pink = PinkNoise()
    
    for i in range(N):
        t = i / SR
        # Heavy sub-bass flesh/hull impact (46 Hz)
        thud_env = math.exp(-t / 0.22)
        thud = math.sin(2.0 * math.pi * 46.0 * t) * thud_env * 1.4
        
        # Muffled line whip through water (lowpassed)
        whip_env = math.exp(-t / 0.04)
        whip = pink.next() * whip_env * 0.9
        
        # Low line vibration (180 Hz)
        twang = math.sin(2.0 * math.pi * 180.0 * t) * math.exp(-t / 0.12) * 0.6
        
        val = soft_clip(thud + whip + twang)
        left[i] = val
        right[i] = val * 0.92
        
    return left, right

UPDATED_SFX = {
    "sfx_boat_engine_loop": (gen_boat_engine_muffled, "lowpass=f=450,loudnorm=I=-22:TP=-2.0:LRA=8"),
    "sfx_catch_victory": (gen_catch_victory_grim, "aecho=0.8:0.7:100|200:0.25|0.15,lowpass=f=8000,loudnorm=I=-18:TP=-2.0:LRA=10"),
    "sfx_gold_coins": (gen_gold_coins_grim, "lowpass=f=5000,loudnorm=I=-20:TP=-2.0:LRA=8"),
    "sfx_card_draw": (gen_card_draw_dark, "lowpass=f=6000,loudnorm=I=-20:TP=-2.0:LRA=8"),
    "sfx_card_play": (gen_card_play_dark, "lowpass=f=5500,loudnorm=I=-18:TP=-2.0:LRA=8"),
    "sfx_reel_ratchet": (gen_reel_ratchet_dark, "lowpass=f=6000,loudnorm=I=-19:TP=-2.0:LRA=8"),
    "sfx_drag_release": (gen_drag_release_dark, "lowpass=f=5500,loudnorm=I=-19:TP=-2.0:LRA=8"),
    "sfx_tension_strike": (gen_tension_strike_dark, "lowpass=f=6000,loudnorm=I=-18:TP=-2.0:LRA=8"),
}

if __name__ == "__main__":
    print(f"Synthesizing {len(UPDATED_SFX)} dark, quieter, non-happy horror sound effects...")
    for name, (gen_fn, af) in UPDATED_SFX.items():
        wav_path = os.path.join(ASSET_SFX_DIR, f"{name}.wav")
        left, right = gen_fn()
        save_wav(wav_path, left, right, target_peak=0.75)
        
        # Export to both asset/audio/sfx and public/audio/sfx
        for out_dir in [ASSET_SFX_DIR, PUBLIC_SFX_DIR]:
            mp3_path = os.path.join(out_dir, f"{name}.mp3")
            cmd = ['ffmpeg', '-y', '-i', wav_path, '-af', af, '-b:a', '192k', mp3_path]
            subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            
        if os.path.exists(wav_path):
            os.remove(wav_path)
        print(f"Updated dark SFX: {name}.mp3")
    print("All requested sounds updated to dark, muted horror aesthetic!")
