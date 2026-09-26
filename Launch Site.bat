@echo off
title Movie Rating Page
rem Run from the folder that holds this file.
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed or npm is not on the PATH.
  echo Install Node.js from https://nodejs.org and try again.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Installing packages. This runs only the first time.
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)

rem Open the browser when the server answers on port 3000.
start "" /b powershell -NoProfile -WindowStyle Hidden -Command ^
  "for ($i = 0; $i -lt 120; $i++) { try { (New-Object Net.Sockets.TcpClient).Connect('localhost', 3000); Start-Process 'http://localhost:3000'; break } catch { Start-Sleep -Seconds 1 } }"

echo Starting the site at http://localhost:3000
echo Close this window to stop the server.
call npm run dev

pause
