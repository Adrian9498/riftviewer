@echo off
rem Descarga el catalogo de cartas de OpenRift (openrift.app) y lo guarda
rem como openrift-cards.js junto al visualizador. Ejecutalo cuando salga un set nuevo.
cd /d "%~dp0"
echo Descargando catalogo de OpenRift...
curl -sSf -A "RiftboundReplayVisualizer/1.0 (personal project)" -o "%TEMP%\openrift-catalog.json" "https://openrift.app/api/v1/catalog?langs=EN"
if errorlevel 1 (
  echo.
  echo No se pudo descargar el catalogo. Revisa tu conexion e intentalo de nuevo.
  pause
  exit /b 1
)
<nul set /p="window.OPENRIFT_CATALOG=" > openrift-cards.js
type "%TEMP%\openrift-catalog.json" >> openrift-cards.js
echo ;>> openrift-cards.js
del "%TEMP%\openrift-catalog.json"
echo.
echo Listo: openrift-cards.js actualizado. Recarga el visualizador en el navegador.
pause
