# ================================================================
# Wings Fly Academy — New Client Deployment Script
# Run this script to create a new client project instantly
# Usage: Right-click -> "Run with PowerShell"  OR  .\new-client.ps1
# ================================================================

try { $Host.UI.RawUI.WindowTitle = "WFA New Client Setup" } catch {}
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8


function Write-Title { param($t); Write-Host "`n  $t" -ForegroundColor Cyan }
function Write-OK    { param($t); Write-Host "  [OK] $t"    -ForegroundColor Green }
function Write-WARN  { param($t); Write-Host "  [!]  $t"    -ForegroundColor Yellow }
function Write-ERR   { param($t); Write-Host "  [X]  $t"    -ForegroundColor Red }
function Ask { param($q,$d); $suffix = if($d){ " [$d]" } else { '' }; $r = Read-Host "  --> $q$suffix"; if (!$r -and $d) { $r = $d }; return $r }

try {
Clear-Host
Write-Host ""
Write-Host "  ============================================" -ForegroundColor DarkCyan
Write-Host "   Wings Fly Academy — New Client Deployer" -ForegroundColor Cyan
Write-Host "  ============================================" -ForegroundColor DarkCyan
Write-Host "  এই script চালালে নতুন Client-এর জন্য" -ForegroundColor DarkGray
Write-Host "  সম্পূর্ণ deployment folder ready হবে।" -ForegroundColor DarkGray
Write-Host ""

# ── STEP 1: Collect Info ─────────────────────────────────────
Write-Title "STEP 1: Client Information"
Write-Host ""

$CODE    = (Ask "Customer Code (4 chars, e.g. GL01)").Trim().ToUpper()
if (!$CODE -or $CODE.Length -lt 2) { Write-ERR "Customer Code দিতে হবে!"; pause; exit 1 }

$ACADEMY = (Ask "Academy Name (e.g. Green Leaf Academy)").Trim()

$REPO    = (Ask "GitHub Repo Name (e.g. Client-1)").Trim()
if ($REPO -match "\s") {
    Write-WARN "Repo Name-এ স্পেস থাকা যাবে না। স্পেস পরিবর্তন করে '-' করা হচ্ছে..."
    $REPO = $REPO -replace "\s+", "-"
    Write-WARN "নতুন Repo Name: $REPO"
}

$GHUSER  = (Ask "GitHub Username" "shakibapon1234-maker").Trim()
if ($GHUSER -match "\s") {
    Write-ERR "GitHub Username-এ স্পেস থাকতে পারে না!"
    pause; exit 1
}

$PKG     = (Ask "Package (Basic/Pro/Custom)" "Basic").Trim()

Write-Host ""
Write-Title "STEP 2: Supabase Credentials"
Write-Host ""
Write-WARN "Supabase -> Settings -> API থেকে নিন"
Write-Host ""

$URL     = (Ask "Supabase Project URL (https://xxxx.supabase.co)").Trim()
if (!$URL -or !$URL.StartsWith("https://")) { Write-ERR "Valid Supabase URL দিন!"; pause; exit 1 }

$KEY     = (Ask "Supabase Anon Key (eyJhbGci...)").Trim()
if (!$KEY -or $KEY.Length -lt 30) { Write-ERR "Valid Anon Key দিন!"; pause; exit 1 }

$LICKEY  = (Ask "License Key (optional, Enter to skip)").Trim().ToUpper()

# ── STEP 3: Find source www/ folder ──────────────────────────
Write-Host ""
Write-Title "STEP 3: Source Project খোঁজা হচ্ছে..."
Write-Host ""

$SCRIPT_DIR = $PSScriptRoot
$WFA_ROOT   = $SCRIPT_DIR
$WWW_SRC    = Join-Path $WFA_ROOT "www"

if (!(Test-Path $WWW_SRC)) {
    Write-ERR "www/ folder পাওয়া যায়নি: $WWW_SRC"
    Write-WARN "আগে 'node build-www.js' চালান!"
    pause; exit 1
}
Write-OK "Source found: $WWW_SRC"

# ── STEP 4: Create client folder ──────────────────────────────
$PARENT_DIR = Split-Path -Parent $SCRIPT_DIR
$CLIENT_DIR = Join-Path $PARENT_DIR $REPO

if (Test-Path $CLIENT_DIR) {
    $confirm = Ask "Folder '$REPO' already exists. Overwrite? (yes/no)" "no"
    if ($confirm -ne "yes") { Write-WARN "Cancelled."; pause; exit 0 }
    Remove-Item -Recurse -Force $CLIENT_DIR
}

Write-Host ""
Write-Title "STEP 4: Folder তৈরি ও files copy হচ্ছে..."
Write-Host ""

New-Item -ItemType Directory -Path $CLIENT_DIR -Force | Out-Null
Copy-Item -Path "$WWW_SRC\*" -Destination $CLIENT_DIR -Recurse -Force
Write-OK "Files copied to: $CLIENT_DIR"

# ── STEP 5: Write supabase-secrets.stub.js ────────────────────
Write-Host ""
Write-Title "STEP 5: Client config file লেখা হচ্ছে..."
Write-Host ""

$TODAY   = (Get-Date -Format "yyyy-MM-dd")
$SITEURL = "https://$GHUSER.github.io/$REPO/"
$LICLINE = if ($LICKEY) { "\n  licenseKey:   `"$LICKEY`"," } else { "" }

$STUB = @"
// ================================================================
// Wings Fly Academy - Client Deployment Config
// Generated : $TODAY
// Customer  : $ACADEMY  |  Code: $CODE  |  Package: $PKG
// WARNING   : Do not share this file publicly — contains API key
// ================================================================

window.WFA_SUPABASE_SECRETS = {
  url:          "$URL",
  anonKey:      "$KEY",
  customerCode: "$CODE",$LICLINE
  package:      "$PKG",
  deployedAt:   "$TODAY",
  siteUrl:      "$SITEURL",
};

// Prevent runtime modification
if (Object.freeze) Object.freeze(window.WFA_SUPABASE_SECRETS);
"@

$STUB_PATH = Join-Path $CLIENT_DIR "js\core\supabase-secrets.stub.js"
$STUB | Set-Content -Path $STUB_PATH -Encoding UTF8
Write-OK "Config written: js/core/supabase-secrets.stub.js"

# ── STEP 5B: Write to clients-metadata.js in main project ──────
Write-Host "Updating main project clients-metadata.js..."
$META_PATH = Join-Path $WFA_ROOT "js\core\clients-metadata.js"
$existing_clients = @()
if (Test-Path $META_PATH) {
    $js_content = Get-Content -Path $META_PATH -Raw -Encoding UTF8

    # ── FIX: Strip the JS wrapper reliably instead of using greedy regex ──
    # Remove: window.WFA_AUTO_DEPLOYED_CLIENTS = ... ;
    # Then trim whitespace so ConvertFrom-Json gets pure JSON.
    $json_raw = $js_content -replace '^\s*window\.WFA_AUTO_DEPLOYED_CLIENTS\s*=\s*', '' `
                            -replace ';\s*$', '' |
               ForEach-Object { $_.Trim() }
    try {
        $parsed = ConvertFrom-Json $json_raw
        if ($parsed -ne $null) {
            $existing_clients = @($parsed)
        }
    } catch {
        Write-WARN "clients-metadata.js parse error — starting fresh list."
        $existing_clients = @()
    }
}

# Ensure it is always a proper array
if ($existing_clients -isnot [array]) {
    $existing_clients = @($existing_clients)
}

# ── FIX: Check for duplicate customerCode before appending ──
$already_exists = $existing_clients | Where-Object { $_.customerCode -eq $CODE }
if ($already_exists) {
    Write-WARN "customerCode '$CODE' already exists in clients-metadata.js — skipping duplicate."
} else {
    $new_client = [PSCustomObject]@{
        id           = [Guid]::NewGuid().ToString()
        customerCode = $CODE
        academy      = $ACADEMY
        package      = $PKG
        licenseKey   = $LICKEY
        supabaseUrl  = $URL
        supabaseKey  = $KEY
        createdAt    = (Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fffZ")
        notes        = "Auto-deployed via script"
    }
    $existing_clients += $new_client
}

$new_json = ConvertTo-Json $existing_clients -Depth 10
$new_meta_content = "window.WFA_AUTO_DEPLOYED_CLIENTS = $new_json;"
$new_meta_content | Set-Content -Path $META_PATH -Encoding UTF8
Write-OK "Clients metadata updated: js/core/clients-metadata.js"

# ── STEP 5C: Push clients-metadata.js to main admin repo ──────
# এটা না করলে Client Manager-এ নতুন client দেখা যাবে না (GitHub Pages পুরানো file দেখাবে)
Write-Host ""
Write-Title "STEP 5C: Main admin repo-তে clients-metadata.js push করা হচ্ছে..."
Write-Host ""
Push-Location $WFA_ROOT
try {
    git add "js/core/clients-metadata.js" | Out-Null
    git commit -m "chore: add client $CODE ($ACADEMY) to clients-metadata.js" | Out-Null
    git push | Out-Null
    Write-OK "Main repo updated — Client Manager-এ নতুন client দেখাবে।"
} catch {
    Write-WARN "Main repo push করা যায়নি। পরে নিজে করুন: git add js/core/clients-metadata.js && git commit -m 'add client $CODE' && git push"
} finally {
    Pop-Location
}

# ── STEP 6: Create .gitattributes ─────────────────────────────
$GA = "* text=auto`n*.js text eol=lf`n*.html text eol=lf`n*.css text eol=lf"
$GA | Set-Content -Path (Join-Path $CLIENT_DIR ".gitattributes") -Encoding UTF8

# ── STEP 7: Git init and first commit ─────────────────────────
Write-Host ""
Write-Title "STEP 6: Git setup হচ্ছে..."
Write-Host ""

Push-Location $CLIENT_DIR
git init -b main | Out-Null
git add -A | Out-Null
git commit -m "init: $ACADEMY ($CODE) — WFA Client Deployment" | Out-Null
Write-OK "Git initialized and committed"

# ── STEP 8: Ask to push ───────────────────────────────────────
Write-Host ""
Write-WARN "এখন GitHub-এ '$REPO' নামে একটি NEW (empty) repo তৈরি করুন:"
Write-Host "  https://github.com/new" -ForegroundColor Blue
Write-Host ""
$push = Ask "GitHub repo তৈরি হয়েছে? Push করব? (yes/no)" "yes"

if ($push -eq "yes") {
    $REMOTE = "https://github.com/$GHUSER/$REPO.git"
    git remote add origin $REMOTE | Out-Null
    git push -u origin main
    if ($LASTEXITCODE -ne 0) {
        throw "GitHub-এ push করা সম্ভব হয়নি। আপনার গিটহাব ইউজারনেম ($GHUSER) এবং রেপো নাম ($REPO) সঠিক কিনা দেখে নিন এবং গিটহাবে আগে থেকেই রেপোটি তৈরি করেছেন কিনা নিশ্চিত করুন।"
    }
    Write-OK "Pushed to: $REMOTE"
    Write-OK "Live site: $SITEURL"
} else {
    Write-WARN "Push করা হয়নি। পরে নিজে করুন:"
    Write-Host "  cd `"$CLIENT_DIR`"" -ForegroundColor DarkGray
    Write-Host "  git remote add origin https://github.com/$GHUSER/$REPO.git" -ForegroundColor DarkGray
    Write-Host "  git push -u origin main" -ForegroundColor DarkGray
}

Pop-Location

# ── STEP 9: Summary ───────────────────────────────────────────
Write-Host ""
Write-Host "  ============================================" -ForegroundColor DarkGreen
Write-Host "   DONE! Client Deployment Ready" -ForegroundColor Green
Write-Host "  ============================================" -ForegroundColor DarkGreen
Write-Host ""
Write-Host "  Customer Code : $CODE" -ForegroundColor White
Write-Host "  Academy       : $ACADEMY" -ForegroundColor White
Write-Host "  Folder        : $CLIENT_DIR" -ForegroundColor White
Write-Host "  Live Site     : $SITEURL" -ForegroundColor Cyan
Write-Host ""
Write-Host "  NEXT STEPS:" -ForegroundColor Yellow
Write-Host "  1. Client Supabase -> SQL Editor -> CLIENT_MASTER_SETUP.sql run করুন"
Write-Host "  2. GitHub repo -> Settings -> Pages -> main branch enable করুন"
Write-Host "  3. Main Dashboard -> Settings -> Client Manager -> License Key generate করুন"
Write-Host "  4. Key-টি client-কে পাঠান (Incognito-তে setup করতে বলুন)"
Write-Host "  5. Bug fix update: main project rebuild (node build-www.js) -> client repo push"
Write-Host ""
} catch {
    Write-ERR "দুঃখিত, স্ক্রিপ্ট চলাকালীন একটি ত্রুটি ঘটেছে:"
    Write-Host "  $($_.Exception.Message)" -ForegroundColor Red
    Write-WARN "সমস্যাটি সমাধান করার জন্য উপরের এররটি দেখে চেক করুন।"
} finally {
    pause
}


