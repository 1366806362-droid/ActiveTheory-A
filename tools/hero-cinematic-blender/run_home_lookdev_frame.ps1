param(
  [switch]$dryRun,
  [string]$BlenderPath = 'C:\Tools\Blender-5.2-LTS\blender.exe'
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$sceneFile = Join-Path $repoRoot 'art\hero-cinematic\home-lookdev-v1\hero-cinematic-home-lookdev-v1.blend'
$pythonTool = Join-Path $PSScriptRoot 'run_home_lookdev_frame.py'
$outputDir = Join-Path $repoRoot 'art\hero-cinematic\home-lookdev-review-v12'
$outputFile = Join-Path $outputDir 'frame-145-lookdev-v12.png'
$renderLog = Join-Path $outputDir 'home-lookdev-frame-145-log.json'
$stdoutLog = Join-Path $outputDir 'blender-frame-145-stdout.log'
$stderrLog = Join-Path $outputDir 'blender-frame-145-stderr.log'
$confirmation = 'HOME_LOOKDEV_FRAME_145'
$gpuNames = @(
  Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue |
    ForEach-Object { $_.Name } |
    Where-Object { $_ }
)
$homeGpuMatched = @($gpuNames | Where-Object { $_ -match '(?i)NVIDIA.*5060\s*Ti' }).Count -gt 0

$plan = [ordered]@{
  schemaVersion = '1.2.0'
  mode = if ($dryRun) { 'DRY_RUN' } else { 'RENDER_SINGLE_LOOKDEV_FRAME' }
  blenderExecutable = $BlenderPath
  blenderExists = Test-Path -LiteralPath $BlenderPath -PathType Leaf
  sceneFile = $sceneFile
  sceneExists = Test-Path -LiteralPath $sceneFile -PathType Leaf
  confirmation = $confirmation
  frames = @(145)
  samples = 32
  engine = 'CYCLES'
  device = 'GPU'
  computeBackend = 'OPTIX'
  denoise = $true
  motionBlur = $true
  resolution = [ordered]@{ width = 1920; height = 1080 }
  output = $outputFile
  fullSequenceAllowed = $false
  formalPreviewToolModified = $false
  detectedGpuNames = $gpuNames
  homeGpuMatched = $homeGpuMatched
}

New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
$plan | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $outputDir 'home-lookdev-frame-145-plan.json') -Encoding utf8
if ($dryRun) {
  $plan | ConvertTo-Json -Depth 6
  exit 0
}
if (-not $plan.blenderExists) { throw "Blender executable not found: $BlenderPath" }
if (-not $plan.sceneExists) { throw "Home LookDev scene not found: $sceneFile" }
if (-not $homeGpuMatched) { throw 'NOT_HOME_GPU: RTX 5060 Ti is required.' }

$arguments = @(
  '--background',
  $sceneFile,
  '--python',
  $pythonTool,
  '--',
  '--confirm-render',
  $confirmation
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
  Start-Sleep -Milliseconds 400
  $process.Refresh()
}
$process.WaitForExit()
if (Test-Path -LiteralPath $stdoutLog) { Get-Content -LiteralPath $stdoutLog -Encoding UTF8 }
if (Test-Path -LiteralPath $stderrLog) { Get-Content -LiteralPath $stderrLog -Encoding UTF8 }
if (-not (Test-Path -LiteralPath $renderLog -PathType Leaf)) { throw "Render log was not created: $renderLog" }

$telemetry = [pscustomobject]@{
  sampleCount = $sampleCount
  peakMemoryMiB = $peakMemoryMiB
  peakUtilizationPercent = $peakUtilizationPercent
  highestTemperatureC = $highestTemperatureC
}
$telemetry | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $outputDir 'gpu-telemetry.json') -Encoding UTF8
$log = [System.IO.File]::ReadAllText($renderLog, [System.Text.Encoding]::UTF8) | ConvertFrom-Json
$exitCode = $process.ExitCode
if ($null -ne $exitCode -and [int]$exitCode -ne 0) {
  throw "Single-frame Blender render failed with exit code $exitCode."
}
if ($log.status -ne 'complete') { throw "Single-frame Blender render log status is not complete: $($log.status)" }
$log | Add-Member -NotePropertyName gpuTelemetry -NotePropertyValue $telemetry -Force
$log | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $renderLog -Encoding utf8
$log | ConvertTo-Json -Depth 8
