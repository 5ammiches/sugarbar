#!/usr/bin/env bash
set -euxo pipefail

PROFILE_DIR="${MUSIXMATCH_PROFILE_PATH:-/root/.crawl4ai/profiles/musixmatch}"
echo "start.sh running; PROFILE_DIR=${PROFILE_DIR}"

remove_singleton() {
  local path="$1"
  if [ -L "$path" ]; then
    local target
    target="$(readlink -f "$path" || true)"
    echo "Removing symlink: $path -> ${target:-<unresolved>}"
    rm -f -- "$path" || true
    if [ -n "${target:-}" ] && printf '%s' "$target" | grep -q '/tmp/.org.chromium.'; then
      local d
      d="$(dirname "$target")"
      echo "Removing Chromium temp dir: $d"
      rm -rf -- "$d" || true
    fi
  elif [ -e "$path" ]; then
    echo "Removing file: $path"
    rm -f -- "$path" || true
  else
    echo "Not present: $path"
  fi
}

for name in SingletonLock SingletonCookie SingletonSemaphore SingletonSocket; do
  remove_singleton "${PROFILE_DIR}/${name}"
done

exec "$@"
