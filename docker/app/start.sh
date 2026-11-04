#!/bin/sh
set -eu
npm run build
STANDALONE_DIR=$(dirname "$(find .next/standalone -name server.js -not -path '*/node_modules/*' | head -1)")
cp -r public "$STANDALONE_DIR/"
cp -r .next/static "$STANDALONE_DIR/.next/"
exec node "$STANDALONE_DIR/server.js"
