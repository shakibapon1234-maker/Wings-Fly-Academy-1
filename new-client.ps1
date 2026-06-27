# ================================================================
# Wings Fly Academy - New Client Deployment Script
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
Write-Host "   Wings Fly Academy - New Client Deployer" -ForegroundColor Cyan
Write-Host "  ============================================" -ForegroundColor DarkCyan
Write-Host "  Ei script chalale notun Client-er jonno" -ForegroundColor DarkGray
Write-Host "  sampurna deployment folder ready hobe." -ForegroundColor DarkGray
Write-Host ""

# -- STEP 1: Collect Info ----------------------------------------
Write-Title "STEP 1: Client Information"
Write-Host ""

$CODE    = (Ask "Customer Code (4 chars, e.g. GL01)").Trim().ToUpper()
if (!$CODE -or $CODE.Length -lt 2) { Write-ERR "Customer Code dite hobe!"; pause; exit 1 }

$ACADEMY = (Ask "Academy Name (e.g. Green Leaf Academy)").Trim()

$REPO    = (Ask "GitHub Repo Name (e.g. Client-1)").Trim()
if ($REPO -match "\s") {
    Write-WARN "Repo Name-e space thaka jabe na. Space 'dash' kora hochhe..."
    $REPO = $REPO -replace "\s+", "-"
    Write-WARN "New Repo Name: $REPO"
}

$GHUSER  = (Ask "GitHub Username" "shakibapon1234-maker").Trim()
if ($GHUSER -match "\s") {
    Write-ERR "GitHub Username-e space thakte pare na!"
    pause; exit 1
}

$PKG     = (Ask "Package (Basic/Pro/Custom)" "Basic").Trim()

Write-Host ""
Write-Host "  Institution Type:" -ForegroundColor DarkGray
Write-Host "    1 = Coaching Centre (default)" -ForegroundColor DarkGray
Write-Host "    2 = School" -ForegroundColor DarkGray
Write-Host "    3 = College" -ForegroundColor DarkGray
$INST_RAW = (Ask "Institution Type (1/2/3)" "1").Trim()
$INSTTYPE = switch ($INST_RAW) {
    "2" { "school" }
    "3" { "college" }
    default { "coaching" }
}

Write-Host ""
Write-Title "STEP 2: Supabase Credentials"
Write-Host ""
Write-WARN "Supabase -> Settings -> API theke nin"
Write-Host ""

$URL     = (Ask "Supabase Project URL (https://xxxx.supabase.co)").Trim()
if (!$URL -or !$URL.StartsWith("https://")) { Write-ERR "Valid Supabase URL din!"; pause; exit 1 }

$KEY     = (Ask "Supabase Anon Key (eyJhbGci...)").Trim()
if (!$KEY -or $KEY.Length -lt 30) { Write-ERR "Valid Anon Key din!"; pause; exit 1 }

$LICKEY  = (Ask "License Key (optional, Enter to skip)").Trim().ToUpper()

# -- STEP 3: Find source www/ folder -----------------------------
Write-Host ""
Write-Title "STEP 3: Source Project khoja hochhe..."
Write-Host ""

$SCRIPT_DIR = $PSScriptRoot
$WFA_ROOT   = $SCRIPT_DIR
$WWW_SRC    = Join-Path $WFA_ROOT "www"

if (!(Test-Path $WWW_SRC)) {
    Write-ERR "www/ folder paoa jaini: $WWW_SRC"
    Write-WARN "Age 'node build-www.js' chalun!"
    pause; exit 1
}
Write-OK "Source found: $WWW_SRC"

# -- STEP 4: Create client folder --------------------------------
$PARENT_DIR = Split-Path -Parent $SCRIPT_DIR
$CLIENT_DIR = Join-Path $PARENT_DIR $REPO

if (Test-Path $CLIENT_DIR) {
    $confirm = Ask "Folder '$REPO' already exists. Overwrite? (yes/no)" "no"
    if ($confirm -ne "yes") { Write-WARN "Cancelled."; pause; exit 0 }
    Remove-Item -Recurse -Force $CLIENT_DIR
}

Write-Host ""
Write-Title "STEP 4: Folder toiri o files copy hochhe..."
Write-Host ""

New-Item -ItemType Directory -Path $CLIENT_DIR -Force | Out-Null
Copy-Item -Path "$WWW_SRC\*" -Destination $CLIENT_DIR -Recurse -Force
Write-OK "Files copied to: $CLIENT_DIR"

# -- STEP 5: Write supabase-secrets.js (NOT stub.js) -------------
Write-Host ""
Write-Title "STEP 5: Client credentials file lekha hochhe..."
Write-Host ""

$TODAY   = (Get-Date -Format "yyyy-MM-dd")
$SITEURL = "https://$GHUSER.github.io/$REPO/"
$LICLINE = if ($LICKEY) { "`n  licenseKey:   `"$LICKEY`"," } else { "" }

$SECRETS_CONTENT = @"
// ================================================================
// Wings Fly Academy - Client Deployment Credentials
// Generated : $TODAY
// Customer  : $ACADEMY  |  Code: $CODE  |  Package: $PKG  |  Type: $INSTTYPE
// ================================================================
//
// This file is loaded AFTER supabase-secrets.stub.js in all HTML files.
//    It unconditionally sets window.WFA_SUPABASE_SECRETS with client-specific
//    credentials, overriding the empty stub. Object.freeze() prevents any
//    further runtime modification.
//
// Do NOT commit this file to a public repo.
// ================================================================

window.WFA_SUPABASE_SECRETS = {
  url:          "$URL",
  anonKey:      "$KEY",
  customerCode: "$CODE",$LICLINE
  package:      "$PKG",
  institutionType: "$INSTTYPE",
  deployedAt:   "$TODAY",
  siteUrl:      "$SITEURL",
};

// Freeze to prevent SecureStorage or any runtime code from overriding client creds
Object.freeze(window.WFA_SUPABASE_SECRETS);
"@

$SECRETS_PATH = Join-Path $CLIENT_DIR "js\core\supabase-secrets.js"
$SECRETS_CONTENT | Set-Content -Path $SECRETS_PATH -Encoding UTF8
Write-OK "Client credentials written: js/core/supabase-secrets.js"

$STUB_PATH = Join-Path $CLIENT_DIR "js\core\supabase-secrets.stub.js"
Write-OK "stub.js unchanged (stays as empty placeholder): js/core/supabase-secrets.stub.js"

# -- FIX 1: Overwrite supabase-standalone-creds.js with client's own creds --
# Without this, if WFA_SUPABASE_SECRETS is missing the file falls back to the
# MAIN project URL/key — causing certificate.html, exam.html etc. to hit the
# wrong database.
$STANDALONE_CREDS_CONTENT = @"
// Auto-generated for client: $ACADEMY ($CODE) on $TODAY
// Re-generated by new-client.ps1 — do NOT edit manually.
// Fallback here is THIS CLIENT's credentials, not the main WFA project.
(function () {
  const secrets = window.WFA_SUPABASE_SECRETS || {};
  const stored  = window.__WFA_SUPABASE_CREDS   || {};

  const _fallbackUrl = '$URL';
  const _fallbackKey = '$KEY';

  let url = stored.url || secrets.url || _fallbackUrl;
  const key = stored.anonKey || secrets.anonKey || secrets.anon_key || _fallbackKey;

  window.WFA_STANDALONE_SUPABASE = { url: url, key: key };
})();
"@
$STANDALONE_PATH = Join-Path $CLIENT_DIR "js\core\supabase-standalone-creds.js"
$STANDALONE_CREDS_CONTENT | Set-Content -Path $STANDALONE_PATH -Encoding UTF8
Write-OK "supabase-standalone-creds.js overwritten with client creds (main project fallback removed)"

# -- STEP 5B: Write to clients-metadata.js in main project -------
Write-Host "Updating main project clients-metadata.js..."
$META_PATH = Join-Path $WFA_ROOT "js\core\clients-metadata.js"
$existing_clients = @()
if (Test-Path $META_PATH) {
    $js_content = Get-Content -Path $META_PATH -Raw -Encoding UTF8

    # Robust JSON extraction: strip BOM and extract between [ and ]
    $clean_content = $js_content -replace "^\uFEFF", ""
    $first_b = $clean_content.IndexOf('[')
    $last_b  = $clean_content.LastIndexOf(']')
    if ($first_b -ge 0 -and $last_b -gt $first_b) {
        $json_raw = $clean_content.Substring($first_b, $last_b - $first_b + 1)
        try {
            $parsed = ConvertFrom-Json $json_raw
            if ($parsed -ne $null) {
                $existing_clients = @($parsed)
            }
        } catch {
            Write-WARN "clients-metadata.js parse error - starting fresh list."
            $existing_clients = @()
        }
    }
}

if ($existing_clients -isnot [array]) {
    $existing_clients = @($existing_clients)
}

$already_exists = $existing_clients | Where-Object { $_.customerCode -eq $CODE }
if ($already_exists) {
    Write-WARN "customerCode '$CODE' already exists in clients-metadata.js - skipping duplicate."
} else {
    $new_client = [PSCustomObject]@{
        id           = [Guid]::NewGuid().ToString()
        customerCode = $CODE
        academy      = $ACADEMY
        package      = $PKG
        institutionType = $INSTTYPE
        licenseKey   = $LICKEY
        supabaseUrl  = $URL
        createdAt    = (Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fffZ")
        notes        = "Auto-deployed via script"
    }
    $existing_clients += $new_client
}

$new_json = ConvertTo-Json $existing_clients -Depth 10
$new_meta_content = "window.WFA_AUTO_DEPLOYED_CLIENTS = $new_json;"
$new_meta_content | Set-Content -Path $META_PATH -Encoding UTF8
Write-OK "Clients metadata updated: js/core/clients-metadata.js"

# -- FIX 2: Also sync www/js/core/clients-metadata.js ----------------------
$WWW_META_PATH = Join-Path $WFA_ROOT "www\js\core\clients-metadata.js"
$new_meta_content | Set-Content -Path $WWW_META_PATH -Encoding UTF8
Write-OK "www/js/core/clients-metadata.js also synced (no manual build-www.js needed)"

# -- STEP 5C: Push clients-metadata.js to main admin repo --------
Write-Host ""
Write-Title "STEP 5C: Main admin repo-te clients-metadata.js push hochhe..."
Write-Host ""
Push-Location $WFA_ROOT
try {
    git add "js/core/clients-metadata.js"
    
    # Check if there are staged changes before committing
    $staged = git status --porcelain "js/core/clients-metadata.js"
    if ($staged) {
        git commit -m "chore: add client $CODE ($ACADEMY) to clients-metadata.js"
        if ($LASTEXITCODE -ne 0) { throw "git commit failed (exit $LASTEXITCODE)" }

        git push
        if ($LASTEXITCODE -ne 0) {
            Write-WARN "git push failed, attempting git pull --rebase..."
            git pull --rebase
            git push
            if ($LASTEXITCODE -ne 0) { throw "git push failed after rebase (exit $LASTEXITCODE)" }
        }
        Write-OK "Main repo updated — Client Manager-e notun client dekhabe."
    } else {
        Write-OK "No changes to commit for clients-metadata.js."
    }
} catch {
    Write-ERR "Main repo update hoyni: $($_.Exception.Message)"
    Write-WARN "Pore nije korun:"
    Write-Host "  git add js/core/clients-metadata.js" -ForegroundColor DarkGray
    Write-Host "  git commit -m 'add client $CODE'" -ForegroundColor DarkGray
    Write-Host "  git push" -ForegroundColor DarkGray
    Write-WARN "Eta na korle Client Manager-e notun client dekhabe na!"
} finally {
    Pop-Location
}

# -- STEP 6: Create .gitattributes --------------------------------
$GA = "* text=auto`n*.js text eol=lf`n*.html text eol=lf`n*.css text eol=lf"
$GA | Set-Content -Path (Join-Path $CLIENT_DIR ".gitattributes") -Encoding UTF8

# -- STEP 7: Git init and first commit ----------------------------
Write-Host ""
Write-Title "STEP 6: Git setup hochhe..."
Write-Host ""

Push-Location $CLIENT_DIR
git init -b main | Out-Null
git add -A | Out-Null
git commit -m "init: $ACADEMY ($CODE) - WFA Client Deployment" | Out-Null
Write-OK "Git initialized and committed (supabase-secrets.js included)"

# -- STEP 8: Ask to push ------------------------------------------
Write-Host ""
Write-WARN "Ekhon GitHub-e '$REPO' name-e ekta NEW (empty) repo toiri korun:"
Write-Host "  https://github.com/new" -ForegroundColor Blue
Write-Host ""
$push = Ask "GitHub repo toiri hoyeche? Push korbo? (yes/no)" "yes"

if ($push -eq "yes") {
    $REMOTE = "https://github.com/$GHUSER/$REPO.git"
    git remote add origin $REMOTE | Out-Null
    git push -u origin main
    if ($LASTEXITCODE -ne 0) {
        throw "GitHub-e push kora sambhob hoyni. GitHub username ($GHUSER) o repo name ($REPO) thik ache kina dekhe nin."
    }
    Write-OK "Pushed to: $REMOTE"
    Write-OK "Live site: $SITEURL"
} else {
    Write-WARN "Push kora hoyni. Pore nije korun:"
    Write-Host "  cd `"$CLIENT_DIR`"" -ForegroundColor DarkGray
    Write-Host "  git remote add origin https://github.com/$GHUSER/$REPO.git" -ForegroundColor DarkGray
    Write-Host "  git push -u origin main" -ForegroundColor DarkGray
}

Pop-Location

# -- STEP 9: Summary ----------------------------------------------
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
  Write-Host "  1. Client Supabase -> SQL Editor -> CLIENT_MASTER_SETUP.sql run korun"
  Write-Host "  2. GitHub repo -> Settings -> Pages -> main branch enable korun"
  Write-Host "  3. Main Dashboard -> Settings -> Client Manager -> License Key generate o assign korun"
  Write-Host "  4. Key-ti client-ke pathun (Incognito-te setup korte bolun)"
  Write-Host "  5. Bug fix update: main project rebuild (node build-www.js) -> client repo push"
  Write-Host ""
  # FIX 4: Make license lock consequence explicit
  if (!$LICKEY) {
      Write-Host "  [!] IMPORTANT: License Key ekhono assign kora hoyni!" -ForegroundColor Red
      Write-Host "  [!] Client prothombar app open korle LOCK hoe jabe." -ForegroundColor Red
      Write-Host "      Client Manager -> Generate -> client-ke pathun — AGEI!" -ForegroundColor Yellow
  } else {
      Write-OK "License Key assigned: $LICKEY"
  }
Write-Host ""
} catch {
    Write-ERR "Dukkhito, script chalakoline ekti truti ghotechhe:"
    Write-Host "  $($_.Exception.Message)" -ForegroundColor Red
    Write-WARN "Somossati somadhan korte uporer error-ti dekhe check korun."
} finally {
    pause
}
