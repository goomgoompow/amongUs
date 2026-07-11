@echo off
setlocal
cd /d "%~dp0"

set "NODE=%~dp0.runtime\node-v24.18.0-win-x64\node.exe"

net session >nul 2>&1
if not "%errorlevel%"=="0" goto elevate

if not exist "%NODE%" (
  for /f "delims=" %%I in ('where node 2^>nul') do if not defined SYSTEM_NODE set "SYSTEM_NODE=%%I"
  if not defined SYSTEM_NODE goto missing_node
  set "NODE=%SYSTEM_NODE%"
)

echo Removing old firewall rules...
netsh advfirewall firewall delete rule name="Starlight Station TCP 3000" >nul 2>&1
netsh advfirewall firewall delete rule name="Starlight Station Node Server" >nul 2>&1

echo Adding TCP port rule...
netsh advfirewall firewall add rule name="Starlight Station TCP 3000" dir=in action=allow protocol=TCP localport=3000 profile=any remoteip=localsubnet enable=yes
if errorlevel 1 goto failed

echo Adding Node.js program rule...
netsh advfirewall firewall add rule name="Starlight Station Node Server" dir=in action=allow program="%NODE%" protocol=TCP profile=any remoteip=localsubnet enable=yes
if errorlevel 1 goto failed

echo.
echo Firewall setup completed.
echo Two inbound rules were added:
echo   1. Starlight Station TCP 3000
echo   2. Starlight Station Node Server
echo.
echo Restart the game server, then open:
echo http://192.168.0.2:3000
echo.
pause
exit /b 0

:elevate
echo Requesting administrator permission...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
exit /b

:missing_node
echo.
echo ERROR: Node.js was not found. Install Node.js LTS first.
pause
exit /b 1

:failed
echo.
echo ERROR: Windows Firewall setup failed.
pause
exit /b 1
