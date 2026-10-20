$ErrorActionPreference = 'Stop'
$root = $env:ROWEREM_ROOT
if (-not $root) { $root = $PSScriptRoot }
$root = [IO.Path]::GetFullPath($root)
$appId = 'rowerem-planer-v2'
$port = if ($env:ROWEREM_TEST_PORT) { [int]$env:ROWEREM_TEST_PORT } else { 8765 }
$origin = "http://127.0.0.1:$port"
$token = [Guid]::NewGuid().ToString('N') + [Guid]::NewGuid().ToString('N')
$hash = [Security.Cryptography.SHA256]::Create()
$rootId = [BitConverter]::ToString($hash.ComputeHash([Text.Encoding]::UTF8.GetBytes($root.ToLowerInvariant()))).Replace('-','')
$hash.Dispose()
$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,$port)
$listener.Start()
$running = $true
try {
 while ($running) {
  $client = $listener.AcceptTcpClient()
  try {
   $client.ReceiveTimeout=5000; $client.SendTimeout=5000
   $stream=$client.GetStream()
   $reader=[IO.StreamReader]::new($stream,[Text.Encoding]::UTF8,$false,4096,$true)
   $request=$reader.ReadLine(); $headers=@{}
   for($n=0;$n -lt 100;$n++){
    $line=$reader.ReadLine(); if([string]::IsNullOrEmpty($line)){break}
    $at=$line.IndexOf(':');if($at -gt 0){$headers[$line.Substring(0,$at).Trim().ToLowerInvariant()]=$line.Substring($at+1).Trim()}
   }
   $parts=if($request){$request -split ' '}else{@()}
   $method=if($parts.Length -ge 2){$parts[0]}else{''}
   $url=if($parts.Length -ge 2){($parts[1] -split '\?')[0]}else{''}
   $status='404 Not Found';$type='text/plain; charset=utf-8';$body=[Text.Encoding]::UTF8.GetBytes('Not found')
   $validHost=$headers['host'] -eq "127.0.0.1:$port"
   if($validHost -and $method -eq 'GET' -and $url -eq '/api/health'){
    $status='200 OK';$type='application/json; charset=utf-8'
    $body=[Text.Encoding]::UTF8.GetBytes((@{app=$appId;version=2;rootId=$rootId;pid=$PID}|ConvertTo-Json -Compress))
   }elseif($validHost -and $method -eq 'POST' -and $url -eq '/api/shutdown'){
    $status='403 Forbidden';$length=0
    if($headers['content-length'] -match '^\d{1,4}$'){$length=[int]$headers['content-length']}
    if($headers['origin'] -eq $origin -and $length -gt 0 -and $length -le 1024){
     $buffer=New-Object char[] $length;$received=0
     while($received -lt $length){$count=$reader.Read($buffer,$received,$length-$received);if($count -le 0){break};$received+=$count}
     $payload=(-join $buffer)|ConvertFrom-Json
     if($payload.token -ceq $token){$status='200 OK';$type='application/json; charset=utf-8';$body=[Text.Encoding]::UTF8.GetBytes('{"stopped":true}');$running=$false}
    }
   }elseif($validHost -and $method -eq 'GET'){
    $allowed=@{'/'='planer.html';'/planer.html'='planer.html';'/assets/leaflet.js'='assets/leaflet.js';'/assets/leaflet.css'='assets/leaflet.css';'/assets/planner-core.js'='assets/planner-core.js';'/assets/app.js'='assets/app.js';'/assets/planner-features.js'='assets/planner-features.js';'/assets/planner.css'='assets/planner.css'}
    if($allowed.ContainsKey($url)){
     $file=Join-Path $root $allowed[$url]
     if(Test-Path -LiteralPath $file -PathType Leaf){
      $status='200 OK';$extension=[IO.Path]::GetExtension($file)
      $type=switch($extension){'.html'{'text/html; charset=utf-8'}'.css'{'text/css; charset=utf-8'}'.js'{'text/javascript; charset=utf-8'}default{'application/octet-stream'}}
      if($extension -eq '.html'){
       $html=[IO.File]::ReadAllText($file).Replace('</head>',"<meta name=`"planner-shutdown-token`" content=`"$token`"></head>")
       $body=[Text.Encoding]::UTF8.GetBytes($html)
      }else{$body=[IO.File]::ReadAllBytes($file)}
     }
    }
   }
   $head="HTTP/1.1 $status`r`nContent-Type: $type`r`nContent-Length: $($body.Length)`r`nCache-Control: no-store`r`nConnection: close`r`nReferrer-Policy: strict-origin-when-cross-origin`r`nX-Content-Type-Options: nosniff`r`n`r`n"
   $bytes=[Text.Encoding]::ASCII.GetBytes($head);$stream.Write($bytes,0,$bytes.Length);$stream.Write($body,0,$body.Length);$stream.Flush();$reader.Dispose()
  }catch{
   # A disconnected browser must not stop the server.
  }finally{$client.Close()}
 }
}finally{$listener.Stop()}
