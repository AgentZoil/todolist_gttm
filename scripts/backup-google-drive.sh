#!/usr/bin/env bash
# Back up PostgreSQL to an encrypted rclone Google Drive remote.
set -euo pipefail
umask 077

for key in SUPABASE_BACKUP_DB_URL RCLONE_BACKUP_CONFIG; do
  if [[ -z "${!key:-}" ]]; then
    printf 'Missing required secret: %s\n' "$key" >&2
    exit 1
  fi
done
for tool in docker rclone python3; do
  command -v "$tool" >/dev/null || { printf 'Missing tool: %s\n' "$tool" >&2; exit 1; }
done

work_dir=$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/tdnv-backup.XXXXXX")
trap 'rm -rf "$work_dir"' EXIT
config_file="$work_dir/rclone.conf"
printf '%s\n' "$RCLONE_BACKUP_CONFIG" > "$config_file"
unset RCLONE_BACKUP_CONFIG

# Refuse a plaintext or incorrectly targeted remote before exporting any data.
python3 - "$config_file" <<'PY'
import configparser
import sys

config = configparser.RawConfigParser()
config.read(sys.argv[1])
valid = (
    config.get('backup', 'type', fallback='') == 'crypt'
    and config.get('backup', 'remote', fallback='') == 'gdrive:'
    and bool(config.get('backup', 'password', fallback=''))
    and config.get('gdrive', 'type', fallback='') == 'drive'
    and bool(config.get('gdrive', 'root_folder_id', fallback=''))
    and bool(config.get('gdrive', 'token', fallback=''))
)
if not valid:
    sys.exit('Backup config must contain an encrypted backup remote and a dedicated Google Drive folder.')
PY

mkdir "$work_dir/data"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup_name="tdnv-drvn-${stamp}-${GITHUB_RUN_ID:-manual}-${GITHUB_RUN_ATTEMPT:-1}.dump"
postgres_image="${POSTGRES_BACKUP_IMAGE:-postgres:17-alpine}"

# PGDATABASE accepts a connection URI. Pass it via the environment, never argv.
# pg_dump takes a consistent snapshot, including public, Auth and migrations.
export PGDATABASE="$SUPABASE_BACKUP_DB_URL"
unset SUPABASE_BACKUP_DB_URL
export PGCONNECT_TIMEOUT=30

printf 'Creating PostgreSQL backup...\n'
docker run --rm \
  --user "$(id -u):$(id -g)" \
  --env PGDATABASE --env PGCONNECT_TIMEOUT \
  --volume "$work_dir/data:/backup" \
  "$postgres_image" \
  pg_dump --format=custom --no-owner --no-privileges \
    --lock-wait-timeout=30000 --file="/backup/$backup_name"
unset PGDATABASE

test -s "$work_dir/data/$backup_name"
docker run --rm \
  --user "$(id -u):$(id -g)" \
  --volume "$work_dir/data:/backup:ro" \
  "$postgres_image" \
  pg_restore --list "/backup/$backup_name" > "$work_dir/archive-list.txt"
grep -Eq 'TABLE DATA public tasks([[:space:]]|$)' "$work_dir/archive-list.txt"
grep -Eq 'TABLE DATA auth users([[:space:]]|$)' "$work_dir/archive-list.txt"

printf 'Uploading encrypted backup to Google Drive...\n'
rclone --config "$config_file" copyto \
  "$work_dir/data/$backup_name" "backup:$backup_name" \
  --retries 3 --low-level-retries 10

# Download through the crypt remote and compare plaintext, end to end.
# This verifies transfer and decryption; it does not replace a restore drill.
printf 'Verifying uploaded backup by downloading and decrypting...\n'
rclone --config "$config_file" check \
  "$work_dir/data" backup: --one-way --download \
  --retries 3 --low-level-retries 10

printf 'Backup uploaded and verified: %s\n' "$backup_name"
if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  {
    printf '### PostgreSQL backup completed\n\n'
    printf -- '- Archive: `%s`\n' "$backup_name"
    printf -- '- Destination: TDNV_DRVN - Database Backups\n'
    printf -- '- Encryption and download verification: passed\n'
    printf -- '- Existing backups: preserved\n'
  } >> "$GITHUB_STEP_SUMMARY"
fi
