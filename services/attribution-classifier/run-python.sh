#!/bin/sh
set -eu

python_bin=".venv/bin/python"

# A Rosetta-hosted Node/npm process otherwise selects the x86_64 slice of a
# universal Python binary, which cannot load arm64 wheels from a native venv.
if [ "$(uname -s)" = "Darwin" ] &&
  [ "$(sysctl -n hw.optional.arm64 2>/dev/null || echo 0)" = "1" ]; then
  exec arch -arm64 "$python_bin" "$@"
fi

exec "$python_bin" "$@"
