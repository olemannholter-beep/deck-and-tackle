#!/bin/bash
# ==============================================================================
# Deck & Tackle — macOS 1-Click Game Launcher
# Double-click this file in Finder to immediately launch the game!
# ==============================================================================

# Ensure execution starts in the script's folder
cd "$(dirname "$0")"

clear
echo "=========================================================="
echo "          Deck & Tackle — macOS Game Launcher            "
echo "=========================================================="
echo ""

# Find an available port starting at 8080
PORT=8080
while lsof -i :$PORT >/dev/null 2>&1; do
  PORT=$((PORT + 1))
done

echo "Starting local game server on http://localhost:$PORT ..."

# Check available server runtimes
if command -v python3 >/dev/null 2>&1; then
  python3 -m http.server $PORT &
  SERVER_PID=$!
elif command -v python >/dev/null 2>&1; then
  python -m SimpleHTTPServer $PORT &
  SERVER_PID=$!
elif command -v php >/dev/null 2>&1; then
  php -S localhost:$PORT &
  SERVER_PID=$!
elif command -v npx >/dev/null 2>&1; then
  npx -y serve -p $PORT . &
  SERVER_PID=$!
else
  echo "[!] No local server runtime found. Opening index.html directly..."
  open "index.html"
  exit 0
fi

# Clean up server on exit / terminal close / Ctrl+C
cleanup() {
  echo ""
  echo "Shutting down local server (PID: $SERVER_PID)..."
  kill $SERVER_PID 2>/dev/null
  exit 0
}
trap cleanup INT TERM EXIT

sleep 0.8

echo "Opening Deck & Tackle in your default browser..."
open "http://localhost:$PORT"

echo ""
echo "----------------------------------------------------------"
echo "  Game is running at: http://localhost:$PORT"
echo "  Keep this Terminal window open while playing."
echo "  To exit, press Ctrl+C or close this window."
echo "----------------------------------------------------------"

wait $SERVER_PID