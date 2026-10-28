@echo off
rem Atajo de doble clic para "npm run catalogo": descarga el catalogo de OpenRift
rem a public\openrift-catalog.json. Necesita Node.js en el PATH.
cd /d "%~dp0"
call npm run catalogo
pause
