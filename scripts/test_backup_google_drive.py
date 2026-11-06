"""Check backup failure handling without connecting to production services."""

import os
from pathlib import Path
import subprocess
import tempfile
import unittest


SCRIPT = Path(__file__).with_name("backup-google-drive.sh")
CONFIG = """[gdrive]
type = drive
root_folder_id = test-folder
token = {"refresh_token":"test-only"}
[backup]
type = crypt
remote = gdrive:
password = test-only
"""

FAKE_TOOL = """#!/usr/bin/env python3
import os
from pathlib import Path
import sys

tool = Path(sys.argv[0]).name
args = sys.argv[1:]
with open(os.environ['TEST_LOG'], 'a') as log:
    log.write(tool + ' ' + (' '.join(args) if tool == 'rclone' else 'postgres') + '\\n')
if tool == 'docker':
    if 'pg_dump' in args:
        if os.environ.get('TEST_FAILURE') == 'dump': sys.exit(1)
        mount = args[args.index('--volume') + 1].split(':')[0]
        name = next(a for a in args if a.startswith('--file=')).split('/')[-1]
        Path(mount, name).write_bytes(b'PGDMP-test-fixture')
    elif 'pg_restore' in args:
        print('1; 0 1 TABLE DATA public tasks postgres')
        if os.environ.get('TEST_FAILURE') != 'missing-auth':
            print('2; 0 2 TABLE DATA auth users postgres')
elif tool == 'rclone':
    if 'copyto' in args and os.environ.get('TEST_FAILURE') == 'upload': sys.exit(1)
    if 'check' in args and os.environ.get('TEST_FAILURE') == 'verify': sys.exit(1)
"""


class BackupFailureTests(unittest.TestCase):
    def run_backup(self, failure="", config=CONFIG, include_secret=True):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            bin_dir = root / "bin"
            bin_dir.mkdir()
            for name in ("docker", "rclone"):
                tool = bin_dir / name
                tool.write_text(FAKE_TOOL)
                tool.chmod(0o700)
            env = {
                **os.environ,
                "PATH": str(bin_dir) + os.pathsep + os.environ["PATH"],
                "RUNNER_TEMP": str(root),
                "SUPABASE_BACKUP_DB_URL": "postgresql://test-only.invalid/db",
                "RCLONE_BACKUP_CONFIG": config,
                "TEST_LOG": str(root / "calls.log"),
                "TEST_FAILURE": failure,
                "GITHUB_STEP_SUMMARY": str(root / "summary.md"),
            }
            if not include_secret:
                del env["SUPABASE_BACKUP_DB_URL"]
            result = subprocess.run(["bash", str(SCRIPT)], env=env, capture_output=True, text=True)
            calls = (root / "calls.log").read_text() if (root / "calls.log").exists() else ""
            self.assertNotIn("test-only.invalid", result.stdout + result.stderr + calls)
            self.assertEqual(list(root.glob("tdnv-backup.*")), [], "Temporary plaintext/config must be removed")
            return result, calls

    def test_missing_secret_stops_before_export(self):
        result, calls = self.run_backup(include_secret=False)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(calls, "")

    def test_plaintext_remote_rejected_before_export(self):
        result, calls = self.run_backup(config=CONFIG.replace("type = crypt", "type = alias"))
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(calls, "")

    def test_failed_dump_never_uploads(self):
        result, calls = self.run_backup(failure="dump")
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn("rclone", calls)

    def test_backup_missing_auth_never_uploads(self):
        result, calls = self.run_backup(failure="missing-auth")
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn("rclone", calls)

    def test_upload_failure_stops_before_verification(self):
        result, calls = self.run_backup(failure="upload")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("copyto", calls)
        self.assertNotIn(" check ", calls)

    def test_verification_failure_fails_job(self):
        result, calls = self.run_backup(failure="verify")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(" check ", calls)
        self.assertNotIn("Backup uploaded and verified:", result.stdout)

    def test_success_verifies_encrypted_remote_and_preserves_existing_backups(self):
        result, calls = self.run_backup()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("copyto", calls)
        self.assertIn("--one-way --download", calls)
        self.assertNotIn("delete", calls)
        self.assertIn("Backup uploaded and verified:", result.stdout)


if __name__ == "__main__":
    unittest.main()
