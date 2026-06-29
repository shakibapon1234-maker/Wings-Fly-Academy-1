# ================================================================
# Wings Fly Academy - Automated Multi-Database Backup Script
# Automatically backups Main database and all active Client databases.
# ================================================================

try { $Host.UI.RawUI.WindowTitle = "WFA Database Backups" } catch {}
$ErrorActionPreference = "Continue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "       Automated Database Backup Engine       " -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

$SCRIPT_DIR = $PSScriptRoot
$pgDump = Join-Path $SCRIPT_DIR "bin\pg-tools\pg_dump.exe"

# Output folder for SQL backups
$backupDir = Join-Path (Split-Path -Parent $SCRIPT_DIR) "WFA_Database_Backups"
if (!(Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
}

$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
Write-Host "Saving backups to: $backupDir" -ForegroundColor White
Write-Host "Timestamp: $timestamp" -ForegroundColor Gray
Write-Host ""

# Define databases to backup
$targets = @()

# 1. Main Project Database
$targets += @{
    name = "main_project"
    ref  = "fznhiqzrslldybhmgopk"
    pass = "" # script prompts if empty
}

# 2. Add clients from metadata if it exists
$metadataFile = Join-Path $SCRIPT_DIR "js\core\clients-metadata.js"
if (Test-Path $metadataFile) {
    $content = Get-Content $metadataFile -Raw
    # Extract client configs using regex
    $matches = [regex]::Matches($content, "customerCode:\s*'([^']+)'[\s\S]*?dbRef:\s*'([^']+)'")
    foreach ($match in $matches) {
        $code = $match.Groups[1].Value
        $ref  = $match.Groups[2].Value
        if ($code -and $ref) {
            $targets += @{
                name = "client_$code"
                ref  = $ref
                pass = ""
            }
        }
    }
}

# Prompt for database passwords (cached securely for the session)
$passwords = @{}

foreach ($target in $targets) {
    $dbRef = $target.ref
    $dbName = $target.name
    
    if (!($passwords.ContainsKey($dbRef)) -or [string]::IsNullOrEmpty($passwords[$dbRef])) {
        Write-Host "Enter database password for $dbName (Ref: $dbRef):" -ForegroundColor Yellow
        $securePass = Read-Host -AsSecureString
        $passRaw = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePass))
        $passwords[$dbRef] = $passRaw
    }
    
    $password = $passwords[$dbRef]
    if ([string]::IsNullOrEmpty($password)) {
        Write-Host "[Skip] Password empty. Skipping $dbName." -ForegroundColor Red
        continue
    }
    
    Write-Host "Backing up $dbName..." -ForegroundColor Cyan
    $outputFile = Join-Path $backupDir "$($dbName)_backup_$timestamp.sql"
    $dbUrl = "postgresql://postgres@db.$dbRef.supabase.co:5432/postgres"
    
    # Configure pg_dump connection via PGPASSWORD environment variable
    $env:PGPASSWORD = $password
    
    # Run pg_dump to export both schema and data
    & $pgDump --dbname=$dbUrl --file=$outputFile --clean --if-exists
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Backup successful: $outputFile" -ForegroundColor Green
    } else {
        Write-Host "[Error] Backup failed for $dbName!" -ForegroundColor Red
    }
    
    $env:PGPASSWORD = $null
}

Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host "Database backup job finished." -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
pause
