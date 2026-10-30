@echo off
rem Abre o PÊNALTI MÁXIMO no navegador. O jogo é 3D e precisa de um servidor local (precisa do Node.js instalado: https://nodejs.org).
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js nao encontrado. Instale em https://nodejs.org e rode de novo. & pause & exit /b 1)
node tools\servidor.mjs
pause
