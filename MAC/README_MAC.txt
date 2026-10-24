==============================================================================
                    DECK & TACKLE — macOS Quick Start
==============================================================================

Welcome to Deck & Tackle on macOS!

HOW TO PLAY (3 EASY METHODS)
------------------------------------------------------------------------------

METHOD 1: DOUBLE-CLICK LAUNCHER (RECOMMENDED)
1. In Finder, double-click "Play_Mac.command".
2. macOS Terminal will open, automatically start a zero-dependency local
   server, and launch Deck & Tackle in your default browser (Safari, Chrome, etc.).
3. When you are done playing, simply close the Terminal window or press Ctrl+C.

*Note on macOS Security:*
If macOS displays a notice stating "Play_Mac.command cannot be opened because
it is from an unidentified developer" or "Permission denied":
- Right-click (or Control-click) "Play_Mac.command" and select "Open", then click "Open".
- Or open Terminal, navigate to this folder, and run:
    chmod +x Play_Mac.command
  Then double-click again.


METHOD 2: TERMINAL 1-LINER
If you prefer running from the command line:
1. Open Terminal.
2. Run:
    cd /path/to/MAC
    ./Play_Mac.sh
   (or: python3 -m http.server 8080)
3. Open http://localhost:8080 in Safari, Chrome, Edge, or Brave.


METHOD 3: HOSTING ON ANY WEB SERVER
You can copy this entire "MAC" folder to any web host (e.g. GitHub Pages,
Netlify, Vercel, Apache, Nginx, or any local static server).
Open "index.html" through the HTTP server.


WHY DOES IT USE A LOCAL SERVER?
------------------------------------------------------------------------------
Modern macOS browsers (Safari and Chrome) strictly enforce cross-origin security
policies (CORS) that block ES module scripts, Web Audio buffers, and HTML5 video
streaming when opened directly via "file://" protocol from the hard drive.
Running via the built-in macOS Python local server ensures that all dynamic
audio, background video cinemagraphs, and sprites load smoothly at 60 FPS.


CONTROLS
------------------------------------------------------------------------------
- Overworld: WASD or Arrow Keys to steer your trawler boat.
- Interact / Dock / Fish: Spacebar or Enter.
- Battle / Angling: Mouse click to select and play cards, activate reel techniques,
  and manage line tension.
- Main Menu: Click "DELVE INTO THE DEPTHS" to start.


Enjoy your voyage into the eldritch waters!
==============================================================================
