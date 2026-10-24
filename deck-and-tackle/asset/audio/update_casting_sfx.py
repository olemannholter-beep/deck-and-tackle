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

def save_wav(filepath, left, right=None, target_peak=0.75):
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
# REFINED DARK & HORROR CASTING / FISHING RECIPES
# ==============================================================

# 1. CAST WHOOSH: Heavy, ominous rod flex and cold air whoosh (no whistling chirps)
def gen_cast_whoosh_grim():
    duration = 0.85
    N = int(SR * duration)
    left, right = [0.0]*N, [0.0]*N
    pink = PinkNoise()
    bp = Biquad('bp', 350, 1.8)
    
    for i in range(N):
        t = i / SR
        # Heavy rod flex whoosh peaking at 0.22s
        if t < 0.22:
            env = math.sin(math.pi * 0.5 * (t / 0.22)) ** 1.8
            center_f = 160.0 + 550.0 * ((t / 0.22) ** 1.8)
        else:
            rel = (t - 0.22) / 0.63
            env = math.cos(math.pi * 0.5 * min(1.0, rel)) ** 1.5
            center_f = 710.0 - 500.0 * rel
            
        bp.set_coeffs('bp', center_f, 1.8)
        whoosh = bp.process(pink.next()) * env * 2.2
        
        # Low rod timber groan under centrifugal strain (82 Hz)
        groan_env = math.exp(-t / 0.25)
        groan = math.sin(2.0 * math.pi * 82.0 * t) * groan_env * 0.6
        
        # Muffled dark line release friction
        friction_env = math.sin(math.pi * min(1.0, t / 0.5)) * math.exp(-t / 0.45)
        friction = pink.next() * friction_env * 0.35
        
        val = soft_clip(whoosh + groan + friction)
        left[i] = val
        right[i] = val * 0.94
        
    return left, right

# 2. BOBBER SPLASH: Heavy, hollow abyssal plunge (deep water displacement, cold suction, NO cute bubble chirps)
def gen_bobber_splash_grim():
    duration = 1.3
    N = int(SR * duration)
    left, right = [0.0]*N, [0.0]*N
    pink = PinkNoise()
    lp = Biquad('lp', 450, 1.2) # Muffled: cuts high splash sparkles
    
    for i in range(N):
        t = i / SR
        # Dull lead weight slap
        slap_env = math.exp(-t / 0.035)
        slap = pink.next() * slap_env * 1.3
        
        # Deep subterranean water displacement thump (42 Hz pitch drop to 28 Hz)
        thump_env = math.exp(-t / 0.28)
        f_thump = 42.0 - 14.0 * min(1.0, t / 0.25)
        thump = math.sin(2.0 * math.pi * f_thump * t) * thump_env * 1.5
        
        # Dark, visceral water cavity suction ("glug" hollow swallow at 92 Hz)
        suction_env = math.sin(math.pi * min(1.0, t / 0.35)) * math.exp(-t / 0.45)
        suction = math.sin(2.0 * math.pi * 92.0 * t) * suction_env * 0.75
        
        # Muffled water churning displacement
        churn_env = math.sin(math.pi * min(1.0, t / 0.6)) * math.exp(-t / 0.5)
        churn = lp.process(pink.next()) * churn_env * 0.8
        
        val = soft_clip(slap + thump + suction + churn)
        left[i] = val
        right[i] = val * 0.95
        
    return left, right

# 3. NIBBLE TWITCH: Uncanny, tense line shudder & deep muffled pressure pop (sinister, not cute)
def gen_nibble_twitch_grim():
    duration = 0.55
    N = int(SR * duration)
    left, right = [0.0]*N, [0.0]*N
    
    for i in range(N):
        t = i / SR
        # Low, taut line shudder (140 Hz with deep 38 Hz amplitude modulation)
        shudder_env = math.exp(-t / 0.16)
        shudder_mod = 1.0 + 0.6 * math.sin(2.0 * math.pi * 38.0 * t)
        shudder = math.sin(2.0 * math.pi * 140.0 * t) * shudder_env * shudder_mod * 0.9
        
        # Muffled submerged pressure displacement (68 Hz sub-pop at 0.04s)
        if 0.03 <= t <= 0.20:
            pt = (t - 0.03) / 0.17
            p_env = math.sin(math.pi * pt) * math.exp(-pt * 2.0)
            pop = math.sin(2.0 * math.pi * 68.0 * t) * p_env * 0.8
        else:
            pop = 0.0
            
        val = soft_clip(shudder + pop)
        left[i] = val
        right[i] = val * 0.93
        
    return left, right

# 4. BITE SPLASH: Massive, terrifying subterranean breach & predatory jaw clamp (deep, visceral, non-screechy)
def gen_bite_splash_grim():
    duration = 1.9
    N = int(SR * duration)
    left, right = [0.0]*N, [0.0]*N
    pink = PinkNoise()
    lp = Biquad('lp', 500, 1.4)
    
    for i in range(N):
        t = i / SR
        # Infrasonic water rupture shockwave (34 Hz deep boom)
        sub_env = math.exp(-t / 0.32)
        sub = math.sin(2.0 * math.pi * 34.0 * t) * sub_env * 1.8
        
        # Heavy, dark water eruption churn
        churn_env = math.exp(-t / 0.42)
        churn = lp.process(pink.next() * 2.8) * churn_env
        
        # Guttural predatory jaw snap (low 85 Hz impact modulated by 26 Hz growl)
        snap_env = math.exp(-t / 0.14)
        snap = math.sin(2.0 * math.pi * 85.0 * t + 1.8 * math.sin(2.0 * math.pi * 26.0 * t)) * snap_env * 1.2
        
        # Secondary heavy wave surge at 0.25s
        if t > 0.22:
            t2 = t - 0.22
            surge_env = math.exp(-t2 / 0.35)
            surge = lp.process(pink.next()) * surge_env * 0.85
        else:
            surge = 0.0
            
        val = soft_clip(sub + churn + snap + surge)
        left[i] = val
        right[i] = val * 0.92
        
    return left, right

UPDATED_CASTING_SFX = {
    "sfx_cast_whoosh": (gen_cast_whoosh_grim, "lowpass=f=3500,loudnorm=I=-20:TP=-2.0:LRA=8"),
    "sfx_bobber_splash": (gen_bobber_splash_grim, "aecho=0.8:0.6:40|80:0.18|0.10,lowpass=f=3200,loudnorm=I=-19:TP=-2.0:LRA=8"),
    "sfx_nibble_twitch": (gen_nibble_twitch_grim, "lowpass=f=2800,loudnorm=I=-21:TP=-2.0:LRA=8"),
    "sfx_bite_splash": (gen_bite_splash_grim, "aecho=0.8:0.65:50|100:0.22|0.12,lowpass=f=4000,loudnorm=I=-17:TP=-2.0:LRA=10"),
}

if __name__ == "__main__":
    print(f"Synthesizing {len(UPDATED_CASTING_SFX)} dark, visceral casting & fishing horror sound effects...")
    for name, (gen_fn, af) in UPDATED_CASTING_SFX.items():
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
        print(f"Updated dark fishing SFX: {name}.mp3")
    print("All casting and fishing sounds updated to dark, immersive horror!")
