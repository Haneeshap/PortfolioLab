param(
  [switch]$IncludeAiRepository,
  [switch]$GitHubCredential,
  [string]$OllamaModel = '',
  [int]$Port = 4317,
  [string]$FrontendOrigin = 'http://localhost:3000'
)
$ErrorActionPreference = 'Stop'
$studioRoot = Split-Path -Parent $PSScriptRoot

function New-StudioBootstrap {
  $bytes = New-Object byte[] 32
  $random = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $random.GetBytes($bytes); return ([BitConverter]::ToString($bytes)).Replace('-', '').ToLowerInvariant() }
  finally { $random.Dispose(); [Array]::Clear($bytes, 0, $bytes.Length) }
}

function Read-StudioGitHubToken {
  $secureValue = Read-Host 'Your fine-grained GitHub PAT (hidden; session memory only)' -AsSecureString
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureValue)
  try {
    $value = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    if ($value -notmatch '^github_pat_[A-Za-z0-9_]+$') { throw 'Use a fine-grained GitHub PAT beginning github_pat_. No local password is needed.' }
    return $value
  } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer); $secureValue.Dispose() }
}

function Read-StudioReply($Process) {
  $replyTask = $Process.StandardOutput.ReadLineAsync()
  if (-not $replyTask.Wait(30000)) { throw 'Agent did not become ready within 30 seconds. Check Git/repository availability.' }
  $reply = $replyTask.Result
  if (-not $reply) { throw 'Agent stopped unexpectedly. Check Node 24.12+, Git for Windows, and repository access.' }
  if ($reply.StartsWith('STUDIO_ERROR ')) { throw (ConvertFrom-Json $reply.Substring(13)) }
  return $reply
}

function Open-StudioBootstrap([string]$Credential) {
  # Fragment is never sent in an HTTP request or printed; the frontend removes it.
  $bootstrapUrl = "$FrontendOrigin/developer#bootstrap=$Credential"
  # This is the interactive browser the developer needs to see; only the agent is hidden.
  try { Start-Process -FilePath $bootstrapUrl -WindowStyle Normal | Out-Null }
  catch { throw 'Could not open the default browser. Check Windows browser associations, then press R to retry.' }
  finally { $bootstrapUrl = $null }
  Write-Host 'Opened Developer Studio with a one-time connection (valid for two minutes).'
}

$agentProcess = $null
$agentStarted = $false
$bootstrap = $null
$token = $null
try {
  $nodeCommand = Get-Command node -CommandType Application -ErrorAction SilentlyContinue
  if (-not $nodeCommand) { throw 'Node.js is missing. Install Node 24.12 or newer and reopen PowerShell.' }
  $nodeVersion = [version]((& $nodeCommand.Source --version).Trim().TrimStart('v'))
  if ($nodeVersion -lt [version]'24.12.0') { throw 'Developer Studio requires Node 24.12 or newer.' }
  $gitCommand = Get-Command git -CommandType Application -ErrorAction SilentlyContinue
  if (-not $gitCommand) { throw 'Git is missing. Install Git for Windows and reopen PowerShell.' }
  & $gitCommand.Source --version | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Git could not start. Repair your Git for Windows installation.' }
  if ($Port -le 1024 -or $Port -gt 65535) { throw 'Choose an agent port between 1025 and 65535.' }
  if ($FrontendOrigin -notmatch '^http://(localhost|127\.0\.0\.1):\d+$') { throw 'FrontendOrigin must be an exact local HTTP origin, for example http://localhost:3000.' }
  if (-not (Test-Path -LiteralPath (Join-Path $studioRoot 'frontend/node_modules/next/package.json'))) { throw 'Frontend dependencies are missing. Run npm ci from the frontend directory first.' }

  $repositories = @(@{ id = 'portfoliolab'; name = 'PortfolioLab'; path = (Resolve-Path -LiteralPath $studioRoot).Path })
  if ($IncludeAiRepository) {
    $aiPath = Join-Path (Split-Path -Parent $studioRoot) 'portfoliolab-ai'
    if (-not (Test-Path -LiteralPath $aiPath)) { throw 'The optional portfoliolab-ai directory was not found beside PortfolioLab.' }
    $repositories += @{ id = 'portfoliolab-ai'; name = 'PortfolioLab AI'; path = (Resolve-Path -LiteralPath $aiPath).Path }
  }
  $bootstrap = New-StudioBootstrap
  if ($GitHubCredential) { $token = Read-StudioGitHubToken }
  $processInfo = New-Object System.Diagnostics.ProcessStartInfo
  $processInfo.FileName = $nodeCommand.Source
  $processInfo.Arguments = '"' + (Join-Path $studioRoot 'services/developer-agent/src/server.ts') + '"'
  $processInfo.WorkingDirectory = $studioRoot
  $processInfo.UseShellExecute = $false
  $processInfo.CreateNoWindow = $true
  $processInfo.RedirectStandardInput = $true
  $processInfo.RedirectStandardOutput = $true
  $processInfo.RedirectStandardError = $true
  foreach ($key in @('STUDIO_READ_SECRET', 'STUDIO_WRITE_SECRET', 'STUDIO_GITHUB_TOKEN', 'STUDIO_BOOTSTRAP_SECRET')) { $processInfo.EnvironmentVariables.Remove($key) }
  $agentProcess = New-Object System.Diagnostics.Process
  $agentProcess.StartInfo = $processInfo
  [void]$agentProcess.Start()
  $agentStarted = $true
  $stderrTask = $agentProcess.StandardError.ReadToEndAsync()
  $agentProcess.StandardInput.WriteLine((ConvertTo-Json -Depth 5 -Compress -InputObject @{ repositories = $repositories; port = $Port; origin = $FrontendOrigin; model = $OllamaModel; credential = $bootstrap; githubToken = $token }))
  $agentProcess.StandardInput.Flush()
  $token = $null
  if ((Read-StudioReply $agentProcess) -ne 'STUDIO_READY') { throw 'Unexpected agent startup response.' }
  Write-Host "Developer agent ready on 127.0.0.1:$Port. Keep this terminal open."
  Write-Host "Frontend must be running at $FrontendOrigin (npm run dev in frontend)."
  try { Open-StudioBootstrap $bootstrap } catch { Write-Warning $_.Exception.Message }
  $bootstrap = $null

  while (-not $agentProcess.HasExited) {
    $choice = Read-Host '[R] Reconnect/open Studio  [G] Connect GitHub  [Q] Stop'
    switch ($choice.Trim().ToUpperInvariant()) {
      'R' {
        $bootstrap = New-StudioBootstrap
        $agentProcess.StandardInput.WriteLine((ConvertTo-Json -Compress @{ command = 'bootstrap'; credential = $bootstrap }))
        $agentProcess.StandardInput.Flush()
        if ((Read-StudioReply $agentProcess) -ne 'STUDIO_BOOTSTRAP_READY') { throw 'Could not prepare a new connection.' }
        try { Open-StudioBootstrap $bootstrap } catch { Write-Warning $_.Exception.Message }
        $bootstrap = $null
      }
      'G' {
        try {
          $token = Read-StudioGitHubToken
          $agentProcess.StandardInput.WriteLine((ConvertTo-Json -Compress @{ command = 'github'; token = $token }))
          $agentProcess.StandardInput.Flush()
          if ((Read-StudioReply $agentProcess) -ne 'STUDIO_GITHUB_CONNECTED') { throw 'Could not connect GitHub.' }
          Write-Host 'GitHub credential connected for this session. Refresh connection status in Studio.'
        } catch { Write-Warning $_.Exception.Message }
        finally { $token = $null }
      }
      'Q' { return }
      default { Write-Host 'Enter R, G, or Q. No passphrases are needed.' }
    }
  }
} catch {
  Write-Error $_.Exception.Message
} finally {
  $token = $null; $bootstrap = $null
  if ($agentProcess) {
    if ($agentStarted -and -not $agentProcess.HasExited) {
      $agentProcess.StandardInput.Close()
      if (-not $agentProcess.WaitForExit(3000)) { $agentProcess.Kill() }
    }
    $agentProcess.Dispose()
  }
}
