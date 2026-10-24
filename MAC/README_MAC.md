# ⚓ Deck & Tackle — macOS Edition

Welcome to **Deck & Tackle** on macOS!

---

## 🚀 Quick Start (macOS)

### Option 1: 1-Click Play (Recommended)
1. In Finder, simply **double-click** [`Play_Mac.command`](./Play_Mac.command).
2. It automatically starts a lightweight, zero-dependency local game server using macOS's built-in Python 3 runtime and opens the game directly in your default browser (Safari, Chrome, Arc, etc.).
3. Close the Terminal window or press `Ctrl + C` when you are finished playing.

> **Tip regarding macOS Gatekeeper / Permissions:**
> If macOS says *"Play_Mac.command cannot be opened because it is from an unidentified developer"* or asks for permission:
> - Right-click (or Control-click) `Play_Mac.command` and select **Open**, then click **Open**.
> - Or in Terminal run: `chmod +x Play_Mac.command`

---

### Option 2: Terminal Launch
From Terminal, navigate to this folder and run:
```bash
cd MAC
./Play_Mac.sh
```
Or directly start Python's built-in static server:
```bash
python3 -m http.server 8080
```
Then visit **[http://localhost:8080](http://localhost:8080)** in Safari or Chrome.

---

### Option 3: Static Web Hosting
This `MAC` directory is a fully self-contained static web application. You can drop this folder onto any static host or web server (GitHub Pages, Netlify, Vercel, Cloudflare Pages, Nginx, Apache, or Caddy) and load `index.html`.

---

## 🎮 Controls

| Action | Control |
| :--- | :--- |
| **Move Trawler** | `W`, `A`, `S`, `D` or Arrow Keys |
| **Interact / Fish / Dock** | `Space` or `Enter` |
| **Angling / Battle** | Mouse Click (Play Cards, Techniques, Reel) |
| **Delve Into The Depths** | Click Plaque on Main Menu |

---

## 🌊 Why does macOS use a local server?
Modern macOS browsers (Safari & Chrome) restrict ES module loading, Web Audio synthesis, and relative HTML5 `<video>` streaming when opened directly from disk using `file://`.
Using the native macOS `python3 -m http.server` allows the game engine, animated video diorama backdrops, and immersive audio suites to execute at full 60 FPS performance without requiring any third-party app installations.
