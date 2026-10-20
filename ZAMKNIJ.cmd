@echo off
setlocal
set "ROWEREM_ROOT=%~dp0"
powershell.exe -NoLogo -NoProfile -Command "& ([scriptblock]::Create([IO.File]::ReadAllText((Join-Path $env:ROWEREM_ROOT 'stop.ps1'))))"
endlocal
exit /b
