param(
  [string]$BlenderPath = 'C:\Tools\Blender-5.2-LTS\blender.exe'
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$configPath = Join-Path $PSScriptRoot 'hero_cinematic_v2_config.json'
$baselinePath = Join-Path $repoRoot 'docs\hero-cinematic\blender-shot-v1\hero-handoff-baseline-v11.json'
$threeContractPath = Join-Path $repoRoot 'docs\hero-cinematic\blender-shot-v1\hero-handoff-three-v11.json'
$alignmentPath = Join-Path $repoRoot 'art\hero-cinematic\handoff-alignment-v1\handoff-alignment-validation.json'
$scenePath = Join-Path $repoRoot 'art\hero-cinematic\blender-shot-v1\hero-cinematic-v2-prep.blend'
$diagnosticsOutput = Join-Path $repoRoot 'art\hero-cinematic\handoff-alignment-v1\home-environment-check.json'
$homeOutput = Join-Path $repoRoot 'art\hero-cinematic\home-preview-v1\home-preview-environment.json'
$cyclesOutput = Join-Path $repoRoot 'art\hero-cinematic\home-preview-v1\cycles-devices.json'
$gpuNames = @(
  Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue |
    ForEach-Object { $_.Name } |
    Where-Object { $_ }
)
$isHomeGpu = @($gpuNames | Where-Object { $_ -match '(?i)NVIDIA.*5060\s*Ti' }).Count -gt 0
$drive = Get-PSDrive -Name ([System.IO.Path]::GetPathRoot($repoRoot).TrimEnd('\').TrimEnd(':'))
$alignmentPassed = $false
if (Test-Path -LiteralPath $alignmentPath -PathType Leaf) {
  $alignment = Get-Content -Raw -LiteralPath $alignmentPath | ConvertFrom-Json
  $alignmentPassed = [int]$alignment.passed -gt 0 -and [int]$alignment.failed -eq 0
}

$cyclesProbe = $null
if ($isHomeGpu -and (Test-Path -LiteralPath $BlenderPath -PathType Leaf)) {
  $probeScript = Join-Path $PSScriptRoot 'inspect_cycles_devices.py'
  & $BlenderPath '--background' '--factory-startup' '--python' $probeScript '--' '--output' $cyclesOutput
  if ($LASTEXITCODE -ne 0) { throw "Cycles device inspection failed with exit code $LASTEXITCODE" }
  $cyclesProbe = Get-Content -Raw -LiteralPath $cyclesOutput | ConvertFrom-Json
}

$checks = [ordered]@{
  blenderExists = Test-Path -LiteralPath $BlenderPath -PathType Leaf
  nvidiaGpuVisible = @($gpuNames | Where-Object { $_ -match '(?i)NVIDIA' }).Count -gt 0
  homeGpuMatched = $isHomeGpu
  cyclesGpuVisible = if ($cyclesProbe) { [bool]$cyclesProbe.nvidiaVisible } else { $null }
  optixAvailable = if ($cyclesProbe) { [bool]$cyclesProbe.optixAvailable } else { $null }
  outputFreeBytes = [int64]$drive.Free
  sceneExists = Test-Path -LiteralPath $scenePath -PathType Leaf
  configExists = Test-Path -LiteralPath $configPath -PathType Leaf
  baselineExists = Test-Path -LiteralPath $baselinePath -PathType Leaf
  threeContractExists = Test-Path -LiteralPath $threeContractPath -PathType Leaf
  cameraValidationPassed = $alignmentPassed
}
$allRequired = $checks.blenderExists -and $checks.homeGpuMatched -and $checks.cyclesGpuVisible -and $checks.optixAvailable -and $checks.sceneExists -and $checks.configExists -and $checks.baselineExists -and $checks.threeContractExists -and $checks.cameraValidationPassed
$status = if (-not $isHomeGpu) { 'NOT_HOME_GPU' } elseif ($allRequired) { 'READY' } else { 'NOT_READY' }
$report = [ordered]@{
  schemaVersion = '1.0.0'
  checkedAt = (Get-Date).ToString('o')
  status = $status
  gpuNames = $gpuNames
  blenderExecutable = $BlenderPath
  checks = $checks
  renderStarted = $false
  cyclesRenderExecuted = $false
  optixRenderExecuted = $false
}

New-Item -ItemType Directory -Force -Path (Split-Path $diagnosticsOutput) | Out-Null
New-Item -ItemType Directory -Force -Path (Split-Path $homeOutput) | Out-Null
$report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $diagnosticsOutput -Encoding utf8
$report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $homeOutput -Encoding utf8
$report | ConvertTo-Json -Depth 8
