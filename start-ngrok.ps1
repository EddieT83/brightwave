param(
  [string]$AuthToken
)

if (-not $AuthToken) {
  Write-Host "Usage: .\start-ngrok.ps1 -AuthToken <your-ngrok-authtoken>"
  Write-Host "Or set the NGROK_AUTHTOKEN environment variable and rerun."
  exit 1
}

ngrok config add-authtoken $AuthToken
ngrok http 5500 --log=stdout
