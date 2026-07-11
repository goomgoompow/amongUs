@echo off
setlocal
cd /d "%~dp0"

set "NODE=%~dp0.runtime\node-v24.18.0-win-x64\node.exe"
set "SERVER=%~dp0server.cjs"

if not exist "%NODE%" set "NODE=node"
if not exist "%SERVER%" goto missing_server

powershell.exe -NoProfile -Command "try { $r = Invoke-RestMethod 'http://localhost:3000/api/health' -TimeoutSec 2; if ($r.ok) { exit 0 } } catch {}; exit 1" >nul 2>nul
if not errorlevel 1 goto already_running

echo.
echo Starting Starlight Station game server...
echo Local address: http://localhost:3000
echo LAN address:   http://192.168.0.2:3000
echo Keep this window open while playing.
echo Press Ctrl+C to stop the server.
echo.

"%NODE%" "%SERVER%"
goto finished

:already_running
echo.
echo The game server is already running.
echo Open: http://localhost:3000
echo LAN:  http://192.168.0.2:3000
echo.
pause
exit /b 0

:missing_node
echo.
echo ERROR: Node.js was not found. Install Node.js LTS first.
pause
exit /b 1

:missing_server
echo.
echo ERROR: server.cjs was not found.
echo Expected: %SERVER%
pause
exit /b 1

:finished
echo.
echo The game server has stopped.
pause
endlocal
