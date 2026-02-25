@echo off
setlocal enabledelayedexpansion
title Compilando Testes Unitarios Miré-Desk
echo ========================================
echo   Compilando TestRunner.dpr
echo ========================================

set "DCC_PATH=C:\Program Files (x86)\Embarcadero\Studio\23.0\bin\dcc64.exe"

if exist "!DCC_PATH!" (
    echo [Build] Compilando TestRunner...
    "!DCC_PATH!" -Q -B "TestRunner.dpr"
    if errorlevel 1 (
        echo [ERRO] Falha ao compilar TestRunner. Verifique os erros acima.
        pause
        exit /b 1
    )
    
    echo [OK] TestRunner.exe gerado com sucesso!
    echo.
    echo Executando testes...
    echo.
    TestRunner.exe
    pause
) else (
    echo [ERRO] Compilador Delphi nao encontrado em: !DCC_PATH!
    echo Por favor, compile o projeto TestRunner.dpr manualmente na IDE do Delphi.
    pause
)
