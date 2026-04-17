#!/usr/bin/env bash
# SEER Installer — https://seer.ai/install.sh
# Usage: curl -fsSL https://seer.ai/install.sh | bash

set -e

BOLD="\033[1m"
RESET="\033[0m"
GREEN="\033[32m"
YELLOW="\033[33m"
RED="\033[31m"
CYAN="\033[36m"

echo ""
echo -e "${BOLD}SEER — Master Control Protocol${RESET}"
echo -e "Installing the SEER desktop app for your platform…"
echo ""

OS="$(uname -s)"
ARCH="$(uname -m)"
GH_BASE="https://github.com/codemodeai/seer/releases/latest/download"

case "$OS" in
  Darwin)
    if [ "$ARCH" = "arm64" ]; then
      URL="$GH_BASE/SEER_aarch64.dmg"
      FILE="SEER_aarch64.dmg"
    else
      URL="$GH_BASE/SEER_x64.dmg"
      FILE="SEER_x64.dmg"
    fi
    echo -e "${CYAN}Platform:${RESET} macOS ($ARCH)"
    echo -e "${CYAN}Downloading:${RESET} $FILE"
    curl -L -# -o "/tmp/$FILE" "$URL"
    echo ""
    echo -e "${GREEN}Opening installer…${RESET}"
    open "/tmp/$FILE"
    echo ""
    echo -e "${BOLD}Done!${RESET} Install SEER from the .dmg, then open it and sign in."
    ;;

  Linux)
    if [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
      URL="$GH_BASE/SEER_aarch64.AppImage"
      FILE="SEER_aarch64.AppImage"
    else
      URL="$GH_BASE/SEER_x64.AppImage"
      FILE="SEER_x64.AppImage"
    fi
    INSTALL_DIR="$HOME/.local/bin"
    mkdir -p "$INSTALL_DIR"
    echo -e "${CYAN}Platform:${RESET} Linux ($ARCH)"
    echo -e "${CYAN}Downloading:${RESET} $FILE → $INSTALL_DIR/seer"
    curl -L -# -o "$INSTALL_DIR/seer" "$URL"
    chmod +x "$INSTALL_DIR/seer"
    echo ""
    echo -e "${GREEN}Installed to $INSTALL_DIR/seer${RESET}"
    echo ""
    echo -e "Run ${BOLD}seer${RESET} to launch, or add $INSTALL_DIR to your PATH if not already present."
    ;;

  MINGW*|CYGWIN*|MSYS*)
    echo -e "${YELLOW}Windows detected.${RESET}"
    echo ""
    echo -e "Download the SEER installer for Windows:"
    echo -e "  ${CYAN}$GH_BASE/SEER_x64-setup.exe${RESET}"
    echo ""
    echo -e "Or visit ${BOLD}https://seer.ai/download${RESET} and click 'Download for Windows'."
    ;;

  *)
    echo -e "${RED}Unsupported OS: $OS${RESET}"
    echo -e "Visit ${BOLD}https://seer.ai/download${RESET} to download for your platform."
    exit 1
    ;;
esac

echo ""
echo -e "${BOLD}Next steps:${RESET}"
echo -e "  1. Open SEER and sign in (or create a free account at seer.ai)"
echo -e "  2. Open SEER Chat and type any task"
echo -e "  3. Go to Settings → Connections to wire up Claude Code or any AI tool"
echo ""
