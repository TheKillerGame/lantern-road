@echo off
cd /d "%~dp0"
start "" msedge http://localhost:8382/
python serve.py
