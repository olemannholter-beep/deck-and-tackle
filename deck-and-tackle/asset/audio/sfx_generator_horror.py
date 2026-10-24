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

# ==============================================================
# REFINED HORROR NAUTICAL SOUND GENERATORS
# ==============================================================

# 1. BELL BUOY (Haunted, spectral tolling in the mist with eerie tritone resonance)
def gen_bell_buoy_horror():
    duration = 3.8
    N = int(SR * duration)
    left, right = [0.0]*N, [0.0]*N
    # Base C5 (523.25 Hz) + Dissonant tritone mode (740 Hz F#) + mournful low hum
    modes = [
        (523.25, 1.0, 3.5),    # C5 fundamental
        (554.37, 0.45, 2.8),   # C#5 minor second dissonance (eerie beating)
        (739.99, 0.55, 2.4),   # F#5 tritone (diabolus in musica)
        (1046.5, 0.40, 2.0),   # C6
        (1396.9, 0.25, 1.5),   # F6
        (1864.6, 0.20, 1.0),   # Bb6
        (260.0,  0.70, 3.6),   # Deep rusty bell body hum
    ]
    
    # Rusty clapper strike
    strike = [random.uniform(-1.0, 1.0) * math.exp(-i / (SR * 0.012)) for i in range(int(SR * 0.06))]
    lp_strike = Biquad('lp', 2800, 1.8)
    
    for i in range(N):
        t = i / SR
        val = 0.0
        # Haunting wave vibrato and pitch drift
        vibrato = 1.0 + 0.005 * math.sin(2.0 * math.pi * 0.25 * t)
        
        for freq, amp, decay in modes:
            env = math.exp(-t / (decay * 0.7))
            val += amp * env * math.sin(2.0 * math.pi * freq * vibrato * t)
            
        if i < len(strike):
            val += lp_strike.process(strike[i]) * 0.9
            
        # Subtle eerie underwater groan layered underneath
        val += 0.25 * math.sin(2.0 * math.pi * 75.0 * t) * math.exp(-t / 2.5)
        
        left[i] = val
        right[i] = val * (0.90 + 0.10 * math.sin(2.0 * math.pi * 0.3 * t))
        
    return left, right

# 2. WATER LAP (Viscous, dark subterranean coastal swell with eerie sucking gurgle)
def gen_water_lap_horror():
    duration = 2.8
    N = int(SR * duration)
    left, right = [0.0]*N, [0.0]*N
    pink = PinkNoise()
    bp = Biquad('bp', 350, 2.5)
    lp = Biquad('lp', 800, 1.0)
    
    for i in range(N):
        t = i / SR
        # Heavy slow swell
        env = math.sin(math.pi * (t / duration)) ** 2.2
        # Dynamic filter sweeping lower (darker, heavier water)
        center_f = 180.0 + 420.0 * (math.sin(math.pi * t / duration) ** 2.0)
        bp.set_coeffs('bp', center_f, 2.2)
        
        n = pink.next()
        val = bp.process(n) * env * 2.6 + lp.process(n) * env * 0.7
        
        # Sub-bass water displacement (40 Hz hollow ocean surge)
        val += 0.35 * math.sin(2.0 * math.pi * 42.0 * t) * env
        
        left[i] = val
        right[i] = val * 0.94
        
    # Murky bubbles & barnacle wet clicks
    random.seed(666)
    for _ in range(12):
        drop_t = random.uniform(0.4, 2.2)
        start_idx = int(drop_t * SR)
        b_len = int(SR * random.uniform(0.06, 0.14))
        f_start = random.uniform(320, 680)
        f_end = f_start * random.uniform(1.3, 1.8)
        for j in range(b_len):
            idx = start_idx + j
            if idx >= N: break
            p = j / b_len
            f = f_start + (f_end - f_start) * (p ** 0.7)
            drop_env = math.sin(math.pi * p) * (1.0 - p)
            drop_val = 0.32 * drop_env * math.sin(2.0 * math.pi * f * (j / SR))
            left[idx] += drop_val
            right[idx] += drop_val * 0.9
            
    return left, right

# 3. BOAT ENGINE LOOP (Vintage, sputtering, strained diesel chug with sinister metallic shudder)
def gen_boat_engine_horror():
    duration = 3.0
    N = int(SR * duration)
    left, right = [0.0]*N, [0.0]*N
    pulse_rate = 5.2  # Slower, laboring 312 RPM chug
    period_samples = int(SR / pulse_rate)
    num_pulses = int(duration * pulse_rate)
    pink = PinkNoise()
    
    for p in range(num_pulses):
        p_start = p * period_samples
        for j in range(period_samples):
            idx = p_start + j
            if idx >= N: break
            t_pulse = j / SR
            
            # Deep hollow combustion thump (44 Hz sine with saturation)
            thump_env = math.exp(-t_pulse / 0.06)
            thump = math.sin(2.0 * math.pi * 44.0 * t_pulse) * thump_env * 1.3
            
            # Strained metallic valve shudder (clank at 380 Hz)
            clank_env = math.exp(-t_pulse / 0.02)
            clank = math.sin(2.0 * math.pi * 380.0 * t_pulse) * clank_env * 0.6
            
            # Gurgling wet exhaust sputter
            gurgle_env = math.sin(math.pi * min(1.0, t_pulse / 0.08)) * math.exp(-t_pulse / 0.10)
            gurgle = pink.next() * gurgle_env * 0.8
            
            val = soft_clip(thump + clank + gurgle)
            left[idx] += val
            right[idx] += val * 0.96
            
    # Loop boundary smoothing
    fade = int(SR * 0.05)
    for i in range(fade):
        w = i / fade
        left[i] *= w
        right[i] *= w
        left[N - 1 - i] *= w
        right[N - 1 - i] *= w
        
    return left, right

# 4. DOCK BUMP (Ominous heavy impact into rotting timber, long agonizing wood groaning creak)
def gen_dock_bump_horror():
    duration = 2.2
    N = int(SR * duration)
    left, right = [0.0]*N, [0.0]*N
    pink = PinkNoise()
    
    for i in range(N):
        t = i / SR
        # Deep crushing impact (38 Hz pitch drop to 26 Hz)
        f = 38.0 - 12.0 * min(1.0, t / 0.4)
        thump_env = math.exp(-t / 0.35)
        thump = math.sin(2.0 * math.pi * f * t) * thump_env * 1.5
        
        # Agonizing wooden friction creak (FM modulated friction noise)
        creak_env = math.sin(math.pi * min(1.0, t / 0.7)) * math.exp(-t / 0.9)
        friction_mod = 1.0 + 0.9 * math.sin(2.0 * math.pi * 32.0 * t + math.sin(2.0 * math.pi * 6.0 * t))
        creak_tone = (math.sin(2.0 * math.pi * 280.0 * t) * 0.4 + math.sin(2.0 * math.pi * 440.0 * t) * 0.3)
        creak = (pink.next() * 0.6 + creak_tone) * creak_env * friction_mod * 0.85
        
        # Wet sludge displacement
        slosh = pink.next() * math.exp(-t / 0.5) * 0.4
        
        val = soft_clip(thump + creak + slosh)
        left[i] = val
        right[i] = val * 0.91
        
    return left, right

# 5. CAST WHOOSH (Sinister rod whip cutting cold air, line screeching through rusted guides)
def gen_cast_whoosh_horror():
    duration = 1.1
    N = int(SR * duration)
    left, right = [0.0]*N, [0.0]*N
    pink = PinkNoise()
    bp = Biquad('bp', 500, 3.0)
    
    for i in range(N):
        t = i / SR
        # Sharp predatory whip slicing air
        if t < 0.24:
            env = math.sin(math.pi * 0.5 * (t / 0.24)) ** 1.8
            center_f = 280.0 + 2600.0 * ((t / 0.24) ** 2.2)
        elif t < 0.65:
            rel = (t - 0.24) / 0.41
            env = math.cos(math.pi * 0.5 * rel) ** 1.4
            center_f = 2880.0 - 2200.0 * rel
        else:
            env = 0.0
            center_f = 350.0
            
        bp.set_coeffs('bp', center_f, 2.5)
        val = bp.process(pink.next()) * env * 2.4
        
        # High singing filament whistle (2800 Hz + 3150 Hz eerie dissonant split)
        if 0.16 < t < 0.85:
            wt = t - 0.16
            w_env = math.sin(math.pi * (wt / 0.69)) * 0.4
            whistle = (math.sin(2.0 * math.pi * 2800.0 * t) + 0.6 * math.sin(2.0 * math.pi * 3150.0 * t))
            val += whistle * w_env
            
        left[i] = val
        right[i] = val * 0.94
        
    return left, right

# 6. BOBBER SPLASH (Heavy, ominous plunge into deep black water, hollow cavernous gulp)
def gen_bobber_splash_horror():
    duration = 1.6
    N = int(SR * duration)
    left, right = [0.0]*N, [0.0]*N
    pink = PinkNoise()
    
    for i in range(N):
        t = i / SR
        # Initial cold impact slap
        slap_env = math.exp(-t / 0.025)
        slap = pink.next() * slap_env * 1.6
        
        # Sub-bass hollow plunge thump (54 Hz -> 32 Hz)
        thump_env = math.exp(-t / 0.24)
        f_thump = 54.0 - 22.0 * min(1.0, t / 0.2)
        thump = math.sin(2.0 * math.pi * f_thump * t) * thump_env * 1.4
        
        # Deep resonant sucking vortex (cavernous gulp)
        gulp_env = math.sin(math.pi * min(1.0, t / 0.35)) * math.exp(-t / 0.5)
        gulp = math.sin(2.0 * math.pi * 140.0 * t) * gulp_env * 0.7
        
        val = soft_clip(slap + thump + gulp)
        left[i] = val
        right[i] = val
        
    # Murky submerged rising bubbles
    random.seed(999)
    for _ in range(7):
        start_t = random.uniform(0.06, 0.45)
        start_idx = int(start_t * SR)
        b_len = int(SR * random.uniform(0.07, 0.16))
        f1 = random.uniform(420, 720)
        f2 = f1 * random.uniform(1.4, 2.1)
        for j in range(b_len):
            idx = start_idx + j
            if idx >= N: break
            p = j / b_len
            f = f1 + (f2 - f1) * (p ** 0.5)
            b_env = math.sin(math.pi * p) * (1.0 - p * 0.4) * 0.4
            b_val = b_env * math.sin(2.0 * math.pi * f * (j / SR))
            left[idx] += b_val
            right[idx] += b_val * 0.88
            
    return left, right

# 7. NIBBLE TWITCH (Unsettling biological tug, eerie line scrape, and murky cavitation pop)
def gen_nibble_twitch_horror():
    duration = 0.7
    N = int(SR * duration)
    left, right = [0.0]*N, [0.0]*N
    
    for i in range(N):
        t = i / SR
        # Dissonant dual-wire tension scrape (666 Hz + 714 Hz tritone beating)
        scrape_env = math.exp(-t / 0.12)
        scrape = (math.sin(2.0 * math.pi * 666.0 * t) * 0.6 + math.sin(2.0 * math.pi * 714.0 * t) * 0.5) * scrape_env
        
        # Submerged biological pop at 0.05s
        if 0.04 <= t <= 0.18:
            bt = (t - 0.04) / 0.14
            f = 380.0 + 820.0 * (bt ** 0.7)
            b_env = math.sin(math.pi * bt) * 0.65
            pop = math.sin(2.0 * math.pi * f * t) * b_env
        else:
            pop = 0.0
            
        val = soft_clip(scrape + pop)
        left[i] = val
        right[i] = val * 0.94
        
    return left, right

# 8. BITE SPLASH (Terrifying explosive water eruption, monster jaw snap & violent hook set)
def gen_bite_splash_horror():
    duration = 2.4
    N = int(SR * duration)
    left, right = [0.0]*N, [0.0]*N
    pink = PinkNoise()
    lp = Biquad('lp', 850, 1.4)
    
    for i in range(N):
        t = i / SR
        # Sudden deafening surface explosion
        blast_env = math.exp(-t / 0.35)
        blast = lp.process(pink.next() * 3.2) * blast_env
        
        # Crushing jaw snap transient & sub-bass shockwave (36 Hz deep rumble)
        sub_env = math.exp(-t / 0.22)
        sub = math.sin(2.0 * math.pi * 36.0 * t) * sub_env * 1.8
        
        # High predatory screech / violent spray
        screech_env = math.sin(math.pi * min(1.0, t / 0.4)) * math.exp(-t / 0.5)
        screech = math.sin(2.0 * math.pi * 1850.0 * t + 3.0 * math.sin(2.0 * math.pi * 45.0 * t)) * screech_env * 0.5
        
        # Second water thrash impact at 0.28s
        if t > 0.25:
            t2 = t - 0.25
            thrash2_env = math.exp(-t2 / 0.3)
            thrash2 = pink.next() * thrash2_env * 0.8
        else:
            thrash2 = 0.0
            
        val = soft_clip(blast + sub + screech + thrash2)
        left[i] = val
        right[i] = val * 0.92
        
    return left, right

# 9. CARD DRAW (Dry ancient grimoire parchment, brittle vellum slide, subtle ghostly sigh)
def gen_card_draw_horror():
    duration = 0.6
    N = int(SR * duration)
    left, right = [0.0]*N, [0.0]*N
    pink = PinkNoise()
    bp = Biquad('bp', 750, 2.2)
    
    for i in range(N):
        t = i / SR
        # Dry textured vellum slide
        slide_env = (math.sin(math.pi * min(1.0, t / 0.42)) ** 1.6)
        center_f = 1100.0 - 550.0 * (t / 0.42)
        bp.set_coeffs('bp', center_f, 2.0)
        slide = bp.process(pink.next()) * slide_env * 1.8
        
        # Eerie breathy whispering high-frequency undertone (ghostly sigh)
        sigh = pink.next() * math.sin(math.pi * (t / duration)) * 0.25
        
        # Brittle card edge flick at 0.32s
        if 0.30 <= t <= 0.40:
            st = t - 0.30
            flick_env = math.exp(-st / 0.012)
            flick = math.sin(2.0 * math.pi * 2100.0 * st) * flick_env * 0.7
        else:
            flick = 0.0
            
        val = soft_clip(slide + sigh + flick)
        left[i] = val
        right[i] = val * 0.95
        
    return left, right

# 10. CARD PLAY (Heavy occult sacrifice table slam, sudden infrasound dread & C-minor tritone hum)
def gen_card_play_horror():
    duration = 0.95
    N = int(SR * duration)
    left, right = [0.0]*N, [0.0]*N
    
    for i in range(N):
        t = i / SR
        # Brutal heavy table impact thud (48 Hz sub drop)
        thud_env = math.exp(-t / 0.14)
        thud = math.sin(2.0 * math.pi * 48.0 * t) * thud_env * 1.4
        
        # Dark occult invocation chord (C3 130.8Hz + F#3 185.0Hz tritone + Eb3 155.6Hz minor third)
        drone_env = math.sin(math.pi * min(1.0, t / 0.75)) * math.exp(-t / 0.7)
        drone = (math.sin(2.0 * math.pi * 130.81 * t) * 0.5 + 
                 math.sin(2.0 * math.pi * 185.00 * t) * 0.45 +  # Tritone of doom
                 math.sin(2.0 * math.pi * 155.56 * t) * 0.35) * drone_env * 0.8
                 
        val = soft_clip(thud + drone)
        left[i] = val
        right[i] = val * 0.93
        
    return left, right

# 11. REEL RATCHET (Heavy strained iron and brass gears groaning under eldritch weight)
def gen_reel_ratchet_horror():
    duration = 1.3
    N = int(SR * duration)
    left, right = [0.0]*N, [0.0]*N
    num_clicks = 26
    
    # Accelerated then laboring gear teeth
    for c in range(num_clicks):
        t_click = 0.04 + 1.2 * ((c / num_clicks) ** 1.2)
        c_idx = int(t_click * SR)
        for j in range(int(SR * 0.035)):
            idx = c_idx + j
            if idx >= N: break
            t_rel = j / SR
            
            # Sharp harsh tooth strike
            click_env = math.exp(-t_rel / 0.004)
            click = math.sin(2.0 * math.pi * 3200.0 * t_rel) * click_env * 1.1
            
            # Strained resonant iron gear housing ring (groaning 740 Hz tritone)
            ring_env = math.exp(-t_rel / 0.02)
            ring = math.sin(2.0 * math.pi * 740.0 * t_rel) * ring_env * 0.6
            
            val = click + ring
            left[idx] += val
            right[idx] += val * 0.94
            
    # Add underlying groaning line stress under the reel
    for i in range(N):
        t = i / SR
        groan = math.sin(2.0 * math.pi * 92.0 * t) * math.sin(math.pi * (t / duration)) * 0.35
        left[i] += groan
        right[i] += groan
        
    return left, right

# 12. DRAG RELEASE (Frantic clutch screech, line screaming off spool under terrifying pull)
def gen_drag_release_horror():
    duration = 1.6
    N = int(SR * duration)
    left, right = [0.0]*N, [0.0]*N
    pink = PinkNoise()
    bp = Biquad('bp', 2200, 3.0)
    
    for i in range(N):
        t = i / SR
        env = math.sin(math.pi * (t / duration)) ** 1.3
        # Intense high-speed friction flutter (58 Hz tremolo)
        flutter = 1.0 + 0.7 * math.sin(2.0 * math.pi * 58.0 * t)
        hiss = bp.process(pink.next()) * env * flutter * 1.8
        
        # Desperate high screeching metal whine (2600 Hz + 2850 Hz dissonant beating)
        whine = (math.sin(2.0 * math.pi * 2600.0 * t) + 0.6 * math.sin(2.0 * math.pi * 2850.0 * t)) * env * 0.3
        
        # Sub-rumble of boat shuddering from the pull
        rumble = math.sin(2.0 * math.pi * 48.0 * t) * env * 0.4
        
        val = soft_clip(hiss + whine + rumble)
        left[i] = val
        right[i] = val * 0.95
        
    return left, right

# 13. TENSION STRIKE (Violent whip crack, heavy sub-bass flesh/hull strike & razor twang)
def gen_tension_strike_horror():
    duration = 1.1
    N = int(SR * duration)
    left, right = [0.0]*N, [0.0]*N
    pink = PinkNoise()
    
    for i in range(N):
        t = i / SR
        # Violent line snap whip transient
        whip_env = math.exp(-t / 0.015)
        whip = pink.next() * whip_env * 2.2
        
        # Brutal bone/timber impact thud (52 Hz sub boom)
        thud_env = math.exp(-t / 0.25)
        thud = math.sin(2.0 * math.pi * 52.0 * t) * thud_env * 1.6
        
        # Singing razor wire twang (440 Hz decaying fast)
        twang_env = math.exp(-t / 0.14)
        twang = math.sin(2.0 * math.pi * 440.0 * t) * twang_env * 0.9
        
        val = soft_clip(whip + thud + twang)
        left[i] = val
        right[i] = val * 0.91
        
    return left, right

# 14. FISH THRASH (Eldritch abomination violent tail wallops, slimy churning foam & guttural surge)
def gen_fish_thrash_horror():
    duration = 2.2
    N = int(SR * duration)
    left, right = [0.0]*N, [0.0]*N
    pink = PinkNoise()
    lp = Biquad('lp', 700, 1.6)
    
    # 3 brutal successive strikes
    strikes = [0.08, 0.58, 1.18]
    for s_i, s_t in enumerate(strikes):
        s_idx = int(s_t * SR)
        pan = 0.35 if s_i % 2 == 0 else 0.65
        for j in range(int(SR * 0.5)):
            idx = s_idx + j
            if idx >= N: break
            t_rel = j / SR
            
            # Heavy wet tail slam
            slam_env = math.exp(-t_rel / 0.16)
            slam = math.sin(2.0 * math.pi * 38.0 * t_rel) * slam_env * 1.5
            
            # Viscous frothing water churn
            churn = lp.process(pink.next()) * slam_env * 1.8
            
            # Guttural monster aquatic shudder (low frequency FM growl)
            growl = math.sin(2.0 * math.pi * 65.0 * t_rel + 2.0 * math.sin(2.0 * math.pi * 18.0 * t_rel)) * slam_env * 0.7
            
            val = soft_clip(slam + churn + growl)
            left[idx] += val * pan
            right[idx] += val * (1.0 - pan)
            
    return left, right

# 15. FISH DEEP DIVE (Abyssal pressure drop, Cyclopean void plunge down to 22 Hz, unearthly hum)
def gen_fish_deep_dive_horror():
    duration = 2.8
    N = int(SR * duration)
    left, right = [0.0]*N, [0.0]*N
    pink = PinkNoise()
    lp = Biquad('lp', 300, 2.2)
    
    for i in range(N):
        t = i / SR
        # Infrasonic pressure plunge (78 Hz sweeping all the way down to 22 Hz)
        f = 78.0 - 56.0 * ((t / duration) ** 0.75)
        env = math.sin(math.pi * (t / duration)) ** 1.4
        sub = math.sin(2.0 * math.pi * f * t) * env * 1.6
        
        # Deep oceanic void vortex
        vortex = lp.process(pink.next()) * env * 0.8
        
        # Eerie unearthly low harmonic drone (110 Hz decaying)
        drone = math.sin(2.0 * math.pi * 110.0 * t) * env * 0.35
        
        val = soft_clip(sub + vortex + drone)
        left[i] = val
        right[i] = val * 0.95
        
    return left, right

# 16. LINE WARNING (Psychological wire torture: screaming microtonal dissonance C6 + C#6 + rapid flutter)
def gen_line_warning_horror():
    duration = 1.4
    N = int(SR * duration)
    left, right = [0.0]*N, [0.0]*N
    
    for i in range(N):
        t = i / SR
        env = math.sin(math.pi * (t / duration)) ** 1.6
        # Panic-inducing 22 Hz distress flutter
        flutter = 1.0 + 0.6 * math.sin(2.0 * math.pi * 22.0 * t)
        
        # Eerie clash: C6 (1046.5 Hz) and C#6 (1108.7 Hz) - razor sharp minor second beating
        t1 = math.sin(2.0 * math.pi * 1046.50 * t) * 0.6
        t2 = math.sin(2.0 * math.pi * 1108.73 * t) * 0.55
        # Ghost harmonic at 2155 Hz
        t3 = math.sin(2.0 * math.pi * 2155.0 * t) * 0.25
        
        val = (t1 + t2 + t3) * env * flutter * 0.85
        left[i] = val
        right[i] = val * 0.92
        
    return left, right

# 17. LINE SNAP (Violent deafening gunshot crack echoing over empty water, dead hollow silence)
def gen_line_snap_horror():
    duration = 1.5
    N = int(SR * duration)
    left, right = [0.0]*N, [0.0]*N
    pink = PinkNoise()
    
    for i in range(N):
        t = i / SR
        # Deafening gunshot whip crack
        whip_env = math.exp(-t / 0.006)
        whip = pink.next() * whip_env * 2.8
        
        # Catastrophic monofilament snap twang (1600 Hz dying instantly in 0.05s)
        twang_env = math.exp(-t / 0.045)
        twang = math.sin(2.0 * math.pi * 1600.0 * t) * twang_env * 1.5
        
        # Dead hollow underwater rebound thump
        if t > 0.06:
            thump_t = t - 0.06
            thump_env = math.exp(-thump_t / 0.22)
            thump = math.sin(2.0 * math.pi * 48.0 * thump_t) * thump_env * 0.9
        else:
            thump = 0.0
            
        val = soft_clip(whip + twang + thump)
        left[i] = val
        right[i] = val
        
    return left, right

# 18. CATCH VICTORY (Somber, chilling C-minor funeral chime & heavy wet abomination flop in keepnet)
def gen_catch_victory_horror():
    duration = 3.5
    N = int(SR * duration)
    left, right = [0.0]*N, [0.0]*N
    
    # Somber, haunting C-minor funeral bells (C4, Eb4, G4, C5)
    bells = [
        (261.63, 0.0, 1.0, 3.2),   # Deep C4
        (311.13, 0.18, 0.85, 3.0), # Eb4 minor third
        (392.00, 0.36, 0.75, 2.7), # G4 fifth
        (523.25, 0.54, 0.9, 2.8),  # C5 octave
    ]
    
    for freq, delay, amp, decay in bells:
        d_idx = int(delay * SR)
        for j in range(int(SR * decay)):
            idx = d_idx + j
            if idx >= N: break
            t_rel = j / SR
            env = math.exp(-t_rel / (decay * 0.6))
            val = math.sin(2.0 * math.pi * freq * t_rel) * env * amp * 0.4
            left[idx] += val
            right[idx] += val * 0.95
            
    # Heavy, squelching wet abomination landed into the wicker creel at 0.6s
    pink = PinkNoise()
    lp = Biquad('lp', 650, 1.4)
    k_idx = int(0.6 * SR)
    for j in range(int(SR * 0.4)):
        idx = k_idx + j
        if idx >= N: break
        t_rel = j / SR
        env = math.exp(-t_rel / 0.15)
        thump = math.sin(2.0 * math.pi * 72.0 * t_rel) * env * 0.85
        slurp = lp.process(pink.next()) * env * 0.75
        val = thump + slurp
        left[idx] += val
        right[idx] += val * 0.92
        
    return left, right

# 19. GOLD COINS (Ancient cursed Innsmouth gold & silver bullion clunking on damp oak)
def gen_gold_coins_horror():
    duration = 1.6
    N = int(SR * duration)
    left, right = [0.0]*N, [0.0]*N
    
    # Dense, heavy, slightly dissonant ancient coin alloys
    coin_freqs = [2400.0, 3100.0, 3850.0, 4400.0, 2900.0]
    delays = [0.06, 0.24, 0.42, 0.62, 0.78]
    
    for c_i, (freq, delay) in enumerate(zip(coin_freqs, delays)):
        d_idx = int(delay * SR)
        pan = 0.35 + 0.3 * (c_i / 4.0)
        for j in range(int(SR * 0.45)):
            idx = d_idx + j
            if idx >= N: break
            t_rel = j / SR
            env = math.exp(-t_rel / 0.22)
            # Heavy metal clunk + dissonant partial
            clunk = math.sin(2.0 * math.pi * 180.0 * t_rel) * math.exp(-t_rel / 0.04) * 0.4
            ping = (math.sin(2.0 * math.pi * freq * t_rel) * 0.7 +
                    math.sin(2.0 * math.pi * (freq * 1.414) * t_rel) * 0.35) * env * 0.45
            val = clunk + ping
            left[idx] += val * pan
            right[idx] += val * (1.0 - pan)
            
    return left, right

# 20. BUTTON CLICK (Rusted iron nautical telegraph latch snap with hollow acoustic cavity thud)
def gen_button_click_horror():
    duration = 0.35
    N = int(SR * duration)
    left, right = [0.0]*N, [0.0]*N
    pink = PinkNoise()
    
    for i in range(N):
        t = i / SR
        # Sharp iron snap
        snap_env = math.exp(-t / 0.007)
        snap = pink.next() * snap_env * 1.8
        
        # Hollow iron casing thunk (290 Hz)
        body_env = math.exp(-t / 0.04)
        body = math.sin(2.0 * math.pi * 290.0 * t) * body_env * 0.9
        
        val = soft_clip(snap + body)
        left[i] = val
        right[i] = val * 0.98
        
    return left, right

REFINED_HORROR_EFFECTS = {
    "sfx_boat_engine_loop": gen_boat_engine_horror,
    "sfx_water_lap": gen_water_lap_horror,
    "sfx_bell_buoy": gen_bell_buoy_horror,
    "sfx_dock_bump": gen_dock_bump_horror,
    "sfx_cast_whoosh": gen_cast_whoosh_horror,
    "sfx_bobber_splash": gen_bobber_splash_horror,
    "sfx_nibble_twitch": gen_nibble_twitch_horror,
    "sfx_bite_splash": gen_bite_splash_horror,
    "sfx_card_draw": gen_card_draw_horror,
    "sfx_card_play": gen_card_play_horror,
    "sfx_reel_ratchet": gen_reel_ratchet_horror,
    "sfx_drag_release": gen_drag_release_horror,
    "sfx_tension_strike": gen_tension_strike_horror,
    "sfx_fish_thrash": gen_fish_thrash_horror,
    "sfx_fish_deep_dive": gen_fish_deep_dive_horror,
    "sfx_line_warning": gen_line_warning_horror,
    "sfx_line_snap": gen_line_snap_horror,
    "sfx_catch_victory": gen_catch_victory_horror,
    "sfx_gold_coins": gen_gold_coins_horror,
    "sfx_button_click": gen_button_click_horror,
    # NOTE: sfx_foghorn is KEPT UNTOUCHED per user instructions!
}

if __name__ == "__main__":
    print(f"Refining {len(REFINED_HORROR_EFFECTS)} sound effects with Lovecraftian horror aesthetics...")
    for name, gen_fn in REFINED_HORROR_EFFECTS.items():
        wav_path = os.path.join(OUTPUT_DIR, f"{name}.wav")
        mp3_path = os.path.join(OUTPUT_DIR, f"{name}.mp3")
        left, right = gen_fn()
        save_wav(wav_path, left, right)
        
        # Dark spatial mastering tailored for horror depth
        if any(k in name for k in ['bell', 'victory', 'gold']):
            af = 'aecho=0.8:0.75:90|180:0.3|0.2,lowpass=f=11000,loudnorm=I=-16:TP=-1.5:LRA=10'
        elif any(k in name for k in ['splash', 'thrash', 'deep_dive', 'water', 'bump', 'bite']):
            af = 'aecho=0.8:0.65:50|100:0.22|0.12,lowpass=f=10000,loudnorm=I=-16:TP=-1.5:LRA=10'
        else:
            af = 'lowpass=f=13000,loudnorm=I=-16:TP=-1.5:LRA=10'
            
        cmd = ['ffmpeg', '-y', '-i', wav_path, '-af', af, '-b:a', '192k', mp3_path]
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if os.path.exists(wav_path):
            os.remove(wav_path)
        print(f"Refined horror SFX: {name}.mp3")
    print("All horror sound effects refined! (sfx_foghorn.mp3 preserved intact)")
