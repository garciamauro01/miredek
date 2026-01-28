@echo off
echo Encerrando processos do Node e Electron...
taskkill /F /IM node.exe /T
taskkill /F /IM electron.exe /T
taskkill /F /IM "Miré-Desk.exe" /T
taskkill /F /IM "Miré-Desk*.exe" /T

echo.
echo Iniciando PeerJS Server...
start "PeerJS Server" cmd /k "npm run server:peer"

echo.
echo Iniciando Update Server...
start "Update Server" cmd /k "node server/index.js"

echo.
echo Iniciando Ambiente de Desenvolvimento...
start "Dev Environment" cmd /k "npm run dev"

echo.
echo Servicos reiniciados em novas janelas!
timeout /t 5
