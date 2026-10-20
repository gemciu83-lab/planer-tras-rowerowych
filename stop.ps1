$ErrorActionPreference='Stop'
$base='http://127.0.0.1:8765'
try{
 $health=Invoke-RestMethod "$base/api/health" -TimeoutSec 3
 if($health.app -ne 'rowerem-planer-v2'){throw 'Pod tym adresem nie dziala serwer V2.'}
 $html=(Invoke-WebRequest $base -UseBasicParsing -TimeoutSec 3).Content
 if($html -notmatch 'name="planner-shutdown-token" content="([a-f0-9]+)"'){throw 'Nie mozna odczytac identyfikatora serwera.'}
 Invoke-RestMethod "$base/api/shutdown" -Method Post -Headers @{Origin=$base} -ContentType 'application/json' -Body (@{token=$Matches[1]}|ConvertTo-Json -Compress) -TimeoutSec 3|Out-Null
}catch{
 Add-Type -AssemblyName System.Windows.Forms
 [Windows.Forms.MessageBox]::Show('Serwer V2 nie dziala lub nie mozna go zamknac. '+$_.Exception.Message,'Planer tras V2')|Out-Null
}
