#!/usr/bin/env pwsh
$reqFile = "C:\Users\hanee\projects2026\PortfolioLab\backend-python\requirements.txt"
$lines = Get-Content $reqFile
foreach ($l in $lines) {
    $l = $l.Trim()
    if ($l -eq '' -or $l.StartsWith('#')) { continue }
    $name = $l.Split('=')[0].Split('[')[0].Trim()
    $out = & py -c "import $name" 2>&1
    $code = $LASTEXITCODE
    if ($code -eq 0) {
        Write-Host "OK      $l"
    } else {
        Write-Host "MISSING $l"
    }
}













