param(
  [switch]$dryRun,
  [switch]$forceRender,
  [ValidateSet(64, 128, 256)]
  [int]$Samples,
  [string]$BlenderPath = 'C:\Tools\Blender-5.2-LTS\blender.exe'
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$configPath = Join-Path $PSScriptRoot 'hero_cinematic_v2_config.json'
$baselinePath = Join-Path $repoRoot 'docs\hero-cinematic\blender-shot-v1\hero-handoff-baseline-v11.json'
$sceneGenerator = Join-Path $PSScriptRoot 'build_hero_cinematic_v2_scene.py'
$scenePath = Join-Path $repoRoot 'art\hero-cinematic\home-lookdev-v1\hero-cinematic-home-lookdev-v1.blend'
$renderHelper = Join-Path $PSScriptRoot 'run_home_preview.py'
$outputDir = Join-Path $repoRoot 'art\hero-cinematic\home-preview-v1'
$diagnosticsDir = Join-Path $repoRoot 'art\hero-cinematic\handoff-alignment-v1'
$planPath = Join-Path $diagnosticsDir 'home-render-dry-run.json'
$frames = @(1, 78, 145, 198, 240)

$config = Get-Content -Raw -LiteralPath $configPath | ConvertFrom-Json
$allowedSamples = @(64, 128, 256)
$configSamples = [int]$config.homeRender.samples
$samplesRequested = $PSBoundParameters.ContainsKey('Samples')
if ($configSamples -notin $allowedSamples) {
  throw "Unsupported config samples: $configSamples. Allowed values: 64, 128, 256."
}
$requestedSamples = if ($samplesRequested) { [int]$Samples } else { $null }
$effectiveSamples = if ($samplesRequested) { [int]$Samples } else { $configSamples }
$gpuNames = @(
  Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue |
    ForEach-Object { $_.Name } |
    Where-Object { $_ }
)
$isHomeGpu = @($gpuNames | Where-Object { $_ -match '(?i)NVIDIA.*5060\s*Ti' }).Count -gt 0

$plan = [ordered]@{
  schemaVersion = '1.0.0'
  mode = if ($dryRun) { 'DRY_RUN' } else { 'RENDER' }
  createdAt = (Get-Date).ToString('o')
  blenderExecutable = $BlenderPath
  blenderExists = Test-Path -LiteralPath $BlenderPath -PathType Leaf
  sceneGenerator = $sceneGenerator
  sceneFile = $scenePath
  config = $configPath
  baseline = $baselinePath
  frames = $frames
  resolution = [ordered]@{
    width = [int]$config.homeRender.renderWidth
    height = [int]$config.homeRender.renderHeight
  }
  configSamples = $configSamples
  requestedSamples = $requestedSamples
  effectiveSamples = $effectiveSamples
  samples = $effectiveSamples
  engine = [string]$config.homeRender.engine
  device = [string]$config.homeRender.device
  computeBackend = [string]$config.homeRender.computeBackend
  denoise = [bool]$config.homeRender.denoise
  outputFolder = $outputDir
  estimatedTaskCount = $frames.Count
  detectedGpuNames = $gpuNames
  homeGpuMatched = $isHomeGpu
  forceRenderRequested = [bool]$forceRender
  cyclesExecuted = $false
  optixExecuted = $false
}

New-Item -ItemType Directory -Force -Path $diagnosticsDir | Out-Null
$plan | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $planPath -Encoding utf8

if ($dryRun) {
  $plan | ConvertTo-Json -Depth 8
  exit 0
}

if (-not $forceRender -and -not $isHomeGpu) {
  throw 'NOT_HOME_GPU: Formal preview rendering is blocked. Use -dryRun on this workstation.'
}
if (-not (Test-Path -LiteralPath $BlenderPath -PathType Leaf)) {
  throw "Blender executable not found: $BlenderPath"
}
if (-not (Test-Path -LiteralPath $scenePath -PathType Leaf)) {
  throw "Prepared Blender scene not found: $scenePath"
}

New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
$arguments = @(
  '--background', $scenePath,
  '--python', $renderHelper,
  '--',
  '--config', $configPath,
  '--output-dir', $outputDir,
  '--frames', ($frames -join ','),
  '--confirm-render', 'HOME_PREVIEW_5_FRAMES'
)
if ($samplesRequested) { $arguments += @('--samples', [string]$effectiveSamples) }
if ($forceRender) { $arguments += '--force-render' }

& $BlenderPath @arguments
if ($LASTEXITCODE -ne 0) { throw "Blender preview failed with exit code $LASTEXITCODE" }
