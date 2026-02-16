unit BlockProtocol;

interface

uses
  System.SysUtils, System.Classes, System.Types, System.Math, Vcl.Graphics, Vcl.Imaging.jpeg;

type
  // Block information for differential transmission
  TBlockInfo = record
    X, Y: Word;           // Block coordinates (in blocks, not pixels)
    DataSize: Cardinal;   // Size of compressed block data
    Data: TBytes;         // JPEG-compressed block data
  end;

  TBlockFrame = record
    FrameNumber: Cardinal;
    BlockCount: Word;
    Flags: Word;          // bit 0: full frame, bit 1: cursor update
    Blocks: array of TBlockInfo;
  end;

  TBlockProtocolEncoder = class
  private
    FBlockSize: Integer;
    FJpegQuality: Integer;
  public
    constructor Create(ABlockSize: Integer = 64; AJpegQuality: Integer = 70);
    
    // Encode a single block to JPEG
    function EncodeBlock(ASourceBitmap: TBitmap; X, Y: Integer): TBytes;
    
    // Build a frame with only dirty blocks
    function BuildFrame(AFrameNumber: Cardinal; const ADirtyBlocks: array of TPoint; 
                       ASourceBitmap: TBitmap): TBlockFrame;
    
    // Serialize frame to binary stream
    procedure WriteFrameToStream(const AFrame: TBlockFrame; AStream: TStream);
  end;

implementation

{ TBlockProtocolEncoder }

constructor TBlockProtocolEncoder.Create(ABlockSize: Integer; AJpegQuality: Integer);
begin
  FBlockSize := ABlockSize;
  FJpegQuality := AJpegQuality;
end;

function TBlockProtocolEncoder.EncodeBlock(ASourceBitmap: TBitmap; X, Y: Integer): TBytes;
var
  BlockBmp: TBitmap;
  Jpg: TJPEGImage;
  Stream: TMemoryStream;
  W, H: Integer;
begin
  // Calculate block dimensions (handle edge blocks)
  W := Min(FBlockSize, ASourceBitmap.Width - X);
  H := Min(FBlockSize, ASourceBitmap.Height - Y);
  
  // Create temporary bitmap for this block
  BlockBmp := TBitmap.Create;
  try
    BlockBmp.PixelFormat := pf24bit;
    BlockBmp.SetSize(W, H);
    
    // Copy block region from source
    BlockBmp.Canvas.CopyRect(Rect(0, 0, W, H), 
                             ASourceBitmap.Canvas, 
                             Rect(X, Y, X + W, Y + H));
    
    // Compress to JPEG
    Jpg := TJPEGImage.Create;
    try
      Jpg.CompressionQuality := FJpegQuality;
      Jpg.Performance := jpBestSpeed;
      Jpg.Assign(BlockBmp);
      
      Stream := TMemoryStream.Create;
      try
        Jpg.SaveToStream(Stream);
        SetLength(Result, Stream.Size);
        Stream.Position := 0;
        Stream.ReadBuffer(Result[0], Stream.Size);
      finally
        Stream.Free;
      end;
    finally
      Jpg.Free;
    end;
  finally
    BlockBmp.Free;
  end;
end;

function TBlockProtocolEncoder.BuildFrame(AFrameNumber: Cardinal; 
  const ADirtyBlocks: array of TPoint; ASourceBitmap: TBitmap): TBlockFrame;
var
  I: Integer;
begin
  Result.FrameNumber := AFrameNumber;
  Result.BlockCount := Length(ADirtyBlocks);
  Result.Flags := 0;
  
  SetLength(Result.Blocks, Result.BlockCount);
  
  for I := 0 to Result.BlockCount - 1 do
  begin
    Result.Blocks[I].X := ADirtyBlocks[I].X div FBlockSize;
    Result.Blocks[I].Y := ADirtyBlocks[I].Y div FBlockSize;
    Result.Blocks[I].Data := EncodeBlock(ASourceBitmap, ADirtyBlocks[I].X, ADirtyBlocks[I].Y);
    Result.Blocks[I].DataSize := Length(Result.Blocks[I].Data);
  end;
end;

procedure TBlockProtocolEncoder.WriteFrameToStream(const AFrame: TBlockFrame; AStream: TStream);
var
  Magic: AnsiString;
  I: Integer;
begin
  // Write header
  Magic := 'BLCK';
  AStream.WriteBuffer(Magic[1], 4);
  
  // Write frame info
  AStream.WriteBuffer(AFrame.FrameNumber, SizeOf(Cardinal));
  AStream.WriteBuffer(AFrame.BlockCount, SizeOf(Word));
  AStream.WriteBuffer(AFrame.Flags, SizeOf(Word));
  
  // Write each block
  for I := 0 to AFrame.BlockCount - 1 do
  begin
    AStream.WriteBuffer(AFrame.Blocks[I].X, SizeOf(Word));
    AStream.WriteBuffer(AFrame.Blocks[I].Y, SizeOf(Word));
    AStream.WriteBuffer(AFrame.Blocks[I].DataSize, SizeOf(Cardinal));
    AStream.WriteBuffer(AFrame.Blocks[I].Data[0], AFrame.Blocks[I].DataSize);
  end;
end;

end.
