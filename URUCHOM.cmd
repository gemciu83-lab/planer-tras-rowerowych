@echo off
setlocal
set "ROWEREM_ROOT=%~dp0"
powershell.exe -NoLogo -NoProfile -Command "$code = [IO.File]::ReadAllText((Join-Path $env:ROWEREM_ROOT 'launcher.ps1')); & ([scriptblock]::Create($code))"
endlocal
exit /b
