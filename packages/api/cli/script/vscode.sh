#!/usr/bin/env bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

ARGS=$@
ARGS=${ARGS// /\~ \~}

if [ -f "$DIR/../../../@electron-forge/cli/dist/electron-forge-start" ]; then
  node "$DIR/../../../@electron-forge/cli/dist/electron-forge-start" --vscode -- \~$ARGS\~
else
  node "$DIR/../@electron-forge/cli/dist/electron-forge-start" --vscode -- \~$ARGS\~
fi
