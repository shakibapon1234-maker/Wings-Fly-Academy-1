# ================================================================
# Wings Fly Academy - Client Metadata Sync Script
# Run this script to sync your local Client ID folders with the UI
# Usage: Right-click -> "Run with PowerShell"  OR  .\sync-clients.ps1
# ================================================================

try { $Host.UI.RawUI.WindowTitle = "WFA Client Sync" } catch {}
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "    Client Directory Metadata Synchronizer    " -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

$SCRIPT_DIR = $PSScriptRoot
$WFA_ROOT   = $SCRIPT_DIR
$CLIENTS_DIR = Join-Path (Split-Path -Parent $SCRIPT_DIR) "Client ID"

if (!(Test-Path $CLIENTS_DIR)) {
    Write-Host "[!] Client ID directory not found: $CLIENTS_DIR" -ForegroundColor Yellow
    Write-Host "Creating the folder now..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $CLIENTS_DIR -Force | Out-Null
}

# 1. Get folders actually existing on disk
$existing_folders = Get-ChildItem -Path $CLIENTS_DIR -Directory | Select-Object -ExpandProperty Name
Write-Host "Local client folders found on disk:" -ForegroundColor White
foreach ($folder in $existing_folders) {
    Write-Host "  - $folder" -ForegroundColor Gray
}
Write-Host ""

# 2. Read clients-metadata.js
$META_PATH = Join-Path $WFA_ROOT "js\core\clients-metadata.js"
if (!(Test-Path $META_PATH)) {
    Write-Host "[X] clients-metadata.js not found at $META_PATH" -ForegroundColor Red
    pause; exit 1
}

$js_content = Get-Content -Path $META_PATH -Raw -Encoding UTF8
$clean_content = $js_content -replace "^\uFEFF", ""
$first_b = $clean_content.IndexOf('[')
$last_b  = $clean_content.LastIndexOf(']')

if ($first_b -lt 0 -or $last_b -le $first_b) {
    Write-Host "[!] No JSON list found in clients-metadata.js. Initializing empty list." -ForegroundColor Yellow
    $clients = @()
} else {
    $json_raw = $clean_content.Substring($first_b, $last_b - $first_b + 1)
    try {
        $clients = @(ConvertFrom-Json $json_raw)
    } catch {
        Write-Host "[!] Failed to parse clients-metadata.js JSON. Starting fresh." -ForegroundColor Yellow
        $clients = @()
    }
}

# 3. Filter client records based on folder existence
$synced_clients = @()
foreach ($client in $clients) {
    # Check by repo field first, then fallback to academy name
    $folder_name = if ($client.repo) { $client.repo } else { $client.academy }
    
    # Try case-insensitive matching in existing folders list
    $match = $existing_folders | Where-Object { $_ -ieq $folder_name }
    
    if ($match) {
        # Populate repo field if missing
        if (!$client.repo) {
            $client | Add-Member -MemberType NoteProperty -Name "repo" -Value $match -Force
        }
        $synced_clients += $client
        Write-Host "[OK] Keeping client metadata: $($client.academy) ($($client.customerCode)) -> folder: $match" -ForegroundColor Green
    } else {
        Write-Host "[-] Removing metadata for deleted client: $($client.academy) ($($client.customerCode)) (Folder not found)" -ForegroundColor Yellow
    }
}

# 4. Save synced metadata back
$new_json = ConvertTo-Json $synced_clients -Depth 10
$new_meta_content = "window.WFA_AUTO_DEPLOYED_CLIENTS = $new_json;"

# Save in main project
$new_meta_content | Set-Content -Path $META_PATH -Encoding UTF8
Write-Host "[OK] clients-metadata.js updated." -ForegroundColor Green

# Save in build output
$WWW_META_PATH = Join-Path $WFA_ROOT "www\js\core\clients-metadata.js"
if (Test-Path (Split-Path -Parent $WWW_META_PATH)) {
    $new_meta_content | Set-Content -Path $WWW_META_PATH -Encoding UTF8
    Write-Host "[OK] www/js/core/clients-metadata.js updated." -ForegroundColor Green
}

# 5. Git Commit and Push (Optional)
Write-Host ""
Push-Location $WFA_ROOT
try {
    git add "js/core/clients-metadata.js"
    $staged = git status --porcelain "js/core/clients-metadata.js"
    if ($staged) {
        git commit -m "chore: sync client manager metadata with local folders"
        git push
        Write-Host "[OK] Pushed changes to GitHub repository." -ForegroundColor Green
    } else {
        Write-Host "No metadata changes to commit." -ForegroundColor Gray
    }
} catch {
    Write-Host "[!] Git auto-push failed. Please push manually if needed." -ForegroundColor Yellow
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host "Sync Completed Successfully!" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
pause
