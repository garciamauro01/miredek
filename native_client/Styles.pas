unit Styles;

interface

uses
  System.UITypes, System.UIConsts, System.Skia, Vcl.Skia;

type
  TAppTheme = (ttLight, ttDark);

var
  // Dynamic Skia Alpha Colors (ARGB)
  skBackground: TAlphaColor;
  skSidebarBG: TAlphaColor;
  skCardBG: TAlphaColor;
  skCardSecondaryBG: TAlphaColor;
  
  skPrimary: TAlphaColor;
  skPrimaryGradient: TAlphaColor;
  skAccent: TAlphaColor;
  
  skSecondary: TAlphaColor;
  skSuccess: TAlphaColor;
  skDanger: TAlphaColor;
  skWarning: TAlphaColor;
  skSidebarCardBG: TAlphaColor;
  skHopBlue: TAlphaColor;
  
  skTextMain: TAlphaColor;
  skTextSecondary: TAlphaColor;
  skBorder: TAlphaColor;
  skShadowColor: TAlphaColor;

  skCurrentTheme: TAppTheme;

const
  skSidebarWidth = 260.0;
  skCornerRadius = 12.0;
  skShadowBlur = 12.0;
  skGlassBlur = 15.0;

procedure SetAppTheme(ATheme: TAppTheme);

implementation

procedure SetAppTheme(ATheme: TAppTheme);
begin
  skCurrentTheme := ATheme;
  
  // Brand colors (Premium Red)
  skPrimary := $FFE02424;
  skPrimaryGradient := $FFC81E1E;
  skHopBlue := $FFE02424; 
  skSuccess := $FF10B981;
  skDanger := $FFEF4444;
  skWarning := $FFF59E0B;

  if ATheme = ttDark then
  begin
    skBackground := $FF0F172A;     // Slate 950
    skSidebarBG := $FF0F172A;      // Same as background
    skCardBG := $FF1E293B;         // Slate 900
    skCardSecondaryBG := $FF334155; // Slate 800
    
    skTextMain := $FFF8FAFC;       // Slate 50
    skTextSecondary := $FF94A3B8;  // Slate 400
    skBorder := $FF334155;         // Slate 800
    skShadowColor := $60000000;
  end
  else
  begin
    skBackground := $FFF8FAFC;     // Slate 50
    skSidebarBG := $FFF1F5F9;      // Slate 100
    skCardBG := $FFFFFFFF;         // White
    skCardSecondaryBG := $FFF1F5F9; // Slate 100
    
    skTextMain := $FF0F172A;       // Slate 950
    skTextSecondary := $FF475569;  // Slate 600
    skBorder := $FFE2E8F0;         // Slate 200
    skShadowColor := $20000000;
  end;
end;

initialization
  SetAppTheme(ttDark); // Default to Dark Premium

end.
