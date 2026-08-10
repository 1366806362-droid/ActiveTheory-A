param(
  [switch]$confirmFullRender,
  [string]$BlenderPath = 'C:\Tools\Blender-5.2-LTS\blender.exe'
)

$ErrorActionPreference = 'Stop'
if (-not $confirmFullRender) {
  throw 'FULL_SEQUENCE_BLOCKED: pass -confirmFullRender explicitly to permit frames 1-240.'
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$gpuNames = @(Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue | ForEach-Object { $_.Name })
$isHomeGpu = @($gpuNames | Where-Object { $_ -match '(?i)NVIDIA.*5060\s*Ti' }).Count -gt 0
if (-not $isHomeGpu) { throw 'NOT_HOME_GPU: Full sequence rendering is blocked on this workstation.' }
if (-not (Test-Path -LiteralPath $BlenderPath -PathType Leaf)) { throw "Blender executable not found: $BlenderPath" }

$scenePath = Join-Path $repoRoot 'art\hero-cinematic\blender-shot-v1\hero-cinematic-v2-prep.blend'
$configPath = Join-Path $PSScriptRoot 'hero_cinematic_v2_config.json'
$helper = Join-Path $PSScriptRoot 'run_home_preview.py'
$outputDir = Join-Path $repoRoot 'art\hero-cinematic\home-full-sequence-v1'
if (-not (Test-Path -LiteralPath $scenePath -PathType Leaf)) { throw "Prepared Blender scene not found: $scenePath" }
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

& $BlenderPath '--background' $scenePath '--python' $helper '--' '--config' $configPath '--output-dir' $outputDir '--frames' '1-240' '--confirm-render' 'HOME_FULL_240_FRAMES'
if ($LASTEXITCODE -ne 0) { throw "Blender full sequence failed with exit code $LASTEXITCODE" }
