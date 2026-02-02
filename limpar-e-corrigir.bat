@echo off
setlocal
echo ========================================
echo   ULTRA CLEAN v3 - Miré-Desk (Fix RobotJS)
echo ========================================

:: CRÍTICO: Força o diretório de trabalho para a pasta do script
cd /d "%~dp0"
echo Diretorio de trabalho: %CD%

:: Forca o uso do compilador padrão do Visual Studio 2022
set GYP_MSVS_VERSION=2022
set npm_config_msvs_version=2022

echo.
echo 1. Matando processos que podem travar o node_modules...
taskkill /F /IM node.exe /T 2>nul
taskkill /F /IM electron.exe /T 2>nul
taskkill /F /IM "Miré-Desk.exe" /T 2>nul
:: Aguarda um pouco para os processos encerrarem
timeout /t 3 /nobreak >nul

echo.
echo 2. Limpeza Profunda via PowerShell...
:: Remove node_modules mesmo com nomes de arquivos longos ou travados
powershell -Command "if (Test-Path node_modules) { Write-Host 'Removendo node_modules...'; Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue }; if (Test-Path package-lock.json) { Remove-Item -Force package-lock.json }; if (Test-Path dist) { Remove-Item -Recurse -Force dist }; if (Test-Path dist-electron) { Remove-Item -Recurse -Force dist-electron }"

echo.
echo 3. Limpando cache do npm...
call npm cache clean --force

echo.
echo 4. Reinstalando dependencias...
:: Sem ignore-scripts aqui para garantir que o postinstall rode no final
call npm install

echo.
echo 5. Verificando se o @jitsi/robotjs foi compilado...
if not exist node_modules\@jitsi\robotjs\build\Release\robotjs.node (
    echo [AVISO] @jitsi/robotjs nao compilou no install. Tentando forcar agora...
    call npx @electron/rebuild -v 28.2.0 -f -m . -w @jitsi/robotjs
)

echo.
echo ========================================
echo   Processo concluido! 
echo   Agora tente rodar o gerar-exe.bat.
echo ========================================
pause
