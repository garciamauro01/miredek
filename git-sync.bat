@echo off
echo ========================================
echo   Sincronizando com o Git...
echo ========================================

echo 1. Adicionando arquivos...
git add .

set /p msg="Digite a mensagem do commit (ou ENTER para 'Auto commit'): "
if "%msg%"=="" set msg=Auto commit

echo 2. Fazendo commit...
git commit -m "%msg%"

echo 3. Fazendo pull (recebendo atualizacoes)...
git pull

echo 4. Fazendo push (enviando alteracoes)...
git push

echo ========================================
echo   Processo concluido!
echo ========================================
pause
