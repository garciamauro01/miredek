@echo off
setlocal enabledelayedexpansion
title Gerando Instalador Miré-Desk (NSIS)
echo ========================================
echo   Lançando Build do Miré-Desk (Instalador NSIS)
echo ========================================

echo.
set /p CLOUD_IP="Digite o IP do Servidor (deixe em branco para usar 167.234.241.147): "
if "!CLOUD_IP!"=="" set CLOUD_IP=167.234.241.147
set VITE_SERVER_IP=!CLOUD_IP!
echo Usando Servidor IP: !VITE_SERVER_IP!
echo.
set /p UPDATE_TOKEN="Digite o Token de Upload (deixe em branco para o padrao): "
if "!UPDATE_TOKEN!"=="" set UPDATE_TOKEN=miredesk-secret-token


echo.
echo 0. Parando processos do Agente...
taskkill /F /IM MireDeskAgent.exe >nul 2>&1
taskkill /F /IM MireDeskService.exe >nul 2>&1
taskkill /F /IM MireDeskNative.exe >nul 2>&1
echo [OK] Processos parados.

echo.
echo 1. Compilando Componentes Nativos (Delphi)...
set "DCC_PATH=C:\Program Files (x86)\Embarcadero\Studio\23.0\bin\dcc64.exe"

if exist "!DCC_PATH!" (
    echo [Build] Compilando MireDeskService...
    "!DCC_PATH!" -Q -B -E"native_service" "native_service\MireDeskService.dpr"
    if errorlevel 1 (
        echo [ERRO] Falha ao compilar MireDeskService. Verifique o Delphi.
        pause
        exit /b 1
    )
    
    echo [Build] Compilando MireDeskAgent...
    "!DCC_PATH!" -Q -B -E"native_service" "native_service\MireDeskAgent.dpr"
    if errorlevel 1 (
        echo [ERRO] Falha ao compilar MireDeskAgent. Verifique o Delphi.
        pause
        exit /b 1
    )
    echo [OK] Binarios nativos atualizados.
) else (
    echo [AVISO] Compilador Delphi nao encontrado em: !DCC_PATH!
    echo Usando binarios existentes em native_service.
)

echo.
echo 2. Incrementando versao e instalando dependencias...
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

:: Copia para public também para garantir visibilidade
copy /Y "server\version.json" "server\public\version.json"

echo.
echo ========================================
echo   Processo concluido!
echo   1. Instalador em: dist-package
echo   2. Update preparado em: server/public
echo   3. Manifesto de versao atualizado: server/version.json
echo ========================================

echo.
set /p UPLOAD="Deseja enviar o instalador para o servidor cloud (!VITE_SERVER_IP!)? (S/N): "
if /i "!UPLOAD!"=="S" (
    echo.
    echo [Upload] Enviando arquivos para o servidor...
    
    :: Usando curl para enviar os arquivos
    :: -F indica multipart/form-data
    :: -H adiciona o header customizado para o token
    curl -X POST "http://!VITE_SERVER_IP!:3001/upload-update" ^
         -H "x-update-token: !UPDATE_TOKEN!" ^
         -F "exe=@server/public/MireDesk-Setup.exe" ^
         -F "version=@server/version.json"
    
    if !errorlevel! equ 0 (
        echo.
        echo [OK] Arquivos enviados e publicados com sucesso no servidor!
    ) else (
        echo.
        echo [ERRO] Falha no upload. Verifique o IP, Token e se o servidor esta rodando.
    )
)

echo.
echo ========================================
echo   Processo concluido!
echo ========================================
echo NOTA: Quando o app for instalado, mude 'SERVER_IP' no version.json 
echo para o IP real do seu servidor de rede.
pause
