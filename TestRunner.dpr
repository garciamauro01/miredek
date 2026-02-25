program TestRunner;

{$APPTYPE CONSOLE}

uses
  System.SysUtils,
  DUnitX.Loggers.Console,
  DUnitX.TestFramework,
  TestConnectionFlow in 'native_client\TestConnectionFlow.pas';

var
  runner: ITestRunner;
  results: IRunResults;
  logger: ITestLogger;
begin
  try
    System.WriteLn('Iniciando Test Runner DUnitX...');

    //Create the runner
    runner := TDUnitX.CreateRunner;
    
    //Tell the runner to use RTTI to find Fixtures
    runner.UseRTTI := True;
    
    //tell the runner how we will log things
    //Log to the console window
    logger := TDUnitXConsoleLogger.Create(true);
    runner.AddLogger(logger);
    
    //Run tests
    results := runner.Execute;
    
    if not results.AllPassed then
      System.ExitCode := EXIT_ERRORS;

    {$IFNDEF CI}
    //We don't want this happening when running under CI.
    if TDUnitX.Options.ExitBehavior = TDUnitXExitBehavior.Pause then
    begin
      System.WriteLn('Done.. press <Enter> key to quit.');
      System.ReadLn;
    end;
    {$ENDIF}
  except
    on E: Exception do
      System.WriteLn(E.ClassName, ': ', E.Message);
  end;
end.
