param(
  [int]$Port = 5500
)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Serving site from $root at http://localhost:$Port"
Write-Host "Press Ctrl+C to stop."

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response
    $relativePath = $request.Url.LocalPath.TrimStart('/')
    if ([string]::IsNullOrWhiteSpace($relativePath)) {
      $relativePath = 'index.html'
    }
    $filePath = [System.IO.Path]::Combine($root, $relativePath -replace '/', [System.IO.Path]::DirectorySeparatorChar)

    if (-not (Test-Path $filePath)) {
      $response.StatusCode = 404
      $response.StatusDescription = 'Not Found'
      $content = [System.Text.Encoding]::UTF8.GetBytes('404 Not Found')
      $response.OutputStream.Write($content, 0, $content.Length)
      $response.Close()
      continue
    }

    $content = [System.IO.File]::ReadAllBytes($filePath)
    $extension = [System.IO.Path]::GetExtension($filePath).ToLowerInvariant()
    $response.ContentType = switch ($extension) {
      '.html' { 'text/html; charset=utf-8' }
      '.css' { 'text/css; charset=utf-8' }
      '.js' { 'application/javascript; charset=utf-8' }
      '.json' { 'application/json; charset=utf-8' }
      '.svg' { 'image/svg+xml' }
      '.png' { 'image/png' }
      '.jpg' { 'image/jpeg' }
      '.jpeg' { 'image/jpeg' }
      '.gif' { 'image/gif' }
      default { 'application/octet-stream' }
    }

    $response.ContentLength64 = $content.Length
    $response.OutputStream.Write($content, 0, $content.Length)
    $response.Close()
  }
} finally {
  $listener.Stop()
  $listener.Close()
}
