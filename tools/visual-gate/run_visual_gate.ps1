[CmdletBinding()]
param(
  [string]$Config = (Join-Path $PSScriptRoot 'visual_gate_config.json'),
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$runner = Join-Path $PSScriptRoot 'run_visual_gate.py'
$pythonCommand = Get-Command python -ErrorAction SilentlyContinue

if (-not $pythonCommand) {
  throw 'Python is required to run Rapid Beauty Gate.'
}

$arguments = @($runner, '--config', $Config)
if ($DryRun) {
  $arguments += '--dry-run'
}

& $pythonCommand.Source @arguments
exit $LASTEXITCODE
