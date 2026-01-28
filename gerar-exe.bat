@echo off
setlocal enabledelayedexpansion
title Gerando Instalador Miré-Desk (NSIS)
echo ========================================
echo   Lançando Build do Miré-Desk (Instalador NSIS)
echo ========================================

echo.
echo 1. Incrementando versao e instalando dependencias...
:: Incrementa automagicamente a versao (patch: 1.0.0 -> 1.0.1)
call npm version patch --no-git-tag-version
call npm install

echo.
echo 2. Iniciando processo de empacotamento...
call npm run dist

echo.
echo 3. Preparando Auto-Update...

:: Obter versão do package.json
for /f "delims=" %%a in ('node -e "console.log(require('./package.json').version)"') do set VERSION=%%a

echo Versao detectada: !VERSION!

:: Garantir pasta public no servidor
if not exist "server\public" mkdir "server\public"

:: Copiar executavel para o servidor (Renomeando para nome fixo de download)
:: Usamos caracteres curinga (*) para evitar problemas de encoding com o 'é' no nome do arquivo
echo Tentando localizar o instalador em dist-package...

set FOUND=0
for %%f in ("dist-package\MireDesk-Setup !VERSION!.exe" "dist-package\MireDesk-Setup-!VERSION!.exe" "dist-package\Mir*-Desk Setup !VERSION!.exe" "dist-package\Mir*-Desk !VERSION!.exe" "dist-package\Mir*-Desk-Setup-!VERSION!.exe") do (
    if exist "%%f" (
        echo [OK] Encontrado: %%f
        copy /Y "%%f" "server\public\MireDesk-Setup.exe"
        set FOUND=1
        goto :after_copy
    )
)
:after_copy

if !FOUND! equ 0 (
    echo [ERRO] Nao foi possivel encontrar o instalador em dist-package.
    echo Procure por um arquivo .exe na pasta dist-package e copie manualmente para server/public/MireDesk-Setup.exe
)

:: Gerar arquivo version.json automaticamente
(
echo {
echo     "version": "!VERSION!",
echo     "critical": false,
echo     "downloadUrl": "/MireDesk-Setup.exe",
echo     "releaseNotes": "Versao !VERSION! (Instalador NSIS) gerada em %date% %time%"
echo }
) > "server\version.json"

echo.
echo ========================================
echo   Processo concluido!
echo   1. Instalador em: dist-package
echo   2. Update preparado em: server/public
echo   3. Manifesto de versao atualizado: server/version.json
echo ========================================
echo NOTA: Quando o app for instalado, mude 'SERVER_IP' no version.json 
echo para o IP real do seu servidor de rede.
pause
