# Daily database backups to Google Drive

Destination: **TDNV_DRVN - Database Backups**, owned by **phonggttm@gmail.com**.

The workflow runs around **03:15 Vietnam time** (`15 20 * * *` UTC). GitHub
scheduled jobs can be delayed. It runs independently of Render and Vercel.

## Contents and encryption

- PostgreSQL 17 `pg_dump` custom archive, including application tables,
  `_prisma_migrations`, Supabase Auth users and other accessible database schemas.
- One consistent database snapshot per run; no application writes or downtime.
- rclone `crypt` encrypts the archive before uploading. Google Drive holds `.bin`
  files. The plaintext export is removed from the runner when the script exits.
- Each run verifies archive entries for `public.tasks` and `auth.users`, then
  downloads and decrypts the uploaded file to compare against the original.
- Existing backups are retained. This workflow does not delete old files.
- Supabase Storage file contents, project settings, API keys, Google OAuth app
  configuration, and hosting environment variables are not in the database dump.
  Completion evidence currently lives as database text in this app.

## One-time setup

1. Authorize rclone as `phonggttm@gmail.com` with `drive.file` scope. This scope
   only allows access to files/folders created or opened with the same OAuth app.
2. Create the destination folder using that same rclone authorization. Do not
   create a different folder with the same name and assume its ID is equivalent.
3. Prepare an rclone config with these remotes:

   ```ini
   [gdrive]
   type = drive
   scope = drive.file
   token = <OAuth token JSON, including refresh_token>
   root_folder_id = <verified destination folder ID>

   [backup]
   type = crypt
   remote = gdrive:
   filename_encryption = off
   directory_name_encryption = false
   password = <rclone-obscured random encryption password>
   password2 = <rclone-obscured random salt>
   ```

   File contents remain encrypted when filename encryption is off. rclone's
   `obscure` is not encryption for the config itself: treat this entire config as
   a secret. Keep a protected offline copy of the config and encryption keys.
   Losing the encryption keys makes the backups unusable.

4. Add repository secrets under GitHub **Settings → Secrets and variables → Actions**:

   | Secret | Value |
   |---|---|
   | `SUPABASE_BACKUP_DB_URL` | Supabase Session pooler URL, port **5432**, with database password and `sslmode=require` |
   | `RCLONE_BACKUP_CONFIG` | Entire rclone config above |

   GitHub-hosted runners need an IPv4-compatible connection. Use the Session
   pooler rather than the default IPv6 direct host or transaction pooler (6543).
   The database login needs read access to all relevant schemas, including Auth.

5. Run **Actions → Daily database backup to Google Drive → Run workflow**.
   Confirm success and the encrypted file in the correct Drive folder.
6. Set repository variable `DRIVE_BACKUP_ENABLED` to `true` after the first
   successful trial. Until then, scheduled runs skip the backup job.
7. Enable GitHub Actions failure notifications for your account/repository.
   Monitor for missing daily runs too: public-repo schedules can be disabled
   after 60 days without repository activity.

Custom Google OAuth apps left in **Testing** can issue refresh tokens that expire
after seven days. Use a suitable production/internal OAuth setup for long-term
operation. Revoked or expired Google access requires reauthorization and updating
the GitHub secret. Never paste tokens/passwords into issues, logs or chat.

## Recovery

Download using the saved rclone config through the `backup` crypt remote to
decrypt; do not pass the `.bin` file directly to `pg_restore`:

```bash
rclone --config /secure/path/rclone.conf lsf backup:
rclone --config /secure/path/rclone.conf copyto \
  backup:tdnv-drvn-<timestamp>-<run>-<attempt>.dump ./recovered.dump
pg_restore --list ./recovered.dump
```

Before relying on these backups, perform a restore drill into a separate,
compatible Supabase environment. A full dump contains managed Supabase schemas;
it must not be blindly restored over an existing live project. Align PostgreSQL
and Supabase versions, roles, extensions, schema ownership and encryption keys
as needed. Use Supabase's documented restore process for managed schemas.

Download verification proves transfer integrity and decryption, not that all
database objects can restore successfully. No production restore is automatic.
Daily backups can lose up to roughly one day of changes between successful runs.

## References

- [Supabase CLI backup/restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
- [Supabase automated backups](https://supabase.com/docs/guides/deployment/ci/backups)
- [rclone Google Drive](https://rclone.org/drive/)
- [rclone crypt](https://rclone.org/crypt/)
- [GitHub scheduled workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)
