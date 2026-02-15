!macro customInstall
  DetailPrint "Instalando MireDesk Native Service..."
  ExecWait '"$INSTDIR\resources\bin\MireDeskService.exe" /install'
  ExecWait 'net start MireDeskService'
!macroend

!macro customUnInstall
  DetailPrint "Removendo MireDesk Native Service..."
  ExecWait 'net stop MireDeskService'
  ExecWait '"$INSTDIR\resources\bin\MireDeskService.exe" /uninstall'
!macroend
