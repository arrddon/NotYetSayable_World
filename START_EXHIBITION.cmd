@echo off
setlocal
cd /d "%~dp0"
node scripts\exhibition-server.mjs
if errorlevel 1 pause
