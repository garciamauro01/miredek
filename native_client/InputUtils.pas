unit InputUtils;

interface

uses
  Winapi.Windows, System.SysUtils, System.JSON;

procedure HandleRemoteInput(const MsgType: string; Data: TJSONObject);
procedure SimulateMouseMove(X, Y: Double);
procedure SimulateMouseButton(const Button, Action: string; X, Y: Double);
procedure SimulateKey(const Key, Action: string; const Modifiers: string = '');
procedure SimulateScroll(DeltaY: Integer);

implementation

procedure HandleRemoteInput(const MsgType: string; Data: TJSONObject);
begin
  if MsgType = 'mousemove' then
    SimulateMouseMove(Data.GetValue<Double>('x'), Data.GetValue<Double>('y'))
  else if (MsgType = 'mousedown') or (MsgType = 'mouseup') then
    SimulateMouseButton(Data.GetValue<string>('button'), MsgType, Data.GetValue<Double>('x'), Data.GetValue<Double>('y'))
  else if (MsgType = 'keydown') or (MsgType = 'keyup') then
    SimulateKey(Data.GetValue<string>('key'), MsgType)
  else if MsgType = 'mousewheel' then
    SimulateScroll(Data.GetValue<Integer>('deltaY'));
end;

procedure SimulateMouseMove(X, Y: Double);
var
  ScreenWidth, ScreenHeight: Integer;
  AbsoluteX, AbsoluteY: Integer;
begin
  ScreenWidth := GetSystemMetrics(SM_CXSCREEN);
  ScreenHeight := GetSystemMetrics(SM_CYSCREEN);

  // mouse_event expects coordinates in a 0..65535 range for MOVE | ABSOLUTE
  AbsoluteX := Round(X * 65535);
  AbsoluteY := Round(Y * 65535);

  mouse_event(MOUSEEVENTF_ABSOLUTE or MOUSEEVENTF_MOVE, AbsoluteX, AbsoluteY, 0, 0);
end;

procedure SimulateMouseButton(const Button, Action: string; X, Y: Double);
var
  Flags: DWORD;
  AbsoluteX, AbsoluteY: Integer;
begin
  SimulateMouseMove(X, Y); // Ensure mouse is at position

  Flags := 0;
  if Button = 'left' then
  begin
    if Action = 'mousedown' then Flags := MOUSEEVENTF_LEFTDOWN else Flags := MOUSEEVENTF_LEFTUP;
  end
  else if Button = 'right' then
  begin
    if Action = 'mousedown' then Flags := MOUSEEVENTF_RIGHTDOWN else Flags := MOUSEEVENTF_RIGHTUP;
  end
  else if Button = 'middle' then
  begin
    if Action = 'mousedown' then Flags := MOUSEEVENTF_MIDDLEDOWN else Flags := MOUSEEVENTF_MIDDLEUP;
  end;

  if Flags <> 0 then
    mouse_event(Flags, 0, 0, 0, 0);
end;

procedure SimulateKey(const Key, Action: string; const Modifiers: string = '');
var
  VK: Byte;
  Flags: DWORD;
begin
  // Very basic mapping for now. A full mapping table would be needed for production.
  VK := 0;
  if Length(Key) = 1 then
    VK := VkKeyScan(PChar(Key)[0]) and $FF
  else
  begin
    if Key = 'enter' then VK := VK_RETURN
    else if Key = 'backspace' then VK := VK_BACK
    else if Key = 'tab' then VK := VK_TAB
    else if Key = 'escape' then VK := VK_ESCAPE
    else if Key = 'control' then VK := VK_CONTROL
    else if Key = 'shift' then VK := VK_SHIFT
    else if Key = 'alt' then VK := VK_MENU
    else if Key = 'meta' then VK := VK_LWIN // Windows key
    else if Key = 'arrowup' then VK := VK_UP
    else if Key = 'arrowdown' then VK := VK_DOWN
    else if Key = 'arrowleft' then VK := VK_LEFT
    else if Key = 'arrowright' then VK := VK_RIGHT
    else if Key = 'delete' then VK := VK_DELETE
    else if Key = 'pageup' then VK := VK_PRIOR
    else if Key = 'pagedown' then VK := VK_NEXT
    else if Key = 'home' then VK := VK_HOME
    else if Key = 'end' then VK := VK_END;
  end;

  if VK <> 0 then
  begin
    Flags := 0;
    if Action = 'keyup' then Flags := KEYEVENTF_KEYUP;
    keybd_event(VK, 0, Flags, 0);
  end;
end;

procedure SimulateScroll(DeltaY: Integer);
begin
  // DeltaY in web is usually pixels. Windows scroll expects multiples of WHEEL_DELTA (120)
  // We'll normalize it somewhat.
  mouse_event(MOUSEEVENTF_WHEEL, 0, 0, -DeltaY, 0);
end;

end.
