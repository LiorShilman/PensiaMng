@echo off
chcp 65001 >nul
title PensiaMng - launcher

echo Starting PensiaMng...
echo.

REM Start server (NestJS, port 3210) in its own window
start "PensiaMng - Server (3210)" cmd /k "cd /d "%~dp0server" && npm run start:dev"

REM Start client (Vite) in its own window
start "PensiaMng - Client" cmd /k "cd /d "%~dp0client" && npm run dev"

echo.
echo Two windows opened: Server and Client.
echo Wait a few seconds, then open the URL shown in the Client window
echo (usually http://localhost:5173).
echo.
echo This window can be closed - it does not need to stay open.
pause
