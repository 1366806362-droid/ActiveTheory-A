param(
  [switch]$dryRun,
  [string]$BlenderPath = 'C:\Tools\Blender-5.2-LTS\blender.exe'
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$cameraConfig = Join-Path $PSScriptRoot 'hero_cinematic_v2_config.json'
$visualConfig = Join-Path $PSScriptRoot 'hero_visual_config.json'
$baseBuilder = Join-Path $PSScriptRoot 'build_hero_cinematic_v2_scene.py'
$visualBuilder = Join-Path $PSScriptRoot 'build_home_visual_skeleton.py'
$baseline = Join-Path $repoRoot 'docs\hero-cinematic\blender-shot-v1\hero-handoff-baseline-v11.json'
$baseScene = Join-Path $repoRoot 'art\hero-cinematic\blender-shot-v1\hero-cinematic-v2-prep.blend'
$baseArtDir = Join-Path $repoRoot 'art\hero-cinematic\blender-shot-v1'
$outputDir = Join-Path $repoRoot 'art\hero-cinematic\home-lookdev-v1'
$outputScene = Join-Path $outputDir 'hero-cinematic-home-lookdev-v1.blend'
$planPath = Join-Path $outputDir 'home-lookdev-prepare-plan.json'
$gpuNames = @(
  Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue |
    ForEach-Object { $_.Name } |
    Where-Object { $_ }
)
$isHomeGpu = @($gpuNames | Where-Object { $_ -match '(?i)NVIDIA.*5060\s*Ti' }).Count -gt 0

$plan = [ordered]@{
  schemaVersion = '1.0.0'
  mode = if ($dryRun) { 'DRY_RUN' } else { 'PREPARE_HOME_LOOKDEV' }
  blenderExecutable = $BlenderPath
  blenderExists = Test-Path -LiteralPath $BlenderPath -PathType Leaf
  detectedGpuNames = $gpuNames
  homeGpuMatched = $isHomeGpu
  baseScene = $baseScene
  rebuildBaseSceneIfMissing = $true
  visualPreset = 'homeLookdev'
  outputScene = $outputScene
  renderRequested = $false
  cyclesRenderExecuted = $false
  optixRenderExecuted = $false
}
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
$plan | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $planPath -Encoding utf8

if ($dryRun) {
  $plan | ConvertTo-Json -Depth 6
  exit 0
}
if (-not $isHomeGpu) { throw 'NOT_HOME_GPU: Home LookDev preparation is blocked on this workstation.' }
if (-not (Test-Path -LiteralPath $BlenderPath -PathType Leaf)) { throw "Blender executable not found: $BlenderPath" }

if (-not (Test-Path -LiteralPath $baseScene -PathType Leaf)) {
  New-Item -ItemType Directory -Force -Path $baseArtDir | Out-Null
  & $BlenderPath '--background' '--factory-startup' '--python' $baseBuilder '--' '--config' $cameraConfig '--output' $baseScene '--art-dir' $baseArtDir
  if ($LASTEXITCODE -ne 0) { throw "Locked base scene generation failed with exit code $LASTEXITCODE" }
}

& $BlenderPath '--background' $baseScene '--python' $visualBuilder '--' '--config' $visualConfig '--baseline' $baseline '--camera-config' $cameraConfig '--output' $outputScene '--art-dir' $outputDir '--preset' 'homeLookdev'
if ($LASTEXITCODE -ne 0) { throw "Home LookDev scene preparation failed with exit code $LASTEXITCODE" }

Write-Output "Prepared without rendering: $outputScene"
