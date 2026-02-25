!macro customInit
  DetailPrint "Parando servicos em execucao para instalacao/atualizacao..."
  ExecWait 'net stop MireDeskService'
  ExecWait 'taskkill /f /im MireDeskService.exe'
  ExecWait 'taskkill /f /im MireDeskAgent.exe'
  ExecWait 'taskkill /f /im Mire-Desk.exe'
  Sleep 2000
!macroend

!macro customInstall
  DetailPrint "Instalando MireDesk Native Service..."
  ExecWait '"$INSTDIR\resources\bin\MireDeskService.exe" /install'
  ExecWait 'net start MireDeskService'
!macroend

!macro customUnInstall
  DetailPrint "Removendo MireDesk Native Service e Tarefas em Andamento..."
  ExecWait 'net stop MireDeskService'
  ExecWait 'taskkill /f /im MireDeskService.exe'
  ExecWait 'taskkill /f /im MireDeskAgent.exe'
  ExecWait 'taskkill /f /im Mire-Desk.exe'
  Sleep 2000
  ExecWait '"$INSTDIR\resources\bin\MireDeskService.exe" /uninstall'
!macroend
