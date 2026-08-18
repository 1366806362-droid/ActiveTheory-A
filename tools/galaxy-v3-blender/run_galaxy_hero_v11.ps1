param(
  [switch]$DryRun,
  [string]$BlenderPath = 'C:\Tools\Blender-5.2-LTS\blender.exe'
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$configPath = Join-Path $PSScriptRoot 'galaxy_hero_v11_config.json'
$builderPath = Join-Path $PSScriptRoot 'build_galaxy_hero_v11.py'
$rendererPath = Join-Path $PSScriptRoot 'render_galaxy_hero_v11.py'
$outputDir = Join-Path $repoRoot 'art\galaxy-v3\hero-v11'
$scenePath = Join-Path $outputDir 'galaxy-hero-v11.blend'
$buildReport = Join-Path $outputDir 'galaxy-hero-v11-build.json'
$renderLog = Join-Path $outputDir 'galaxy-hero-v11-render-log.json'
$stdoutLog = Join-Path $outputDir 'blender-render-stdout.log'
$stderrLog = Join-Path $outputDir 'blender-render-stderr.log'
$gpuNames = @(
  Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue |
    ForEach-Object { $_.Name } |
    Where-Object { $_ }
)
$homeGpuMatched = @($gpuNames | Where-Object { $_ -match '(?i)NVIDIA.*5060\s*Ti' }).Count -gt 0
if (-not (Test-Path -LiteralPath $BlenderPath -PathType Leaf)) { throw "Blender executable not found: $BlenderPath" }
if (-not $homeGpuMatched) { throw 'RTX 5060 Ti is required.' }
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

& $BlenderPath '--background' '--factory-startup' '--python-exit-code' '1' '--python' $builderPath '--' `
  '--config' $configPath '--output' $scenePath '--output-dir' $outputDir '--report' $buildReport
if ($LASTEXITCODE -ne 0) { throw "Galaxy Hero V1.1 build failed with exit code $LASTEXITCODE" }

$plan = [ordered]@{
  schemaVersion = '1.1.0'
  mode = if ($DryRun) { 'DRY_RUN' } else { 'RENDER_MULTILAYER' }
  blenderExecutable = $BlenderPath
  detectedGpuNames = $gpuNames
  homeGpuMatched = $homeGpuMatched
  scene = $scenePath
  architecture = 'independent analytic OpenVDB layers'
  engine = 'CYCLES'
  device = 'GPU'
  backend = 'OPTIX'
  resolution = [ordered]@{ width = 2560; height = 1440 }
  samples = 64
  layerCount = 5
}
$plan | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $outputDir 'galaxy-hero-v11-plan.json') -Encoding utf8
if ($DryRun) {
  $plan | ConvertTo-Json -Depth 6
  exit 0
}

$arguments = @(
  '--background',
  $scenePath,
  '--python-exit-code',
  '1',
  '--python',
  $rendererPath,
  '--',
  '--config',
  $configPath,
  '--output-dir',
  $outputDir,
  '--confirm-render',
  'GALAXY_HERO_V11_MULTILAYER'
)
$process = Start-Process -FilePath $BlenderPath -ArgumentList $arguments -PassThru -WindowStyle Hidden `
  -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog
$peakMemoryMiB = 0
$peakUtilizationPercent = 0
$highestTemperatureC = 0
$sampleCount = 0
while (-not $process.HasExited) {
  $sample = & nvidia-smi '--query-gpu=memory.used,utilization.gpu,temperature.gpu' '--format=csv,noheader,nounits' 2>$null |
    Select-Object -First 1
  if ($sample) {
    $values = @($sample -split ',' | ForEach-Object { [int]$_.Trim() })
    if ($values.Count -ge 3) {
      $peakMemoryMiB = [Math]::Max($peakMemoryMiB, $values[0])
      $peakUtilizationPercent = [Math]::Max($peakUtilizationPercent, $values[1])
      $highestTemperatureC = [Math]::Max($highestTemperatureC, $values[2])
      $sampleCount++
    }
  }
  Start-Sleep -Milliseconds 500
  $process.Refresh()
}
$process.WaitForExit()
if (Test-Path -LiteralPath $stdoutLog) { Get-Content -LiteralPath $stdoutLog -Encoding UTF8 }
if (Test-Path -LiteralPath $stderrLog) { Get-Content -LiteralPath $stderrLog -Encoding UTF8 }
$exitCode = $process.ExitCode
if ($null -ne $exitCode -and [int]$exitCode -ne 0) { throw "Galaxy Hero V1.1 render failed with exit code $exitCode" }
if (-not (Test-Path -LiteralPath $renderLog -PathType Leaf)) { throw "Render log missing: $renderLog" }

$telemetry = [pscustomobject]@{
  sampleCount = $sampleCount
  peakMemoryMiB = $peakMemoryMiB
  peakUtilizationPercent = $peakUtilizationPercent
  highestTemperatureC = $highestTemperatureC
}
$telemetry | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $outputDir 'gpu-telemetry.json') -Encoding utf8
$log = [System.IO.File]::ReadAllText($renderLog, [System.Text.Encoding]::UTF8) | ConvertFrom-Json
$log | Add-Member -NotePropertyName gpuTelemetry -NotePropertyValue $telemetry -Force
$log | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $renderLog -Encoding utf8
$log | ConvertTo-Json -Depth 8
