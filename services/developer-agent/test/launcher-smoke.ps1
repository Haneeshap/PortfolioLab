param([string]$LauncherPath, [int]$Port)
$ErrorActionPreference = 'Stop'
$global:studioSmokechoice = 0
$global:studioSmokeopens = 0
$global:studioSmokecredentials = @()
$global:studioSmokewebSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$global:studioSmokecsrf = ''
$global:studioSmokefixturePat = 'github_pat_launcher_test_fixture'

function global:Start-Process {
  param([string]$FilePath, [string]$WindowStyle)
  $uri = [uri]$FilePath
  if ($uri.AbsolutePath -ne '/developer' -or $uri.Query) { throw 'Launcher must use only a fragment for bootstrap.' }
  $credential = $uri.Fragment.Substring('#bootstrap='.Length)
  if ($credential -notmatch '^[a-f0-9]{64}$' -or $global:studioSmokecredentials -contains $credential) { throw 'Bootstrap was not fresh and cryptographically sized.' }
  $global:studioSmokecredentials += $credential
  $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$Port/studio/bootstrap" -Method Post -ContentType 'application/json' -Headers @{ Origin = 'http://localhost:3000' } -Body (ConvertTo-Json @{ credential = $credential }) -WebSession $global:studioSmokewebSession
  $data = ConvertFrom-Json $response.Content
  if (-not $data.csrf -or -not $data.expiresAt) { throw 'Bootstrap did not establish a session.' }
  $global:studioSmokecsrf = $data.csrf
  $global:studioSmokeopens++
}

function global:Read-Host {
  param([string]$Prompt, [switch]$AsSecureString)
  if ($AsSecureString) {
    if ($Prompt -notlike '*GitHub PAT*') { throw 'Launcher requested an obsolete local password.' }
    return ConvertTo-SecureString $global:studioSmokefixturePat -AsPlainText -Force
  }
  switch ($global:studioSmokechoice++) {
    0 { return 'G' }
    1 {
      $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$Port/studio/repos" -Method Post -ContentType 'application/json' -Headers @{ Origin = 'http://localhost:3000'; 'X-Studio-CSRF' = $global:studioSmokecsrf } -Body '{}' -WebSession $global:studioSmokewebSession
      if (-not (ConvertFrom-Json $response.Content).githubConnected -or $response.Content.Contains($global:studioSmokefixturePat)) { throw 'GitHub connection did not remain server-side.' }
      return 'R'
    }
    default {
      if ($global:studioSmokeopens -ne 2) { throw 'Reconnect did not open a fresh bootstrap.' }
      return 'Q'
    }
  }
}

& $LauncherPath -Port $Port
if ($global:studioSmokeopens -ne 2 -or $global:studioSmokechoice -ne 3) { throw 'Launcher flow did not complete.' }
Write-Output 'LAUNCHER_SMOKE_OK'
