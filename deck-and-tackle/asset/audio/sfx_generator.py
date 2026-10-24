import math
import struct
import random
import wave
import os
import subprocess

SR = 48000
OUTPUT_DIR = "deck-and-tackle/asset/audio/sfx"
os.makedirs(OUTPUT_DIR, exist_ok=True)

def clamp(val, low=-1.0, high=1.0):
    return max(low, min(high, val))

def soft_clip(x):
    if x > 1.0:
        return 1.0 - math.exp(-(x - 1.0)) * 0.5
    elif x < -1.0:
        return -1.0 + math.exp(x + 1.0) * 0.5
    return x - (x ** 3) / 6.0

def save_wav(filepath, left, right=None):
    if right is None:
        right = list(left)
    assert len(left) == len(right)
    max_peak = max(max(abs(s) for s in left), max(abs(s) for s in right))
    gain = 0.90 / max_peak if max_peak > 0 else 1.0
    
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
        elif filter_type == 'hp':
            b0 = (1.0 + cos_w0) / 2.0
            b1 = -(1.0 + cos_w0)
            b2 = (1.0 + cos_w0) / 2.0
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

# ==========================================
# SOUND DESIGN GENERATORS
# ==========================================

def gen_foghorn():
    duration = 3.6
    N = int(SR * duration)
    left, right = [0.0]*N, [0.0]*N
    f0 = 65.41  # C2
    f1 = 98.00  # G2
    
    for i in range(N):
        t = i / SR
        # Envelope: 0.35s swell attack, 2.0s sustain, 1.25s decay
        if t < 0.35:
            env = 0.5 * (1.0 - math.cos(math.pi * t / 0.35))
        elif t < 2.35:
            env = 1.0 + 0.05 * math.sin(2.0 * math.pi * 3.5 * t)
        else:
            rel_t = (t - 2.35) / 1.25
            env = (1.0 - rel_t) ** 2.0
            
        # Rich brass partials
        val = 0.0
        for harm in range(1, 12):
            amp = (1.0 / (harm ** 1.15))
            val += amp * math.sin(2.0 * math.pi * (f0 * harm) * t) * 0.6
            val += amp * 0.5 * math.sin(2.0 * math.pi * (f1 * harm) * t) * 0.4
            
        # Subtle sub rumble
        val += 0.4 * math.sin(2.0 * math.pi * 32.7 * t)
        val = soft_clip(val * 0.8) * env
        
        # Spatial width
        left[i] = val
        right[i] = val * (0.95 + 0.05 * math.cos(2.0 * math.pi * 0.5 * t))
        
    return left, right

def gen_bell_buoy():
    duration = 3.5
    N = int(SR * duration)
    left, right = [0.0]*N, [0.0]*N
    # C5 bell with maritime modal ratios
    f0 = 523.25
    modes = [
        (1.0, 1.0, 3.2),
        (1.503, 0.7, 2.6),
        (1.98, 0.5, 2.0),
        (2.65, 0.4, 1.4),
        (3.42, 0.3, 0.9),
        (4.81, 0.2, 0.5),
        (5.95, 0.15, 0.3)
    ]
    
    # Sharp clapper strike transient
    strike = [random.uniform(-1.0, 1.0) * math.exp(-i / (SR * 0.008)) for i in range(int(SR * 0.05))]
    lp_strike = Biquad('lp', 3500, 1.5)
    
    for i in range(N):
        t = i / SR
        # Modal bell partials
        val = 0.0
        # Gentle swell vibrato
        vibrato = 1.0 + 0.003 * math.sin(2.0 * math.pi * 0.35 * t)
        for ratio, amp, decay in modes:
            freq = f0 * ratio * vibrato
            env = math.exp(-t / (decay * 0.75))
            val += amp * env * math.sin(2.0 * math.pi * freq * t)
            
        # Add clapper strike
        if i < len(strike):
            val += lp_strike.process(strike[i]) * 0.8
            
        left[i] = val
        right[i] = val * (0.92 + 0.08 * math.sin(2.0 * math.pi * 0.4 * t))
        
    return left, right

def gen_water_lap():
    duration = 2.5
    N = int(SR * duration)
    left, right = [0.0]*N, [0.0]*N
    pink = PinkNoise()
    bp1 = Biquad('bp', 450, 2.2)
    lp1 = Biquad('lp', 1200, 0.8)
    
    # Generate swell
    for i in range(N):
        t = i / SR
        # Swell envelope peaking around 0.9s
        env = math.sin(math.pi * (t / duration)) ** 1.8
        center_f = 250.0 + 550.0 * (math.sin(math.pi * t / duration) ** 2.0)
        bp1.set_coeffs('bp', center_f, 2.0)
        
        noise_sample = pink.next()
        val = bp1.process(noise_sample) * env * 2.2
        val += lp1.process(noise_sample) * env * 0.4
        
        left[i] = val
        right[i] = val * 0.95
        
    # Layer discrete water droplet pings
    random.seed(42)
    for _ in range(9):
        drop_t = random.uniform(0.3, 1.8)
        drop_start = int(drop_t * SR)
        f_start = random.uniform(700, 1400)
        f_end = f_start * random.uniform(1.2, 1.6)
        drop_len = int(SR * random.uniform(0.04, 0.09))
        for j in range(drop_len):
            idx = drop_start + j
            if idx >= N: break
            p = j / drop_len
            f = f_start + (f_end - f_start) * (p ** 0.5)
            env_drop = math.sin(math.pi * p) * (1.0 - p)
            drop_val = 0.25 * env_drop * math.sin(2.0 * math.pi * f * (j / SR))
            pan = random.uniform(0.2, 0.8)
            left[idx] += drop_val * pan
            right[idx] += drop_val * (1.0 - pan)
            
    return left, right

def gen_boat_engine_loop():
    duration = 3.0
    N = int(SR * duration)
    left, right = [0.0]*N, [0.0]*N
    pulse_rate = 6.0  # 6 chugs per second = 360 RPM
    period_samples = int(SR / pulse_rate)
    num_pulses = int(duration * pulse_rate)
    pink = PinkNoise()
    
    for p in range(num_pulses):
        p_start = p * period_samples
        # Single chug pulse
        for j in range(period_samples):
            idx = p_start + j
            if idx >= N: break
            t_pulse = j / SR
            # Sub-bass thump (52 Hz sine decay)
            thump_env = math.exp(-t_pulse / 0.05)
            thump = math.sin(2.0 * math.pi * 52.0 * t_pulse) * thump_env * 0.9
            
            # Exhaust puff noise
            puff_env = math.sin(math.pi * min(1.0, t_pulse / 0.07)) * math.exp(-t_pulse / 0.08)
            puff = pink.next() * puff_env * 0.7
            
            # Mechanical tick
            tick_env = math.exp(-t_pulse / 0.01)
            tick = math.sin(2.0 * math.pi * 1800.0 * t_pulse) * tick_env * 0.3
            
            val = thump + puff + tick
            left[idx] += val
            right[idx] += val * 0.98
            
    # Smoothing loop ends
    fade = int(SR * 0.05)
    for i in range(fade):
        w = i / fade
        left[i] *= w
        right[i] *= w
        left[N - 1 - i] *= w
        right[N - 1 - i] *= w
        
    return left, right

def gen_dock_bump():
    duration = 1.8
    N = int(SR * duration)
    left, right = [0.0]*N, [0.0]*N
    pink = PinkNoise()
    
    # 1. Low hull impact thump (42Hz -> 30Hz drop)
    for i in range(N):
        t = i / SR
        thump_env = math.exp(-t / 0.28)
        f = 46.0 - 14.0 * min(1.0, t / 0.3)
        thump = math.sin(2.0 * math.pi * f * t) * thump_env * 1.2
        
        # 2. Wooden creak friction
        creak_env = math.sin(math.pi * min(1.0, t / 0.45)) * math.exp(-t / 0.6)
        creak_mod = 1.0 + 0.8 * math.sin(2.0 * math.pi * 48.0 * t)
        creak = pink.next() * creak_env * creak_mod * 0.6
        
        val = soft_clip(thump + creak)
        left[i] = val
        right[i] = val * 0.92
        
    return left, right

def gen_cast_whoosh():
    duration = 1.0
    N = int(SR * duration)
    left, right = [0.0]*N, [0.0]*N
    pink = PinkNoise()
    bp = Biquad('bp', 400, 2.5)
    
    for i in range(N):
        t = i / SR
        # Whoosh envelope peaking at 0.22s
        if t < 0.22:
            env = math.sin(math.pi * 0.5 * (t / 0.22))
            center_f = 350.0 + 1900.0 * (t / 0.22) ** 2.0
        elif t < 0.55:
            rel = (t - 0.22) / 0.33
            env = math.cos(math.pi * 0.5 * rel) ** 1.5
            center_f = 2250.0 - 1600.0 * rel
        else:
            env = 0.0
            center_f = 400.0
            
        bp.set_coeffs('bp', center_f, 2.2)
        val = bp.process(pink.next()) * env * 2.0
        
        # Line whirring after rod whip (0.2s to 0.75s)
        if 0.18 < t < 0.8:
            whir_t = (t - 0.18)
            whir_env = math.sin(math.pi * (whir_t / 0.62)) * 0.35
            whir = math.sin(2.0 * math.pi * 2600.0 * t) * (1.0 + 0.5 * math.sin(2.0 * math.pi * 65.0 * t))
            val += whir * whir_env
            
        left[i] = val
        right[i] = val * 0.95
        
    return left, right

def gen_bobber_splash():
    duration = 1.4
    N = int(SR * duration)
    left, right = [0.0]*N, [0.0]*N
    pink = PinkNoise()
    bp = Biquad('bp', 600, 1.8)
    
    # Sharp initial slap + hollow thump
    for i in range(N):
        t = i / SR
        slap_env = math.exp(-t / 0.02)
        slap = pink.next() * slap_env * 1.5
        
        thump_env = math.exp(-t / 0.18)
        thump = math.sin(2.0 * math.pi * 68.0 * t) * thump_env * 0.9
        
        val = slap + thump
        left[i] = val
        right[i] = val
        
    # Bubble glissandos
    random.seed(99)
    for _ in range(6):
        start_t = random.uniform(0.04, 0.4)
        start_idx = int(start_t * SR)
        b_len = int(SR * random.uniform(0.05, 0.12))
        f1 = random.uniform(550, 850)
        f2 = f1 * random.uniform(1.4, 1.9)
        for j in range(b_len):
            idx = start_idx + j
            if idx >= N: break
            p = j / b_len
            f = f1 + (f2 - f1) * (p ** 0.6)
            env = math.sin(math.pi * p) * (1.0 - p * 0.5) * 0.35
            b_val = env * math.sin(2.0 * math.pi * f * (j / SR))
            left[idx] += b_val
            right[idx] += b_val * 0.88
            
    return left, right

def gen_nibble_twitch():
    duration = 0.6
    N = int(SR * duration)
    left, right = [0.0]*N, [0.0]*N
    # Pluck G5 784 Hz + rising bubble chirp
    for i in range(N):
        t = i / SR
        pluck_env = math.exp(-t / 0.08)
        pluck = math.sin(2.0 * math.pi * 784.0 * t) * pluck_env * 0.8
        
        # Bubble pop at 0.05s
        if 0.03 <= t <= 0.15:
            bt = (t - 0.03) / 0.12
            f = 450.0 + 650.0 * bt
            benv = math.sin(math.pi * bt) * 0.5
            bubble = math.sin(2.0 * math.pi * f * t) * benv
        else:
            bubble = 0.0
            
        val = pluck + bubble
        left[i] = val
        right[i] = val * 0.96
        
    return left, right

def gen_bite_splash():
    duration = 2.2
    N = int(SR * duration)
    left, right = [0.0]*N, [0.0]*N
    pink = PinkNoise()
    lp = Biquad('lp', 900, 1.2)
    
    for i in range(N):
        t = i / SR
        # Violent surface breach explosion
        splash_env = math.exp(-t / 0.45) * (1.0 + 0.3 * math.sin(2.0 * math.pi * 14.0 * t))
        splash = lp.process(pink.next() * 2.2) * splash_env
        
        # Deep hook set sting (sub thump 48Hz + resonant line whip 620Hz)
        sting_env = math.exp(-t / 0.15)
        sting = math.sin(2.0 * math.pi * 48.0 * t) * sting_env * 1.4
        twang = math.sin(2.0 * math.pi * 620.0 * t) * math.exp(-t / 0.06) * 0.7
        
        # Secondary thrash spray at 0.35s
        if 0.25 <= t <= 1.2:
            t2 = t - 0.25
            spray_env = math.sin(math.pi * (t2 / 0.95)) * math.exp(-t2 / 0.5) * 0.6
            spray = pink.next() * spray_env
        else:
            spray = 0.0
            
        val = soft_clip(splash + sting + twang + spray)
        left[i] = val
        right[i] = val * 0.93
        
    return left, right

def gen_card_draw():
    duration = 0.5
    N = int(SR * duration)
    left, right = [0.0]*N, [0.0]*N
    pink = PinkNoise()
    bp = Biquad('bp', 950, 1.8)
    
    for i in range(N):
        t = i / SR
        # Parchment slide envelope
        slide_env = math.sin(math.pi * min(1.0, t / 0.35)) ** 1.5
        center_f = 1200.0 - 500.0 * (t / 0.35)
        bp.set_coeffs('bp', center_f, 1.8)
        slide = bp.process(pink.next()) * slide_env * 1.5
        
        # Crisp card flick / snap at 0.28s
        if 0.26 <= t <= 0.35:
            snap_t = (t - 0.26)
            snap_env = math.exp(-snap_t / 0.015)
            snap = math.sin(2.0 * math.pi * 2400.0 * snap_t) * snap_env * 0.8
        else:
            snap = 0.0
            
        val = slide + snap
        left[i] = val
        right[i] = val * 0.96
        
    return left, right

def gen_card_play():
    duration = 0.8
    N = int(SR * duration)
    left, right = [0.0]*N, [0.0]*N
    pink = PinkNoise()
    
    for i in range(N):
        t = i / SR
        # Solid wooden table impact thud
        thud_env = math.exp(-t / 0.12)
        thud = math.sin(2.0 * math.pi * 115.0 * t) * thud_env * 1.1
        
        # Occult grimoire resonance (C3 130.8 Hz + Eb3 155.6 Hz chord)
        chime_env = math.sin(math.pi * min(1.0, t / 0.7)) * math.exp(-t / 0.6)
        chime = (math.sin(2.0 * math.pi * 130.81 * t) * 0.5 + 
                 math.sin(2.0 * math.pi * 155.56 * t) * 0.35 +
                 math.sin(2.0 * math.pi * 392.00 * t) * 0.2) * chime_env * 0.7
                 
        val = soft_clip(thud + chime)
        left[i] = val
        right[i] = val * 0.94
        
    return left, right

def gen_reel_ratchet():
    duration = 1.2
    N = int(SR * duration)
    left, right = [0.0]*N, [0.0]*N
    num_clicks = 24
    
    # Accelerated sequence of brass ratchet clicks
    for c in range(num_clicks):
        t_click = 0.05 + 1.1 * ((c / num_clicks) ** 1.3)
        c_idx = int(t_click * SR)
        for j in range(int(SR * 0.03)):
            idx = c_idx + j
            if idx >= N: break
            t_rel = j / SR
            # Sharp metallic tooth transient
            click_env = math.exp(-t_rel / 0.003)
            click = math.sin(2.0 * math.pi * 3400.0 * t_rel) * click_env * 0.9
            
            # Brass chassis body resonance
            body_env = math.exp(-t_rel / 0.015)
            body = math.sin(2.0 * math.pi * 880.0 * t_rel) * body_env * 0.5
            
            val = click + body
            left[idx] += val
            right[idx] += val * 0.95
            
    return left, right

def gen_drag_release():
    duration = 1.5
    N = int(SR * duration)
    left, right = [0.0]*N, [0.0]*N
    pink = PinkNoise()
    bp = Biquad('bp', 1700, 2.5)
    
    for i in range(N):
        t = i / SR
        env = math.sin(math.pi * (t / duration)) ** 1.2
        # Rapid flutter
        flutter = 1.0 + 0.6 * math.sin(2.0 * math.pi * 42.0 * t)
        val = bp.process(pink.next()) * env * flutter * 1.4
        
        # Subtle high-frequency spool whine
        whine = math.sin(2.0 * math.pi * 2200.0 * t) * env * 0.15
        
        val = soft_clip(val + whine)
        left[i] = val
        right[i] = val * 0.95
        
    return left, right

def gen_tension_strike():
    duration = 1.0
    N = int(SR * duration)
    left, right = [0.0]*N, [0.0]*N
    pink = PinkNoise()
    
    for i in range(N):
        t = i / SR
        # Powerful strike impact
        thud_env = math.exp(-t / 0.22)
        thud = math.sin(2.0 * math.pi * 56.0 * t) * thud_env * 1.3
        
        # High line twang whip (392 Hz G4)
        twang_env = math.exp(-t / 0.12)
        twang = math.sin(2.0 * math.pi * 392.0 * t) * twang_env * 0.8
        
        # Water slap
        slap_env = math.exp(-t / 0.06)
        slap = pink.next() * slap_env * 0.7
        
        val = soft_clip(thud + twang + slap)
        left[i] = val
        right[i] = val * 0.92
        
    return left, right

def gen_fish_thrash():
    duration = 2.0
    N = int(SR * duration)
    left, right = [0.0]*N, [0.0]*N
    pink = PinkNoise()
    lp = Biquad('lp', 800, 1.5)
    
    # 3 tail wallops
    strikes = [0.1, 0.6, 1.15]
    for s_t in strikes:
        s_idx = int(s_t * SR)
        for j in range(int(SR * 0.45)):
            idx = s_idx + j
            if idx >= N: break
            t_rel = j / SR
            env = math.exp(-t_rel / 0.18)
            thump = math.sin(2.0 * math.pi * 42.0 * t_rel) * env * 1.1
            churn = lp.process(pink.next()) * env * 1.4
            val = thump + churn
            left[idx] += val
            right[idx] += val * 0.91
            
    return left, right

def gen_fish_deep_dive():
    duration = 2.6
    N = int(SR * duration)
    left, right = [0.0]*N, [0.0]*N
    pink = PinkNoise()
    lp = Biquad('lp', 350, 2.0)
    
    for i in range(N):
        t = i / SR
        # Descending sub-bass pressure sweep (85 Hz -> 26 Hz)
        f = 85.0 - 59.0 * (t / duration) ** 0.8
        env = math.sin(math.pi * (t / duration)) ** 1.3
        sub = math.sin(2.0 * math.pi * f * t) * env * 1.2
        
        # Deep swirling undertow noise
        vortex = lp.process(pink.next()) * env * 0.6
        
        val = soft_clip(sub + vortex)
        left[i] = val
        right[i] = val * 0.95
        
    return left, right

def gen_line_warning():
    duration = 1.3
    N = int(SR * duration)
    left, right = [0.0]*N, [0.0]*N
    
    # Singing monofilament tension (C6 1046.5 Hz + D6 1174.6 Hz dissonance)
    for i in range(N):
        t = i / SR
        env = math.sin(math.pi * (t / duration)) ** 1.5
        tremolo = 1.0 + 0.5 * math.sin(2.0 * math.pi * 18.0 * t)
        
        t1 = math.sin(2.0 * math.pi * 1046.50 * t) * 0.6
        t2 = math.sin(2.0 * math.pi * 1174.66 * t) * 0.4
        
        val = (t1 + t2) * env * tremolo * 0.8
        left[i] = val
        right[i] = val * 0.93
        
    return left, right

def gen_line_snap():
    duration = 1.4
    N = int(SR * duration)
    left, right = [0.0]*N, [0.0]*N
    pink = PinkNoise()
    
    for i in range(N):
        t = i / SR
        # Instant full-spectrum whip crack
        whip_env = math.exp(-t / 0.008)
        whip = pink.next() * whip_env * 2.0
        
        # High line twang (1480 Hz decaying very fast)
        twang_env = math.exp(-t / 0.06)
        twang = math.sin(2.0 * math.pi * 1480.0 * t) * twang_env * 1.2
        
        # Dull underwater rebound thump
        if t > 0.08:
            thump_t = t - 0.08
            thump_env = math.exp(-thump_t / 0.25)
            thump = math.sin(2.0 * math.pi * 55.0 * thump_t) * thump_env * 0.7
        else:
            thump = 0.0
            
        val = soft_clip(whip + twang + thump)
        left[i] = val
        right[i] = val
        
    return left, right

def gen_catch_victory():
    duration = 3.2
    N = int(SR * duration)
    left, right = [0.0]*N, [0.0]*N
    # Harmonious bell chord in C Minor (C5, Eb5, G5, C6)
    chord = [
        (523.25, 0.0, 1.0, 2.5),
        (622.25, 0.12, 0.8, 2.3),
        (783.99, 0.24, 0.8, 2.2),
        (1046.50, 0.36, 0.9, 2.6)
    ]
    
    for freq, delay, amp, decay in chord:
        d_idx = int(delay * SR)
        for j in range(int(SR * decay)):
            idx = d_idx + j
            if idx >= N: break
            t_rel = j / SR
            env = math.exp(-t_rel / (decay * 0.5))
            val = math.sin(2.0 * math.pi * freq * t_rel) * env * amp * 0.35
            left[idx] += val
            right[idx] += val * 0.95
            
    # Wet fish landing in wicker keepnet at 0.5s
    pink = PinkNoise()
    lp = Biquad('lp', 700, 1.2)
    k_idx = int(0.5 * SR)
    for j in range(int(SR * 0.35)):
        idx = k_idx + j
        if idx >= N: break
        t_rel = j / SR
        env = math.exp(-t_rel / 0.12)
        thump = math.sin(2.0 * math.pi * 85.0 * t_rel) * env * 0.7
        splash = lp.process(pink.next()) * env * 0.6
        val = thump + splash
        left[idx] += val
        right[idx] += val * 0.9
        
    return left, right

def gen_gold_coins():
    duration = 1.5
    N = int(SR * duration)
    left, right = [0.0]*N, [0.0]*N
    
    # 5 coin drops with resonant metal frequencies
    coin_freqs = [3400.0, 4100.0, 5200.0, 6100.0, 4800.0]
    delays = [0.05, 0.22, 0.40, 0.58, 0.72]
    
    for c_i, (freq, delay) in enumerate(zip(coin_freqs, delays)):
        d_idx = int(delay * SR)
        pan = 0.3 + 0.4 * (c_i / 4.0)
        for j in range(int(SR * 0.4)):
            idx = d_idx + j
            if idx >= N: break
            t_rel = j / SR
            env = math.exp(-t_rel / 0.18)
            # Metallic modal ring
            ping = (math.sin(2.0 * math.pi * freq * t_rel) * 0.7 +
                    math.sin(2.0 * math.pi * (freq * 1.58) * t_rel) * 0.3) * env * 0.45
            left[idx] += ping * pan
            right[idx] += ping * (1.0 - pan)
            
    return left, right

def gen_button_click():
    duration = 0.35
    N = int(SR * duration)
    left, right = [0.0]*N, [0.0]*N
    pink = PinkNoise()
    
    for i in range(N):
        t = i / SR
        click_env = math.exp(-t / 0.005)
        click = pink.next() * click_env * 1.5
        
        # Heavy brass toggle thunk
        body_env = math.exp(-t / 0.035)
        body = math.sin(2.0 * math.pi * 380.0 * t) * body_env * 0.8
        
        val = soft_clip(click + body)
        left[i] = val
        right[i] = val * 0.98
        
    return left, right

ALL_EFFECTS = {
    "sfx_boat_engine_loop": gen_boat_engine_loop,
    "sfx_water_lap": gen_water_lap,
    "sfx_bell_buoy": gen_bell_buoy,
    "sfx_foghorn": gen_foghorn,
    "sfx_dock_bump": gen_dock_bump,
    "sfx_cast_whoosh": gen_cast_whoosh,
    "sfx_bobber_splash": gen_bobber_splash,
    "sfx_nibble_twitch": gen_nibble_twitch,
    "sfx_bite_splash": gen_bite_splash,
    "sfx_card_draw": gen_card_draw,
    "sfx_card_play": gen_card_play,
    "sfx_reel_ratchet": gen_reel_ratchet,
    "sfx_drag_release": gen_drag_release,
    "sfx_tension_strike": gen_tension_strike,
    "sfx_fish_thrash": gen_fish_thrash,
    "sfx_fish_deep_dive": gen_fish_deep_dive,
    "sfx_line_warning": gen_line_warning,
    "sfx_line_snap": gen_line_snap,
    "sfx_catch_victory": gen_catch_victory,
    "sfx_gold_coins": gen_gold_coins,
    "sfx_button_click": gen_button_click,
}

if __name__ == "__main__":
    print(f"Loaded {len(ALL_EFFECTS)} sound effect generators.")
    for name, gen_fn in ALL_EFFECTS.items():
        wav_path = os.path.join(OUTPUT_DIR, f"{name}.wav")
        mp3_path = os.path.join(OUTPUT_DIR, f"{name}.mp3")
        left, right = gen_fn()
        save_wav(wav_path, left, right)
        
        # Audio engineering mastering chain matching Overworld Slow Suite
        if any(k in name for k in ['foghorn', 'bell', 'victory', 'gold']):
            af = 'aecho=0.8:0.7:70|140:0.25|0.15,lowpass=f=12000,loudnorm=I=-16:TP=-1.5:LRA=10'
        elif any(k in name for k in ['splash', 'thrash', 'deep_dive', 'water', 'bump']):
            af = 'aecho=0.8:0.6:40|80:0.18|0.10,lowpass=f=11000,loudnorm=I=-16:TP=-1.5:LRA=10'
        else:
            af = 'lowpass=f=14000,loudnorm=I=-16:TP=-1.5:LRA=10'
            
        cmd = ['ffmpeg', '-y', '-i', wav_path, '-af', af, '-b:a', '192k', mp3_path]
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if os.path.exists(wav_path):
            os.remove(wav_path)
        print(f"Successfully produced: {name}.mp3")

