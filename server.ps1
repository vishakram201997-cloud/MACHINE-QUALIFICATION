$lastRunTime = 0
$dataVersion = (Get-Date).Ticks.ToString()

function Check-And-Sync-Data {
    $dataFile = "d:\Anti gravity project 1\data.js"
    if (Test-Path $dataFile) {
        $writeTime = (Get-Item $dataFile).LastWriteTime.Ticks
        if ($writeTime -gt $script:lastRunTime) {
            $script:lastRunTime = $writeTime
            $script:dataVersion = $writeTime.ToString()
            Write-Host "New data.js detected. Version updated to: $script:dataVersion"
        }
    }
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:8000/")
try {
    $listener.Start()
    Write-Host "Listening on http://127.0.0.1:8000/ ..."
    while ($listener.IsListening) {
        $context = $null
        $response = $null
        try {
            $context = $listener.GetContext()
            $request = $context.Request
            $response = $context.Response
            
            $urlPath = $request.Url.LocalPath
            if ($urlPath -eq "/") { 
                $urlPath = "/index.html" 
            }
            
            if ($urlPath -eq "/api/version") {
                Check-And-Sync-Data
                $response.ContentType = "application/json"
                $response.Headers.Add("Cache-Control", "no-cache")
                $response.Headers.Add("Access-Control-Allow-Origin", "*")
                $response.Headers.Add("Access-Control-Allow-Headers", "*")
                $response.Headers.Add("Access-Control-Allow-Methods", "GET, OPTIONS, HEAD")
                
                if ($request.HttpMethod -eq "OPTIONS") {
                    $response.StatusCode = 200
                    $response.Close()
                    continue
                }
                
                $respBytes = [System.Text.Encoding]::UTF8.GetBytes("{`"version`":`"$script:dataVersion`"}")
                $response.ContentLength64 = $respBytes.Length
                if ($request.HttpMethod -ne "HEAD") {
                    $response.OutputStream.Write($respBytes, 0, $respBytes.Length)
                }
                $response.Close()
                continue
            }
            
            $filePath = "d:\Anti gravity project 1" + $urlPath.Replace("/", "\")
            
            if (Test-Path $filePath -PathType Leaf) {
                $bytes = [System.IO.File]::ReadAllBytes($filePath)
                $response.ContentLength64 = $bytes.Length
                
                # Set basic Content-Type headers
                if ($filePath.EndsWith(".html")) { 
                    $response.ContentType = "text/html" 
                } elseif ($filePath.EndsWith(".css")) { 
                    $response.ContentType = "text/css" 
                } elseif ($filePath.EndsWith(".js")) { 
                    $response.ContentType = "application/javascript" 
                } elseif ($filePath.EndsWith(".json")) {
                    $response.ContentType = "application/json"
                }
                
                if ($request.HttpMethod -ne "HEAD") {
                    $response.OutputStream.Write($bytes, 0, $bytes.Length)
                }
            } else {
                $response.StatusCode = 404
                $errBytes = [System.Text.Encoding]::UTF8.GetBytes("File Not Found")
                $response.ContentLength64 = $errBytes.Length
                if ($request.HttpMethod -ne "HEAD") {
                    $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
                }
            }
            $response.Close()
        } catch {
            Write-Host "Error handling request: $_"
            if ($null -ne $response) {
                try {
                    $response.Close()
                } catch {
                    # Ignore errors during close
                }
            }
        }
    }
} catch {
    Write-Host "Server startup error: $_"
} finally {
    $listener.Close()
}
