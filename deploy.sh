#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

COMMIT_MSG="${1:-UpdateLogic}"

git add .
git commit -m "$COMMIT_MSG" || true
git push -u origin main --force
npm run build
firebase deploy --only hosting
