#!/bin/bash
set -e

echo "========================================="
echo "  SEER Deployment Script"
echo "========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

check_command() {
  if ! command -v "$1" &> /dev/null; then
    echo -e "${RED}✗ $1 is not installed${NC}"
    return 1
  else
    echo -e "${GREEN}✓ $1 found${NC}"
    return 0
  fi
}

echo "Step 1: Checking prerequisites..."
echo "---"
check_command "node"
check_command "npm"
check_command "vercel" || echo -e "${YELLOW}  Install with: npm i -g vercel${NC}"
check_command "git"
echo ""

# ─── Step 2: Build MCP Server ───
echo "Step 2: Building MCP server..."
echo "---"
cd "$(dirname "$0")/.."
npm install
npx tsc
echo -e "${GREEN}✓ MCP server built successfully${NC}"
echo ""

# ─── Step 3: Build Website ───
echo "Step 3: Building website..."
echo "---"
cd web
npm install
npm run build
echo -e "${GREEN}✓ Website built successfully${NC}"
cd ..
echo ""

# ─── Step 4: Environment variables check ───
echo "Step 4: Checking environment variables..."
echo "---"

ENV_VARS=(
  "ANTHROPIC_API_KEY"
  "SUPABASE_URL"
  "SUPABASE_SERVICE_ROLE_KEY"
  "NEXT_PUBLIC_SUPABASE_URL"
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  "OPENAI_API_KEY"
  "DODO_API_KEY"
  "DODO_WEBHOOK_SECRET"
  "RAZORPAY_KEY_ID"
  "RAZORPAY_KEY_SECRET"
)

missing=0
for var in "${ENV_VARS[@]}"; do
  if [ -z "${!var}" ]; then
    echo -e "${YELLOW}⚠ $var not set${NC}"
    missing=$((missing + 1))
  else
    echo -e "${GREEN}✓ $var is set${NC}"
  fi
done

if [ $missing -gt 0 ]; then
  echo ""
  echo -e "${YELLOW}$missing env vars missing. Set them in Vercel dashboard or .env files.${NC}"
fi
echo ""

# ─── Step 5: Deploy ───
echo "Step 5: Deployment"
echo "---"
echo "To deploy, run these commands:"
echo ""
echo "  # MCP Server (deploy to mcp.seer.ai)"
echo "  cd $(pwd)"
echo "  vercel --prod"
echo ""
echo "  # Website (deploy to seer.ai)"
echo "  cd $(pwd)/web"
echo "  vercel --prod"
echo ""
echo "After deploying, configure in Vercel dashboard:"
echo "  1. Set all environment variables listed above"
echo "  2. Add custom domains: seer.ai (website) + mcp.seer.ai (MCP)"
echo "  3. Register webhook URLs:"
echo "     - Dodo:     https://seer.ai/api/webhook/dodo"
echo "     - Razorpay: https://seer.ai/api/webhook/razorpay"
echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}  Ready to deploy!${NC}"
echo -e "${GREEN}=========================================${NC}"
