unit Styles;

interface

uses
  System.UITypes, System.UIConsts, System.Skia, Vcl.Skia;

const
  // Skia Alpha Colors (ARGB)
  // Dashboard Palette
  skBackground = $FFF1F5F9;  // Slate 100
  skSidebarBG = $E6FFFFFF;   // White with 90% opacity for glass effect
  skCardBG = $FFFFFFFF;      // White
  
  skPrimary = $FF2563EB;     // Blue 600
  skPrimaryGradient = $FF3B82F6; // Blue 500
  skAccent = $FFDBEAFE;      // Blue 100
  
  skSecondary = $FF1E293B;   // Slate 800
  skSuccess = $FF10B981;     // Emerald 500
  skDanger = $FFEF4444;      // Red 500
  skWarning = $FFF59E0B;     // Amber 500
  skInfo = $FF3B82F6;        // Blue 500
  skSidebarCardBG = $FFF0F5F9; // HopToDesk style light blue BG
  skHopBlue = $FF3B82F6;       // HopToDesk style vibrant blue
  
  skTextMain = $FF0F172A;    // Slate 900
  skTextSecondary = $FF475569; // Slate 600
  skBorder = $FFCBD5E1;      // Slate 300
  
  skSidebarWidth = 260.0;
  skShadowColor = $20000000;
  skCornerRadius = 16.0;     // Slightly more rounded
  skShadowBlur = 12.0;
  skGlassBlur = 15.0;        // Blur intensity for glassmorphism
  
  // Layout Constants
  skContentPadding = 20.0;
  skTabBarTop = 150.0;
  skTabBarHeight = 35.0;
  skTabWidth = 110.0;
  skTabGap = 10.0;
  
  skConnectBtnTop = 100.0;
  skConnectBtnHeight = 40.0;
  skConnectBtnWidth = 100.0;

implementation

end.
