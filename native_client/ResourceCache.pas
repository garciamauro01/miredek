unit ResourceCache;

interface

uses
  System.SysUtils, System.Classes, System.Generics.Collections, System.Skia;

type
  TSkResourceCache = class
  private
    FSVGCache: TDictionary<string, ISkSVGDOM>;
    FImageCache: TDictionary<string, ISkImage>;
    class var FInstance: TSkResourceCache;
    constructor Create;
  public
    destructor Destroy; override;
    
    class function Instance: TSkResourceCache;
    class procedure FreeInstance;
    
    // SVG Management
    function GetSVG(const APath: string): ISkSVGDOM;
    function LoadSVG(const APath: string): ISkSVGDOM;
    procedure CacheSVG(const AKey: string; const ASVG: ISkSVGDOM);
    
    // Image Management
    function GetImage(const APath: string): ISkImage;
    function LoadImage(const APath: string): ISkImage;
    procedure CacheImage(const AKey: string; const AImage: ISkImage);
    
    // Cache Management
    procedure Clear;
    function GetCacheSize: Integer;
  end;

implementation

uses
  System.IOUtils;

{ TSkResourceCache }

constructor TSkResourceCache.Create;
begin
  inherited;
  FSVGCache := TDictionary<string, ISkSVGDOM>.Create;
  FImageCache := TDictionary<string, ISkImage>.Create;
end;

destructor TSkResourceCache.Destroy;
begin
  FSVGCache.Free;
  FImageCache.Free;
  inherited;
end;

class function TSkResourceCache.Instance: TSkResourceCache;
begin
  if not Assigned(FInstance) then
    FInstance := TSkResourceCache.Create;
  Result := FInstance;
end;

class procedure TSkResourceCache.FreeInstance;
begin
  if Assigned(FInstance) then
  begin
    FInstance.Free;
    FInstance := nil;
  end;
end;

function TSkResourceCache.GetSVG(const APath: string): ISkSVGDOM;
begin
  if not FSVGCache.TryGetValue(APath, Result) then
  begin
    Result := LoadSVG(APath);
    if Assigned(Result) then
      FSVGCache.Add(APath, Result);
  end;
end;

function TSkResourceCache.LoadSVG(const APath: string): ISkSVGDOM;
var
  LStream: TStringStream;
begin
  Result := nil;
  if not TFile.Exists(APath) then Exit;
  
  try
    LStream := TStringStream.Create('', TEncoding.UTF8);
    try
      LStream.LoadFromFile(APath);
      Result := TSkSVGDOM.Make(LStream.DataString);
    finally
      LStream.Free;
    end;
  except
    Result := nil;
  end;
end;

procedure TSkResourceCache.CacheSVG(const AKey: string; const ASVG: ISkSVGDOM);
begin
  if not FSVGCache.ContainsKey(AKey) then
    FSVGCache.Add(AKey, ASVG);
end;

function TSkResourceCache.GetImage(const APath: string): ISkImage;
begin
  if not FImageCache.TryGetValue(APath, Result) then
  begin
    Result := LoadImage(APath);
    if Assigned(Result) then
      FImageCache.Add(APath, Result);
  end;
end;

function TSkResourceCache.LoadImage(const APath: string): ISkImage;
begin
  Result := nil;
  if not TFile.Exists(APath) then Exit;
  
  try
    Result := TSkImage.MakeFromEncodedFile(APath);
  except
    Result := nil;
  end;
end;

procedure TSkResourceCache.CacheImage(const AKey: string; const AImage: ISkImage);
begin
  if not FImageCache.ContainsKey(AKey) then
    FImageCache.Add(AKey, AImage);
end;

procedure TSkResourceCache.Clear;
begin
  FSVGCache.Clear;
  FImageCache.Clear;
end;

function TSkResourceCache.GetCacheSize: Integer;
begin
  Result := FSVGCache.Count + FImageCache.Count;
end;

initialization

finalization
  TSkResourceCache.FreeInstance;

end.
