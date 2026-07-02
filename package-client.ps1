# ================================================================
# Wings Fly Academy - Client Packaging Script
# Run this script to package the client folder into a clean ZIP
# automatically excluding gitignored/secret files.
# Usage: Right-click -> "Run with PowerShell"  OR  .\package-client.ps1
# ================================================================

try { $Host.UI.RawUI.WindowTitle = "WFA Client Packager" } catch {}
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Write-Title { param($t); Write-Host "`n  $t" -ForegroundColor Cyan }
function Write-OK    { param($t); Write-Host "  [OK] $t"    -ForegroundColor Green }
function Write-WARN  { param($t); Write-Host "  [!]  $t"    -ForegroundColor Yellow }
function Write-ERR   { param($t); Write-Host "  [X]  $t"    -ForegroundColor Red }
function Ask { param($q,$d); $suffix = if($d){ " [$d]" } else { '' }; $r = Read-Host "  --> $q$suffix"; if (!$r -and $d) { $r = $d }; return $r }

$TEMP_DIR = $null

try {
    Clear-Host
    Write-Host ""
    Write-Host "  ============================================" -ForegroundColor DarkCyan
    Write-Host "   Wings Fly Academy - Client Packager" -ForegroundColor Cyan
    Write-Host "  ============================================" -ForegroundColor DarkCyan
    Write-Host "  Ei script chalale project theke sob gitignored" -ForegroundColor DarkGray
    Write-Host "  secrets (VAPID, supabase-secrets.js, etc.) baad" -ForegroundColor DarkGray
    Write-Host "  diye ekta clean ZIP package toiri hobe." -ForegroundColor DarkGray
    Write-Host ""

    # -- STEP 1: Determine paths ------------------------------------
    $SRC_DIR = $PSScriptRoot
    $PARENT_DIR = Split-Path $SRC_DIR -Parent
    $PROJECT_NAME = Split-Path $SRC_DIR -Leaf
    $DEFAULT_ZIP = Join-Path $PARENT_DIR "$PROJECT_NAME-packaged.zip"

    Write-Title "STEP 1: Output Destination"
    Write-Host "  Source Directory: $SRC_DIR" -ForegroundColor Gray
    $ZIP_PATH = (Ask "Zip output path" $DEFAULT_ZIP).Trim()

    if (Test-Path $ZIP_PATH) {
        $confirm = Ask "File already exists. Overwrite? (yes/no)" "no"
        if ($confirm -ne "yes") { Write-WARN "Cancelled."; pause; exit 0 }
        Remove-Item -Force $ZIP_PATH
    }

    # -- STEP 2: Staging Area ----------------------------------------
    Write-Title "STEP 2: Creating temporary staging area..."
    $TEMP_DIR = Join-Path $env:TEMP "wfa_staging_$(Get-Random)"
    if (Test-Path $TEMP_DIR) { Remove-Item -Recurse -Force $TEMP_DIR }
    New-Item -ItemType Directory -Path $TEMP_DIR -Force | Out-Null
    Write-OK "Staging folder created at: $TEMP_DIR"

    # -- STEP 3: Copying files recursively with exclusions -----------
    Write-Title "STEP 3: Copying files (excluding secrets & node_modules)..."
    
    function Copy-FolderWithExclusions {
        param($src, $dest)
        if (!(Test-Path $dest)) {
            New-Item -ItemType Directory -Path $dest -Force | Out-Null
        }
        
        Get-ChildItem -Path $src | ForEach-Object {
            $name = $_.Name
            if ($_.PSIsContainer) {
                # Exclude folders
                if ($name -eq ".git" -or 
                    $name -eq "node_modules" -or 
                    $name -eq ".vscode" -or 
                    $name -eq ".idea" -or
                    ($src -match "android$" -and ($name -eq "build" -or $name -eq ".gradle"))) {
                    return
                }
                Copy-FolderWithExclusions $_.FullName (Join-Path $dest $name)
            } else {
                # Exclude files
                if ($name -like "*.zip" -or 
                    $name -like "*.rar" -or 
                    $name -like "*.log" -or 
                    $name -like "*.tmp" -or 
                    $name -like "*.temp" -or 
                    $name -like ".env*" -or 
                    $name -eq "VAPID_PRIVATE_KEY.local.md" -or 
                    $name -like "*.vapid-private.*" -or 
                    $name -eq "supabase-secrets.js" -or 
                    $name -eq "license-server-config.js" -or
                    $name -eq ".DS_Store" -or 
                    $name -eq "Thumbs.db" -or 
                    $name -eq "desktop.ini") {
                    return
                }
                Copy-Item $_.FullName (Join-Path $dest $name) -Force
            }
        }
    }

    Copy-FolderWithExclusions $SRC_DIR $TEMP_DIR
    Write-OK "Source files staged successfully."

    # -- STEP 4: Compress Staged Folder ------------------------------
    Write-Title "STEP 4: Compressing staging folder to ZIP..."
    Write-Host "  Compressing..." -ForegroundColor DarkGray
    Compress-Archive -Path "$TEMP_DIR\*" -DestinationPath $ZIP_PATH -Force
    Write-OK "ZIP file created: $ZIP_PATH"

    # -- STEP 5: Cleanup ---------------------------------------------
    Write-Title "STEP 5: Cleaning up staging files..."
    Remove-Item -Recurse -Force $TEMP_DIR
    Write-OK "Staging files deleted successfully."

    Write-Host "`n  ============================================" -ForegroundColor Green
    Write-Host "   PACKAGING COMPLETE SUCCESSFULLY!" -ForegroundColor Green
    Write-Host "  ============================================" -ForegroundColor Green
    Write-Host ""
}
catch {
    Write-ERR "Error encountered during packaging: $_"
    if ($TEMP_DIR -and (Test-Path $TEMP_DIR)) {
        Remove-Item -Recurse -Force $TEMP_DIR -ErrorAction SilentlyContinue
    }
}

pause
