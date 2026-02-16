unit ServerWorker;

interface

uses
  System.SysUtils, System.Classes, System.Math, Vcl.Graphics, System.Net.Socket,
  IdContext, IdCustomHTTPServer, IdHTTPServer, Vcl.Imaging.jpeg,
  Winapi.Windows, Winapi.MultiMon, System.Threading, ProcessUtils, System.IOUtils, System.SyncObjs,
  BlockProtocol;

type
  TServiceWorker = class(TThread)
  private
    FServer: TIdHTTPServer;
    FLastCapture: TMemoryStream;
    FLock: TObject;

    // Reusable resources to avoid GDI leaks
    FBmp: Vcl.Graphics.TBitmap;
    FJpg: TJPEGImage;
    TempStream: TMemoryStream;
    FCaptureRect: TRect;
    FMonitorIndex: Integer;

    // Differential Capture (Block-based)
    FPreviousFrame: Vcl.Graphics.TBitmap;
    FBlockSize: Integer;
    FUseDifferentialCapture: Boolean;
    FBlockEncoder: TBlockProtocolEncoder;
    FFrameNumber: Cardinal;

    procedure OnCommandGet(AContext: TIdContext; ARequestInfo: TIdHTTPRequestInfo; AResponseInfo: TIdHTTPResponseInfo);
    procedure CaptureScreen;
    procedure UpdateCaptureArea(AMonitorIndex: Integer);
    
    // Block Comparison Helpers
    function CalculateBlockChecksum(ABitmap: Vcl.Graphics.TBitmap; X, Y, BlockSize: Integer): Cardinal;
    function IsBlockDirty(X, Y: Integer): Boolean;
  protected
    procedure Execute; override;
  public
    constructor Create;
    destructor Destroy; override;
    procedure Stop;
  end;

procedure LogToFile(const Msg: string);

implementation

{ TServiceWorker }

constructor TServiceWorker.Create;
begin
  inherited Create(True);
  FreeOnTerminate := False;
  FLock := TObject.Create;
  FLastCapture := TMemoryStream.Create;
  
  
  FServer := TIdHTTPServer.Create(nil);
  FServer.DefaultPort := 9876;
  FServer.OnCommandGet := OnCommandGet;
  
  // Default to Primary Monitor
  FMonitorIndex := 0; 
  FCaptureRect := Rect(0, 0, GetSystemMetrics(SM_CXSCREEN), GetSystemMetrics(SM_CYSCREEN));
  
  // Differential Capture Settings
  FBlockSize := 64; // 64x64 pixel blocks
  FUseDifferentialCapture := True; // Enable by default
  FPreviousFrame := nil; // Will be created on first capture
  FBlockEncoder := TBlockProtocolEncoder.Create(FBlockSize, 70); // Quality 70
  FFrameNumber := 0;
  
  LogToFile('ServiceWorker Created');
end;

function MonitorEnumProc(hMonitor: HMONITOR; hdcMonitor: HDC; lprcMonitor: PRect; dwData: LPARAM): BOOL; stdcall;
var
  MonitorList: TList;
  R: PRect;
begin
  MonitorList := TList(Pointer(dwData));
  New(R);
  R^ := lprcMonitor^;
  MonitorList.Add(R);
  Result := True;
end;

procedure TServiceWorker.UpdateCaptureArea(AMonitorIndex: Integer);
var
  MonitorList: TList;
  I: Integer;
begin
  MonitorList := TList.Create;
  try
    if AMonitorIndex = -1 then
    begin
       // Virtual Screen (All monitors)
       FCaptureRect.Left := GetSystemMetrics(SM_XVIRTUALSCREEN);
       FCaptureRect.Top := GetSystemMetrics(SM_YVIRTUALSCREEN);
       FCaptureRect.Right := FCaptureRect.Left + GetSystemMetrics(SM_CXVIRTUALSCREEN);
       FCaptureRect.Bottom := FCaptureRect.Top + GetSystemMetrics(SM_CYVIRTUALSCREEN);
       FMonitorIndex := -1;
       LogToFile('Switching to Virtual Screen: ' + IntToStr(FCaptureRect.Right - FCaptureRect.Left) + 'x' + IntToStr(FCaptureRect.Bottom - FCaptureRect.Top));
    end
    else
    begin
       // Specific Monitor
       EnumDisplayMonitors(0, nil, @MonitorEnumProc, LPARAM(Pointer(MonitorList)));
       
       if (AMonitorIndex >= 0) and (AMonitorIndex < MonitorList.Count) then
       begin
         FCaptureRect := PRect(MonitorList[AMonitorIndex])^;
         FMonitorIndex := AMonitorIndex;
         LogToFile('Switching to Monitor ' + IntToStr(AMonitorIndex) + ': ' + IntToStr(FCaptureRect.Right - FCaptureRect.Left) + 'x' + IntToStr(FCaptureRect.Bottom - FCaptureRect.Top));
       end
       else
       begin
         // Fallback to Primary
         FCaptureRect := Rect(0, 0, GetSystemMetrics(SM_CXSCREEN), GetSystemMetrics(SM_CYSCREEN));
         FMonitorIndex := 0;
         LogToFile('Monitor Index out of range, fallback to primary.');
       end;
    end;
  finally
    for I := 0 to MonitorList.Count - 1 do Dispose(PRect(MonitorList[I]));
    MonitorList.Free;
  end;
end;

var
  GLogLock: TCriticalSection;

procedure LogToFile(const Msg: string);
begin
  if GLogLock = nil then Exit;
  GLogLock.Enter;
  try
    try
      TFile.AppendAllText(TPath.Combine(TPath.GetTempPath, 'MireDeskAgent.log'), Format('[%s] %s%s', [DateTimeToStr(Now), Msg, sLineBreak]));
    except
      // Swallow logging errors to prevent crash
    end;
  finally
    GLogLock.Leave;
  end;
end;

destructor TServiceWorker.Destroy;
begin
  FServer.Active := False;
  FServer.Free;
  FLastCapture.Free;
  FLock.Free;
  inherited;
end;

procedure TServiceWorker.Execute;
begin
  LogToFile('Worker Thread STARTING');
  
  // Initialize resources in Thread Context
  try
    FBmp := Vcl.Graphics.TBitmap.Create;
    FBmp.PixelFormat := pf24bit;
    FBmp.SetSize(1920, 1080); // Init size
    
    FJpg := TJPEGImage.Create;
    FJpg.CompressionQuality := 70; // Better quality, slightly larger size
    FJpg.Performance := jpBestSpeed;
    
    TempStream := TMemoryStream.Create;
    
    // Create initial black frame
    FBmp.Canvas.Brush.Color := clBlack;
    FBmp.Canvas.FillRect(Rect(0, 0, 1920, 1080));
    FBmp.Canvas.Font.Color := clWhite;
    FBmp.Canvas.Font.Size := 24;
    FBmp.Canvas.TextOut(50, 50, 'MireDesk Agent Starting...');
    FJpg.Assign(FBmp);
    FJpg.SaveToStream(FLastCapture);
    
    LogToFile('Resources Initialized in Thread. Initial Frame Created.');
  except
    on E: Exception do LogToFile('Error Initializing Resources: ' + E.Message);
  end;

  try
    FServer.Active := True;
    LogToFile('MJPEG Server active on port ' + IntToStr(FServer.DefaultPort));
  except
    on E: Exception do
      LogToFile('FATAL Error starting MJPEG Server: ' + E.Message);
  end;

  while not Terminated do
  begin
    try
    // Check Desktop Switch periodically (approx every 1 sec)
    if (GetTickCount mod 1000) < 50 then
    begin
       if SwitchToActiveDesktop then
       begin
          // LogToFile('Switched Desktop');
       end;
    end;
      
    // Capture
    CaptureScreen;
      
    except
      on E: Exception do
        LogToFile('Error in capture loop: ' + E.Message);
    end;
    Sleep(16); // Target ~60 FPS capture rate (limited by encoding speed) 
  end;

  FServer.Active := False;
  
  // Cleanup resources
  FBmp.Free;
  FJpg.Free;
  TempStream.Free;
  if FPreviousFrame <> nil then FPreviousFrame.Free;
  
  LogToFile('Worker Thread STOPPED');
end;

procedure TServiceWorker.Stop;
begin
  Terminate;
  WaitFor;
end;

function TServiceWorker.CalculateBlockChecksum(ABitmap: Vcl.Graphics.TBitmap; X, Y, BlockSize: Integer): Cardinal;
var
  Row, Col: Integer;
  P: PByte;
  Hash: Cardinal;
  MaxX, MaxY: Integer;
  PixelValue: Cardinal;
begin
  Hash := 0;
  MaxX := Min(X + BlockSize, ABitmap.Width);
  MaxY := Min(Y + BlockSize, ABitmap.Height);
  
  // Simple hash: XOR of sampled pixels (every 4th row and column for speed)
  for Row := Y to MaxY - 1 do
  begin
    if (Row - Y) mod 4 <> 0 then Continue; // Sample every 4th row
    P := ABitmap.ScanLine[Row];
    
    for Col := X to MaxX - 1 do
    begin
      if (Col - X) mod 4 = 0 then // Sample every 4th column
      begin
        // Read 3 bytes (RGB) safely
        PixelValue := Cardinal(P[Col * 3]) shl 16 or 
                      Cardinal(P[Col * 3 + 1]) shl 8 or 
                      Cardinal(P[Col * 3 + 2]);
        Hash := Hash xor PixelValue;
      end;
    end;
  end;
  
  Result := Hash;
end;

function TServiceWorker.IsBlockDirty(X, Y: Integer): Boolean;
var
  CurrentChecksum, PreviousChecksum: Cardinal;
begin
  // If no previous frame, all blocks are dirty
  if FPreviousFrame = nil then
  begin
    Result := True;
    Exit;
  end;
  
  // Calculate checksums for current and previous frames
  CurrentChecksum := CalculateBlockChecksum(FBmp, X, Y, FBlockSize);
  PreviousChecksum := CalculateBlockChecksum(FPreviousFrame, X, Y, FBlockSize);
  
  // Block is dirty if checksums differ
  Result := CurrentChecksum <> PreviousChecksum;
end;

procedure TServiceWorker.CaptureScreen;
var
  DC: HDC;
  W, H: Integer;
  UseFallback: Boolean;
begin
  try
    System.TMonitor.Enter(FLock);
    try
      W := FCaptureRect.Right - FCaptureRect.Left;
      H := FCaptureRect.Bottom - FCaptureRect.Top;
    finally
      System.TMonitor.Exit(FLock);
    end;

    if (W = 0) or (H = 0) then begin W := 1920; H := 1080; end;
    
    // Manage Bitmap Size
    if (FBmp.Width <> W) or (FBmp.Height <> H) then
    begin
       try
         FBmp.Free;
         FBmp := Vcl.Graphics.TBitmap.Create;
         FBmp.PixelFormat := pf24bit;
         FBmp.HandleType := bmDIB;
         FBmp.SetSize(W, H);
       except
         on E: Exception do
         begin
            LogToFile('Error Recreating Bitmap: ' + E.Message);
            UseFallback := True;
         end;
       end;
    end;
    
    // Only attempt capture if Bitmap is valid
    if (not UseFallback) then
    begin
        DC := GetDC(0);
        try
          if (DC <> 0) then
          begin
            if not BitBlt(FBmp.Canvas.Handle, 0, 0, W, H, DC, FCaptureRect.Left, FCaptureRect.Top, SRCCOPY) then
              UseFallback := True;
          end
          else
            UseFallback := True;
        finally
          if DC <> 0 then ReleaseDC(0, DC);
        end;
    end;

    // Handle Fallback (Black Screen)
    if UseFallback then
    begin
      FBmp.Canvas.Brush.Color := $000000;
      FBmp.Canvas.FillRect(Rect(0, 0, FBmp.Width, FBmp.Height));
      FBmp.Canvas.Font.Color := clWhite;
      FBmp.Canvas.Font.Size := 14;
      FBmp.Canvas.TextOut(20, 20, 'Capture Error: Out of resources or Desktop Locked');
    end;

    // Compress to JPEG
    try
      TempStream.Clear;
      FJpg.Assign(FBmp);
      FJpg.SaveToStream(TempStream);
    except
       on E: Exception do 
       begin
         LogToFile('JPEG Error: ' + E.Message);
         Exit; 
       end;
    end;
    
    // Update Shared Buffer
    System.TMonitor.Enter(FLock);
    try
      FLastCapture.Clear;
      TempStream.Position := 0;
      FLastCapture.CopyFrom(TempStream, TempStream.Size);
      
      // Log capture size and status
      if (FLastCapture.Size < 1000) then
         LogToFile(Format('WARNING: CaptureScreen generated suspiciously small frame: %d bytes (Fallback=%s)', [FLastCapture.Size, BoolToStr(UseFallback, True)]));

      // DEBUG: Dump first frame to check for corruption
      if (FLastCapture.Size > 1000) and (not TFile.Exists(TPath.Combine(TPath.GetTempPath, 'debug_frame.jpg'))) then
      begin
         FLastCapture.SaveToFile(TPath.Combine(TPath.GetTempPath, 'debug_frame.jpg'));
         LogToFile('DEBUG: Saved valid first frame to ' + TPath.Combine(TPath.GetTempPath, 'debug_frame.jpg'));
      end;
      
      // Differential Capture: Detect dirty blocks (Phase 1 - Logging Only)
      if FUseDifferentialCapture and (not UseFallback) then
      begin
        var BlockX, BlockY, DirtyCount, TotalBlocks: Integer;
        DirtyCount := 0;
        TotalBlocks := 0;
        
        BlockY := 0;
        while BlockY < H do
        begin
          BlockX := 0;
          while BlockX < W do
          begin
            Inc(TotalBlocks);
            if IsBlockDirty(BlockX, BlockY) then
              Inc(DirtyCount);
            Inc(BlockX, FBlockSize);
          end;
          Inc(BlockY, FBlockSize);
        end;
        
        // Log statistics every 5 seconds
        if (GetTickCount mod 5000) < 50 then
          LogToFile(Format('[Differential] Dirty blocks: %d/%d (%.1f%%)', 
            [DirtyCount, TotalBlocks, (DirtyCount / TotalBlocks) * 100]));
        
        // Store current frame as previous for next comparison
        if FPreviousFrame = nil then
        begin
          FPreviousFrame := Vcl.Graphics.TBitmap.Create;
          FPreviousFrame.PixelFormat := pf24bit;
          FPreviousFrame.SetSize(W, H);
        end
        else if (FPreviousFrame.Width <> W) or (FPreviousFrame.Height <> H) then
          FPreviousFrame.SetSize(W, H);
          
        FPreviousFrame.Canvas.Draw(0, 0, FBmp);
      end;

      // Log regular progress
      if (GetTickCount mod 10000) < 50 then 
        LogToFile('CaptureScreen: Running. Current Frame size=' + IntToStr(FLastCapture.Size) + ' bytes');
    finally
      System.TMonitor.Exit(FLock);
    end;
    
  except
    on E: Exception do
       LogToFile('CaptureScreen Exception: ' + E.Message);
  end;
end;

procedure TServiceWorker.OnCommandGet(AContext: TIdContext; ARequestInfo: TIdHTTPRequestInfo; AResponseInfo: TIdHTTPResponseInfo);
const
  BOUNDARY = 'frame_boundary';
  CRLF = #13#10;
var
  LocalCapture: TMemoryStream;
  FrameCount: Integer;
  Header: string;
  I: Integer;
  JSON: string;
  LocalMonitorList: TList;
  R: PRect;
begin
  LogToFile('Accessing ' + ARequestInfo.Document + ' (' + ARequestInfo.Command + ')');
  FrameCount := 0;
  
  // Handle CORS Preflight
  if ARequestInfo.Command = 'OPTIONS' then
  begin
    AResponseInfo.CustomHeaders.AddValue('Access-Control-Allow-Origin', '*');
    AResponseInfo.CustomHeaders.AddValue('Access-Control-Allow-Methods', 'GET, OPTIONS');
    AResponseInfo.CustomHeaders.AddValue('Access-Control-Allow-Headers', 'Content-Type');
    AResponseInfo.ResponseNo := 204; // No Content
    Exit;
  end;

  if ARequestInfo.Document = '/stream.mjpeg' then
  begin
    // Handle Monitor Selection Parameter
    if ARequestInfo.Params.IndexOfName('monitor') <> -1 then
    begin
       I := StrToIntDef(ARequestInfo.Params.Values['monitor'], 0);
       System.TMonitor.Enter(FLock);
       try
         if FMonitorIndex <> I then UpdateCaptureArea(I);
       finally
         System.TMonitor.Exit(FLock);
       end;
    end;

    // MJPEG Stream support
    AResponseInfo.CustomHeaders.AddValue('Access-Control-Allow-Origin', '*');
    AResponseInfo.ContentType := 'multipart/x-mixed-replace;boundary=' + BOUNDARY;
    LogToFile('Stream Phase: Starting Loop for ' + ARequestInfo.Document);
    
    // Manual Handshake to avoid Indy's default Content-Length
    try
      AContext.Connection.IOHandler.Write('HTTP/1.1 200 OK' + CRLF);
      AContext.Connection.IOHandler.Write('Content-Type: multipart/x-mixed-replace;boundary=' + BOUNDARY + CRLF);
      AContext.Connection.IOHandler.Write('Cache-Control: no-cache, no-store, must-revalidate, max-age=0' + CRLF);
      AContext.Connection.IOHandler.Write('Access-Control-Allow-Origin: *' + CRLF);
      AContext.Connection.IOHandler.Write('Connection: keep-alive' + CRLF);
      AContext.Connection.IOHandler.Write('X-Content-Type-Options: nosniff' + CRLF);
      AContext.Connection.IOHandler.Write(CRLF);
    except
      on E: Exception do
      begin
        LogToFile('Stream Phase: Error Writing Manual Headers: ' + E.Message);
        Exit;
      end;
    end;
    
    // Local buffer to avoid holding lock during network Send
    LocalCapture := TMemoryStream.Create;
    try
      LogToFile('Stream Phase: Headers Written. Entering Loop (Ignoring Connected state).');
      try
        while not Terminated do
        begin
          // 1. Copy Frame safely
          try
            System.TMonitor.Enter(FLock);
            try
              if FLastCapture.Size > 0 then
              begin
                LocalCapture.Clear;
                FLastCapture.Position := 0;
                LocalCapture.CopyFrom(FLastCapture, FLastCapture.Size);
              end;
            finally
              System.TMonitor.Exit(FLock);
            end;
          except
             on E: Exception do
             begin
               LogToFile('Stream Loop: Lock Error: ' + E.Message);
               Break;
             end;
          end;

          // 2. Send Frame (if valid)
          if LocalCapture.Size > 0 then
          begin
             try
               if FrameCount = 0 then LogToFile('Stream: Sending First Frame...');
               
               // Standard MJPEG Frame Format:
               // --boundary
               // Content-Type: image/jpeg
               // Content-Length: <size>
               // <blank line>
               // <data>
               // <blank line>
               
               // <blank line>

               Header := '--' + BOUNDARY + CRLF +
                         'Content-Type: image/jpeg' + CRLF +
                         'Content-Length: ' + IntToStr(LocalCapture.Size) + CRLF +
                         CRLF;

               AContext.Connection.IOHandler.Write(Header);
               
               LocalCapture.Position := 0;
               AContext.Connection.IOHandler.Write(LocalCapture);
               
               // End of Part
               AContext.Connection.IOHandler.Write(CRLF);
               
               // Critical: Flush to ensure browser renders immediately
               AContext.Connection.IOHandler.WriteBufferFlush; 


               
               Inc(FrameCount);
               if FrameCount = 1 then LogToFile('Stream: First Frame Sent Successfully!');
               
               if (FrameCount mod 30) = 0 then 
                  LogToFile('Stream: Sent ' + IntToStr(FrameCount) + ' frames');
             except
               on E: Exception do
               begin
                 LogToFile('Stream Loop Error (IO): ' + E.Message);
                 Break; 
               end;
             end;
          end
          else
          begin
             if (FrameCount = 0) then 
             begin
               LogToFile('Stream Loop: Waiting for first frame capture...');
               Sleep(100); 
             end;
          end;

           // Throttle to maximize FPS (10ms ~ 100fps theoretical max, limited by bandwidth/encoding)
           Sleep(10);
         end;
       finally
         LogToFile('Stream Phase: Loop Ended. Connected=' + BoolToStr(AContext.Connection.Connected, True));
       end;
     finally
       LocalCapture.Free;
     end;
  end
  else if ARequestInfo.Document = '/stream.blocks' then
  begin
    // Differential Block Stream (Phase 2)
    LogToFile('[BlockStream] Client connected for differential stream');
    
    // Handle Monitor Selection Parameter
    if ARequestInfo.Params.IndexOfName('monitor') <> -1 then
    begin
       I := StrToIntDef(ARequestInfo.Params.Values['monitor'], 0);
       System.TMonitor.Enter(FLock);
       try
         if FMonitorIndex <> I then UpdateCaptureArea(I);
       finally
         System.TMonitor.Exit(FLock);
       end;
    end;

    // Binary stream response
    AResponseInfo.CustomHeaders.AddValue('Access-Control-Allow-Origin', '*');
    AResponseInfo.ContentType := 'application/octet-stream';
    AResponseInfo.CustomHeaders.AddValue('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    
    try
      // Manual response headers
      AContext.Connection.IOHandler.Write('HTTP/1.1 200 OK' + CRLF);
      AContext.Connection.IOHandler.Write('Content-Type: application/octet-stream' + CRLF);
      AContext.Connection.IOHandler.Write('Cache-Control: no-cache, no-store, must-revalidate, max-age=0' + CRLF);
      AContext.Connection.IOHandler.Write('Access-Control-Allow-Origin: *' + CRLF);
      AContext.Connection.IOHandler.Write('Connection: keep-alive' + CRLF);
      AContext.Connection.IOHandler.Write(CRLF);
      
      LocalCapture := TMemoryStream.Create;
      try
        while not Terminated do
        begin
          // Build frame with dirty blocks
          var DirtyBlocks: array of TPoint;
          var BlockX, BlockY, DirtyCount, W, H: Integer;
          
          System.TMonitor.Enter(FLock);
          try
            W := FBmp.Width;
            H := FBmp.Height;
          finally
            System.TMonitor.Exit(FLock);
          end;
          
          // Collect dirty block coordinates
          SetLength(DirtyBlocks, 0);
          DirtyCount := 0;
          
          BlockY := 0;
          while BlockY < H do
          begin
            BlockX := 0;
            while BlockX < W do
            begin
              if IsBlockDirty(BlockX, BlockY) then
              begin
                SetLength(DirtyBlocks, DirtyCount + 1);
                DirtyBlocks[DirtyCount].X := BlockX;
                DirtyBlocks[DirtyCount].Y := BlockY;
                Inc(DirtyCount);
              end;
              Inc(BlockX, FBlockSize);
            end;
            Inc(BlockY, FBlockSize);
          end;
          
          // Only send if there are dirty blocks
          if DirtyCount > 0 then
          begin
            var Frame: TBlockFrame;
            System.TMonitor.Enter(FLock);
            try
              Frame := FBlockEncoder.BuildFrame(FFrameNumber, DirtyBlocks, FBmp);
              Inc(FFrameNumber);
            finally
              System.TMonitor.Exit(FLock);
            end;
            
            LocalCapture.Clear;
            FBlockEncoder.WriteFrameToStream(Frame, LocalCapture);
            
            LocalCapture.Position := 0;
            AContext.Connection.IOHandler.Write(LocalCapture);
            AContext.Connection.IOHandler.WriteBufferFlush;
            
            if (FFrameNumber mod 30) = 0 then
              LogToFile(Format('[BlockStream] Sent frame #%d with %d blocks (%d bytes)', 
                [FFrameNumber, DirtyCount, LocalCapture.Size]));
          end;
          
          Sleep(16); // ~60 FPS
        end;
      finally
        LocalCapture.Free;
        LogToFile('[BlockStream] Stream ended');
      end;
    except
      on E: Exception do
        LogToFile('[BlockStream] Error: ' + E.Message);
    end;
  end
  else if ARequestInfo.Document = '/monitors.json' then
  begin
    AResponseInfo.CustomHeaders.AddValue('Access-Control-Allow-Origin', '*');
    AResponseInfo.ContentType := 'application/json';
    
    LocalMonitorList := TList.Create;
    try
      EnumDisplayMonitors(0, nil, @MonitorEnumProc, LPARAM(Pointer(LocalMonitorList)));
      
      JSON := '[';
      
      // Add Individual Monitors
      for I := 0 to LocalMonitorList.Count - 1 do
      begin
        R := PRect(LocalMonitorList[I]);
        if I > 0 then JSON := JSON + ', '; // Add comma for subsequent items
        JSON := JSON + Format('{"id": %d, "name": "Monitor %d", "width": %d, "height": %d}', 
          [I, I + 1, R.Right - R.Left, R.Bottom - R.Top]);
      end;
      JSON := JSON + ']';
      
      AResponseInfo.ContentText := JSON;
    finally
      for I := 0 to LocalMonitorList.Count - 1 do Dispose(PRect(LocalMonitorList[I]));
      LocalMonitorList.Free;
    end;
  end
  else if ARequestInfo.Document = '/screen.jpg' then
  begin
    OutputDebugString('MireDeskAgent: Accessing /screen.jpg');
    AResponseInfo.CustomHeaders.AddValue('Access-Control-Allow-Origin', '*');
    AResponseInfo.ContentType := 'image/jpeg';
    AResponseInfo.CacheControl := 'no-cache'; 
    
    System.TMonitor.Enter(FLock);
    try
      FLastCapture.Position := 0;
      AResponseInfo.ContentStream := TMemoryStream.Create;
      AResponseInfo.ContentStream.CopyFrom(FLastCapture, FLastCapture.Size);
      AResponseInfo.ContentStream.Position := 0; 
      AResponseInfo.ContentLength := AResponseInfo.ContentStream.Size;
      
      OutputDebugString(PChar(Format('MireDeskAgent: Served /screen.jpg, size=%d bytes', [AResponseInfo.ContentLength])));
    finally
      System.TMonitor.Exit(FLock);
    end;
  end
  else
  begin
    System.TMonitor.Enter(FLock);
    try
       AResponseInfo.ContentText := Format('MireDesk Agent Active. Last Frame: %d bytes. Time: %s', 
         [FLastCapture.Size, DateTimeToStr(Now)]);
    finally
      System.TMonitor.Exit(FLock);
    end;
  end;
end;

initialization
  GLogLock := TCriticalSection.Create;

finalization
  GLogLock.Free;

end.
