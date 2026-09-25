#!/usr/bin/env bash
set -e

echo "========================================================"
echo "              Finly - Uninstall Script"
echo "========================================================"
echo ""

# 1. Terminate running Finly processes
echo "[1/3] Closing running Finly instances..."
pkill -f "Finly" 2>/dev/null || true
pkill -f "finly" 2>/dev/null || true

# 2. Detect OS and remove application files
echo "[2/3] Removing application files..."
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    if [ -d "/Applications/Finly.app" ]; then
        rm -rf "/Applications/Finly.app"
        echo "Removed /Applications/Finly.app"
    fi
    DATA_DIR="$HOME/Library/Application Support/Finly"
else
    # Linux
    if [ -f "/usr/bin/finly" ]; then
        sudo rm -f "/usr/bin/finly" 2>/dev/null || rm -f "/usr/bin/finly" 2>/dev/null || true
    fi
    if [ -f "$HOME/.local/bin/finly" ]; then
        rm -f "$HOME/.local/bin/finly"
    fi
    if [ -f "/usr/share/applications/finly.desktop" ]; then
        sudo rm -f "/usr/share/applications/finly.desktop" 2>/dev/null || rm -f "/usr/share/applications/finly.desktop" 2>/dev/null || true
    fi
    if [ -f "$HOME/.local/share/applications/finly.desktop" ]; then
        rm -f "$HOME/.local/share/applications/finly.desktop"
    fi
    DATA_DIR="$HOME/.local/share/finly"
fi

# 3. Prompt user for data deletion
echo ""
read -p "[3/3] Do you also want to remove your local database and data ($DATA_DIR)? (y/N): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [ -d "$DATA_DIR" ]; then
        rm -rf "$DATA_DIR"
        echo "Local database and data removed."
    fi
else
    echo "Local database preserved in $DATA_DIR for future use."
fi

echo ""
echo "========================================================"
echo "        Finly uninstallation completed successfully."
echo "========================================================"
echo ""
