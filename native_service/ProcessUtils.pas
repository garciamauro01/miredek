unit ProcessUtils;

interface

uses
  Winapi.Windows, System.SysUtils, Winapi.AccCtrl, Winapi.Messages;

function LaunchProcessAsUser(const ExecutablePath: string; SessionID: DWORD): Boolean;
function LaunchProcessAsSystemInSession(const ExecutablePath: string; SessionID: DWORD): Boolean;
function GetActiveSessionID: DWORD;
function IsProcessRunning(const ExecutableName: string): Boolean;
function SwitchToActiveDesktop: Boolean;

implementation

uses
  Winapi.TlHelp32;

// WTS APIs are in Wtsapi32.dll
function WTSQueryUserToken(SessionId: ULONG; var phToken: THandle): BOOL; stdcall;
  external 'wtsapi32.dll' name 'WTSQueryUserToken';

function WTSGetActiveConsoleSessionId: DWORD; stdcall;
  external 'kernel32.dll' name 'WTSGetActiveConsoleSessionId';

function GetActiveSessionID: DWORD;
begin
  Result := WTSGetActiveConsoleSessionId;
  if Result = $FFFFFFFF then
    Result := 0; // Fallback or handle error
end;

function SwitchToActiveDesktop: Boolean;
var
  hDesk: THandle;
  Dummy: DWORD;
begin
  Result := False;
  // Try to open the current input desktop (could be Winlogon or Default)
  // We use MAXIMUM_ALLOWED to ensure we get as much access as possible
  hDesk := OpenInputDesktop(0, False, MAXIMUM_ALLOWED);
  if hDesk <> 0 then
  begin
    // SetThreadDesktop can fail if there are windows already created on the current desktop
    if SetThreadDesktop(hDesk) then
      Result := True;
    CloseDesktop(hDesk);
  end;
end;

function LaunchProcessAsUser(const ExecutablePath: string; SessionID: DWORD): Boolean;
var
  hToken: THandle;
  si: TStartupInfo;
  pi: TProcessInformation;
begin
  Result := False;
  if not WTSQueryUserToken(SessionID, hToken) then
    Exit;

  try
    FillChar(si, SizeOf(si), 0);
    si.cb := SizeOf(si);
    si.lpDesktop := PChar('winsta0\default');

    if CreateProcessAsUser(hToken,
                           nil,
                           PChar(ExecutablePath),
                           nil,
                           nil,
                           False,
                           NORMAL_PRIORITY_CLASS or CREATE_NEW_CONSOLE or CREATE_UNICODE_ENVIRONMENT,
                           nil,
                           nil,
                           si,
                           pi) then
    begin
      CloseHandle(pi.hProcess);
      CloseHandle(pi.hThread);
      Result := True;
    end;
  finally
    CloseHandle(hToken);
  end;
end;

function LaunchProcessAsSystemInSession(const ExecutablePath: string; SessionID: DWORD): Boolean;
var
  hToken, hPrimary: THandle;
  si: TStartupInfo;
  pi: TProcessInformation;
begin
  Result := False;
  // This is called from a Service (Session 0). 
  // We want to run the process as SYSTEM but in the target SessionID.
  
  if not OpenProcessToken(GetCurrentProcess, TOKEN_ALL_ACCESS, hToken) then
    Exit;

  try
    if not DuplicateTokenEx(hToken, MAXIMUM_ALLOWED, nil, SecurityIdentification, TokenPrimary, hPrimary) then
      Exit;

    try
      // Change the session ID of the duplicated token
      if not SetTokenInformation(hPrimary, TokenSessionId, @SessionID, SizeOf(DWORD)) then
        Exit;

      FillChar(si, SizeOf(si), 0);
      si.cb := SizeOf(si);
      si.lpDesktop := PChar('winsta0\default');

      if CreateProcessAsUser(hPrimary,
                             nil,
                             PChar(ExecutablePath),
                             nil,
                             nil,
                             False,
                             NORMAL_PRIORITY_CLASS or CREATE_NEW_CONSOLE or CREATE_UNICODE_ENVIRONMENT,
                             nil,
                             nil,
                             si,
                             pi) then
      begin
        CloseHandle(pi.hProcess);
        CloseHandle(pi.hThread);
        Result := True;
      end;
    finally
      CloseHandle(hPrimary);
    end;
  finally
    CloseHandle(hToken);
  end;
end;

function IsProcessRunning(const ExecutableName: string): Boolean;
var
  hSnapshot: THandle;
  pe: TProcessEntry32;
begin
  Result := False;
  hSnapshot := CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
  if hSnapshot = INVALID_HANDLE_VALUE then Exit;

  try
    pe.dwSize := SizeOf(TProcessEntry32);
    if Process32First(hSnapshot, pe) then
    begin
      repeat
        if SameText(pe.szExeFile, ExecutableName) then
        begin
          Result := True;
          Break;
        end;
      until not Process32Next(hSnapshot, pe);
    end;
  finally
    CloseHandle(hSnapshot);
  end;
end;

end.
