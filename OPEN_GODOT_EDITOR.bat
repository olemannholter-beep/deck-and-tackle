@echo off
cd /d "%~dp0godot-port"
start "" "Godot_v4.3-stable_win64.exe" -e --path "%~dp0godot-port" "res://scenes/Overworld.tscn"
