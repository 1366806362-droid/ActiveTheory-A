# GEO V4.1.9-B Candidate B refinement command pack.
#
# Replace the placeholder below on the RTX 5060 Ti workstation. This file
# defines independent commands only; sourcing it never starts Blender or a
# render automatically.

$ErrorActionPreference = "Stop"
$BlenderExe = "<BLENDER_EXE_PATH>"
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$RefineScript = Join-Path $ProjectRoot "tools\blender\geo_v4_master_refine_b.py"
$ConfigPath = Join-Path $ProjectRoot "tools\blender\geo_v4_master_refine_b_config.json"
$SourceBlend = Join-Path $ProjectRoot "art\geo-scene\v419-blender-master-lookdev\geo-v4-master-lookdev.blend"
$WorkingBlend = Join-Path $ProjectRoot "art\geo-scene\v419-blender-master-lookdev\geo-v4-master-lookdev-b-working.blend"

function Assert-CandidateBBlenderPath {
    if ($BlenderExe -eq "<BLENDER_EXE_PATH>") {
        throw "Replace <BLENDER_EXE_PATH> with the absolute Blender 5.2 LTS blender.exe path."
    }
    if (-not (Test-Path -LiteralPath $BlenderExe -PathType Leaf)) {
        throw "Blender executable not found: $BlenderExe"
    }
}

function Invoke-CandidateBBlender {
    param(
        [Parameter(Mandatory = $true)]
        [string[]] $RefineArguments
    )
    Assert-CandidateBBlenderPath
    Push-Location $ProjectRoot
    try {
        & $BlenderExe `
            --background `
            --factory-startup `
            --python $RefineScript `
            -- `
            --config $ConfigPath `
            @RefineArguments
        if ($LASTEXITCODE -ne 0) {
            throw "Blender exited with code $LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }
}

# Company-safe or home-safe: creates only the Candidate B working master and
# scene audit. It performs no rendering.
function New-CandidateBWorkingMaster {
    Invoke-CandidateBBlender -RefineArguments @("--prepare-only")
}

# Home RTX 5060 Ti: rebuild Baseline + B1 Material & Lighting, then render
# Preview at an effective 960x540.
function Invoke-CandidateBB1Preview {
    Invoke-CandidateBBlender -RefineArguments @("--phase", "b1", "--preset", "preview")
}

# Home RTX 5060 Ti: rebuild Baseline + B1 + B2 Cavity & Tissue Structure,
# then render Preview. It does not depend on a previous B1 working blend.
function Invoke-CandidateBB2Preview {
    Invoke-CandidateBBlender -RefineArguments @("--phase", "b2", "--preset", "preview")
}

# Home RTX 5060 Ti: rebuild Baseline + B1 + B2 + B3 Business Integration,
# then render Preview. It does not depend on previous phase commands.
function Invoke-CandidateBB3Preview {
    Invoke-CandidateBBlender -RefineArguments @("--phase", "b3", "--preset", "preview")
}

# Home RTX 5060 Ti only. Rebuild the complete Baseline + B1 + B2 + B3
# sequence, then apply the Review preset.
function Invoke-CandidateBReview {
    Invoke-CandidateBBlender -RefineArguments @("--phase", "b3", "--preset", "review")
}

# Home RTX 5060 Ti only. Rebuild the complete Baseline + B1 + B2 + B3
# sequence, then apply the Final preset. This is intentionally separate and
# never called by another function.
function Invoke-CandidateBFinal {
    Invoke-CandidateBBlender -RefineArguments @("--phase", "b3", "--preset", "final")
}

# Read-only GPU and scene diagnostics. It never renders or saves the blend.
function Test-CandidateBGpu {
    Invoke-CandidateBBlender -RefineArguments @("--diagnostics")
}

# Integrity check for migration between company and home workstations.
function Get-CandidateBFileHashes {
    $Files = @(
        $SourceBlend,
        $WorkingBlend,
        $RefineScript,
        $ConfigPath
    )
    foreach ($File in $Files) {
        if (Test-Path -LiteralPath $File -PathType Leaf) {
            $Item = Get-Item -LiteralPath $File
            $Hash = Get-FileHash -LiteralPath $File -Algorithm SHA256
            [pscustomobject]@{
                Path = $Item.FullName
                Bytes = $Item.Length
                SHA256 = $Hash.Hash
            }
        }
        else {
            [pscustomobject]@{
                Path = $File
                Bytes = $null
                SHA256 = "MISSING"
            }
        }
    }
}

# Suggested usage after replacing the Blender path:
#
#   . .\tools\blender\geo_v4_master_refine_b_commands.ps1
#   New-CandidateBWorkingMaster
#   Test-CandidateBGpu
#   Invoke-CandidateBB1Preview
#   Invoke-CandidateBB2Preview
#   Invoke-CandidateBB3Preview
#   Invoke-CandidateBReview
#   Invoke-CandidateBFinal
#   Get-CandidateBFileHashes
