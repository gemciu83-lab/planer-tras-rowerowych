$ErrorActionPreference='Stop'
$root=$env:ROWEREM_ROOT
if(-not $root){$root=$PSScriptRoot}
$base='http://127.0.0.1:8765'
function Show-Error($message){Add-Type -AssemblyName System.Windows.Forms;[Windows.Forms.MessageBox]::Show($message,'Planer tras V2')|Out-Null}
try{
 if(-not(Test-Path -LiteralPath (Join-Path $root 'assets/app.js'))){throw 'Rozpakuj cala paczke V2, razem z folderem assets.'}
 $health=$null
 try{$health=Invoke-RestMethod "$base/api/health" -TimeoutSec 2}catch{}
 if($health -and $health.app -eq 'rowerem-planer-v2'){
  $hash=[Security.Cryptography.SHA256]::Create()
  $rootId=[BitConverter]::ToString($hash.ComputeHash([Text.Encoding]::UTF8.GetBytes([IO.Path]::GetFullPath($root).ToLowerInvariant()))).Replace('-','');$hash.Dispose()
  if($rootId -eq $health.rootId){Start-Process $base;exit}
  # A different V2 folder owns the port. Stop it through its authenticated endpoint.
  $oldHtml=(Invoke-WebRequest $base -UseBasicParsing -TimeoutSec 3).Content
  if($oldHtml -match 'name="planner-shutdown-token" content="([a-f0-9]+)"'){
   $body=@{token=$Matches[1]}|ConvertTo-Json -Compress
   Invoke-RestMethod "$base/api/shutdown" -Method Post -Headers @{Origin=$base} -ContentType 'application/json' -Body $body -TimeoutSec 3|Out-Null
  }else{throw 'Nie mozna zamknac poprzedniego serwera V2.'}
 }else{
  try{$existing=Invoke-WebRequest $base -UseBasicParsing -TimeoutSec 2}catch{$existing=$null}
  if($existing){throw 'Port 8765 jest zajety. Przy pierwszym przejsciu ze starej wersji zamknij jej serwer (lub uruchom ponownie Windows). Potem uruchom V2.'}
 }
 $code=[IO.File]::ReadAllText((Join-Path $root 'server.ps1'))
 $encoded=[Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($code))
 Start-Process -FilePath powershell.exe -WindowStyle Hidden -ArgumentList @('-NoLogo','-NoProfile','-NonInteractive','-EncodedCommand',$encoded)
 $ready=$false
 for($attempt=0;$attempt -lt 40;$attempt++){
  Start-Sleep -Milliseconds 200
  try{$check=Invoke-RestMethod "$base/api/health" -TimeoutSec 1;if($check.app -eq 'rowerem-planer-v2'){$ready=$true;break}}catch{}
 }
 if(-not $ready){throw 'Nie udalo sie uruchomic serwera. Sprawdz, czy port 8765 jest wolny.'}
 Start-Process $base
}catch{Show-Error $_.Exception.Message;exit 1}
