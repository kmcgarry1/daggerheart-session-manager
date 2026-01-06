#!/usr/bin/env bash
set -euo pipefail

CSV_PATH="${1:-team-lead-review-issues.csv}"
REPO="${2:-}"

if [ ! -f "$CSV_PATH" ]; then
  echo "CSV not found: $CSV_PATH" >&2
  exit 1
fi

if [ -z "$REPO" ] && command -v gh >/dev/null 2>&1; then
  if gh repo view --json nameWithOwner -q .nameWithOwner >/dev/null 2>&1; then
    REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
  fi
fi

if [ -z "$REPO" ] && git remote get-url origin >/dev/null 2>&1; then
  REPO_URL="$(git remote get-url origin)"
  REPO="$(python3 - <<'PY'
import os
import re
import sys

url = os.environ.get("REPO_URL", "")
match = re.search(r"github\.com[:/](.+?)(?:\.git)?$", url)
if not match:
  sys.exit(1)
print(match.group(1))
PY
  )"
fi

if [ -z "$REPO" ]; then
  echo "Unable to determine repo. Pass as second arg: ./create-issues.sh path/to.csv OWNER/REPO" >&2
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI not found. Install: https://cli.github.com/" >&2
  exit 1
fi

if ! gh auth status -h github.com >/dev/null 2>&1; then
  echo "gh CLI not authenticated. Run: gh auth login" >&2
  exit 1
fi

CSV_PATH="$CSV_PATH" REPO="$REPO" python3 - <<'PY'
import csv
import os
import subprocess
import sys

csv_path = os.environ["CSV_PATH"]
repo = os.environ["REPO"]
required = {"title", "body", "labels"}

with open(csv_path, newline="", encoding="utf-8") as file:
  reader = csv.DictReader(file)
  fieldnames = set(reader.fieldnames or [])
  if not required.issubset(fieldnames):
    sys.stderr.write("CSV must have headers: title, body, labels\n")
    sys.exit(1)

  for row in reader:
    title = (row.get("title") or "").strip()
    body = row.get("body") or ""
    labels = (row.get("labels") or "").strip()
    if not title:
      continue

    args = [
      "gh",
      "issue",
      "create",
      "--repo",
      repo,
      "--title",
      title,
      "--body",
      body,
    ]
    if labels:
      args += ["--label", labels]

    print(f"Creating: {title}")
    subprocess.run(args, check=True)
PY
