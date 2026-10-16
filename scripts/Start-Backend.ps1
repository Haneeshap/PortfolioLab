# Run from any directory. Spring does not automatically load the root .env.
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $projectRoot '.env'
if (!(Test-Path -LiteralPath $envFile)) { throw 'Copy .env.example to .env and set DB_PASSWORD first.' }
$passwordLines = @(Get-Content -LiteralPath $envFile | Where-Object { $_ -match '^DB_PASSWORD=' })
if ($passwordLines.Count -ne 1) { throw 'Expected exactly one DB_PASSWORD entry in .env.' }
$localPassword = $passwordLines[0].Substring('DB_PASSWORD='.Length).Trim()
if ($localPassword -notmatch '^[A-Za-z0-9]{16,}$' -or $localPassword -eq 'replace_with_your_own_local_password') {
    throw 'Set DB_PASSWORD to a unique value of at least 16 letters/digits in .env.'
}
$previousPassword = $env:DB_PASSWORD
try {
    $env:DB_PASSWORD = $localPassword
    Push-Location (Join-Path $projectRoot 'backend')
    try {
        & .\mvnw.cmd spring-boot:run
        if ($LASTEXITCODE -ne 0) { throw "Backend exited with code $LASTEXITCODE" }
    } finally { Pop-Location }
} finally { $env:DB_PASSWORD = $previousPassword }
