library insthelper;

{ Important note about DLL memory management: ShareMem must be the
  first unit in your library's USES clause AND your project's (select
  Project-View Source) USES clause if your DLL exports any procedures or
  functions that pass strings as parameters or function results. This
  applies to all strings passed to and from your DLL--even those that
  are nested in records and classes. ShareMem is the interface unit to
  the BORLNDMM.DLL shared memory manager, which must be deployed along
  with your DLL. To avoid using BORLNDMM.DLL, pass string information
  using PChar or ShortString parameters. }



uses
  SysUtils,
  Classes,
  RegistryKeys in '..\..\..\global\delphi\general\RegistryKeys.pas',
  klog in '..\..\..\global\delphi\general\klog.pas',
  CRC32 in '..\..\..\global\delphi\general\CRC32.pas',
  VersionInfo in '..\..\..\global\delphi\general\VersionInfo.pas',
  GetOsVersion in '..\..\..\global\delphi\general\GetOsVersion.pas',
  OnlineConstants in '..\..\..\global\delphi\productactivation\OnlineConstants.pas',
  KeymanVersion in '..\..\..\global\delphi\general\KeymanVersion.pas',
  preuninstallunit in 'preuninstallunit.pas',
  input_installlayoutortip in '..\..\..\global\delphi\winapi\input_installlayoutortip.pas',
  utiltsf in '..\..\..\global\delphi\general\utiltsf.pas',
  keyman_msctf in '..\..\..\global\delphi\winapi\keyman_msctf.pas',
  Keyman.System.Install.EnginePostInstall in 'Keyman.System.Install.EnginePostInstall.pas',
  Keyman.System.Security in '..\..\..\global\delphi\general\Keyman.System.Security.pas',
  Keyman.Winapi.VersionHelpers in '..\..\..\global\delphi\winapi\Keyman.Winapi.VersionHelpers.pas',
  DebugPaths in '..\..\..\global\delphi\general\DebugPaths.pas',
  ErrorControlledRegistry in '..\..\..\global\delphi\vcl\ErrorControlledRegistry.pas',
  Unicode in '..\..\..\global\delphi\general\Unicode.pas',
  utilexecute in '..\..\..\global\delphi\general\utilexecute.pas',
  utilsystem in '..\..\..\global\delphi\general\utilsystem.pas',
  KeymanPaths in '..\..\..\global\delphi\general\KeymanPaths.pas';

{$R *.RES}
{$R VERSION.RES}

exports
  EnginePostInstall,
  PreUninstall;
begin
end.
