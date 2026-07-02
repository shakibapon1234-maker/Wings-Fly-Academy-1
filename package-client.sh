#!/bin/bash
# ================================================================
# Wings Fly Academy - Client Packaging Script (Bash)
# Run this script to package the client folder into a clean ZIP
# automatically excluding gitignored/secret files.
# Usage: ./package-client.sh
# ================================================================

# Colors for output
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Determine source directory (where script is located)
SRC_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_NAME=$(basename "$SRC_DIR")
DEFAULT_ZIP="../${PROJECT_NAME}-packaged.zip"

clear
echo -e "${CYAN}=============================================${NC}"
echo -e "${CYAN}   Wings Fly Academy - Client Packager (SH)  ${NC}"
echo -e "${CYAN}=============================================${NC}"
echo "Ei script chalale project theke sob gitignored"
echo "secrets (VAPID, supabase-secrets.js, etc.) baad"
echo "diye ekta clean ZIP package toiri hobe."
echo ""
echo "Source Directory: $SRC_DIR"
echo ""

read -p "Zip output path [$DEFAULT_ZIP]: " user_zip
ZIP_PATH=${user_zip:-$DEFAULT_ZIP}

# Check if file already exists
if [ -f "$ZIP_PATH" ]; then
    read -p "File already exists. Overwrite? (yes/no) [no]: " confirm
    if [ "$confirm" != "yes" ]; then
        echo -e "${YELLOW}[!] Cancelled.${NC}"
        exit 0
    fi
    rm -f "$ZIP_PATH"
fi

echo -e "\n${CYAN}STEP 1: Compressing folder to ZIP (excluding secrets)...${NC}"

# Run zip command with strict exclusions
zip -r "$ZIP_PATH" . \
  -x "*.git*" \
  -x "*node_modules*" \
  -x "*supabase-secrets.js" \
  -x "*license-server-config.js" \
  -x "*VAPID_PRIVATE_KEY.local.md" \
  -x "*.vapid-private.*" \
  -x "*.env*" \
  -x "*.zip" \
  -x "*.rar" \
  -x "*.log" \
  -x "*.tmp" \
  -x "*.temp" \
  -x "*.DS_Store" \
  -x "*Thumbs.db" \
  -x "*desktop.ini" \
  -x "*android/app/build*" \
  -x "*android/build*" \
  -x "*android/.gradle*" \
  -x "*.vscode*" \
  -x "*.idea*"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}[OK] ZIP file created successfully: $ZIP_PATH${NC}"
    echo -e "\n${GREEN}=============================================${NC}"
    echo -e "${GREEN}   PACKAGING COMPLETE SUCCESSFULLY!          ${NC}"
    echo -e "${GREEN}=============================================${NC}\n"
else
    echo -e "${RED}[X] Error: Failed to create ZIP.${NC}"
fi
