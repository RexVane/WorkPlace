"""Archiving keeps original bytes and refuses paths outside the workspace."""

from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
import json
import tempfile
import unittest


PROJECT = Path(__file__).resolve().parents[3]
SPEC = spec_from_file_location("workplace_archive", PROJECT / "scripts/maintenance/archive.py")
archive = module_from_spec(SPEC)
SPEC.loader.exec_module(archive)


class ArchiveTest(unittest.TestCase):
    def setUp(self):
        # Fixtures are retained in the project's backups, like other old files.
        fixtures = PROJECT / "backups/verification/archive"
        fixtures.mkdir(parents=True, exist_ok=True)
        self.root = Path(tempfile.mkdtemp(prefix="archive-check-", dir=fixtures))
        self.previous_root = archive.ROOT
        archive.ROOT = self.root

    def tearDown(self):
        archive.ROOT = self.previous_root

    def write(self, name, data=b"retained bytes"):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return path

    def test_directory_and_overlapping_pattern_preserve_every_file(self):
        self.write("dist/nested/app.exe", b"program")
        self.write("dist/build.json", b"record")
        self.write("manifest.json", b"original manifest")
        destination = archive.archive(["dist", "dist/nested/*", "manifest.json"])
        self.assertFalse((self.root / "dist").exists())
        self.assertEqual((destination / "files/dist/nested/app.exe").read_bytes(), b"program")
        self.assertEqual((destination / "files/dist/build.json").read_bytes(), b"record")
        self.assertEqual((destination / "files/manifest.json").read_bytes(), b"original manifest")
        self.assertEqual(json.loads((destination / "manifest.json").read_text())["paths"], ["dist", "manifest.json"])

    def test_invalid_path_is_rejected_before_anything_moves(self):
        original = self.write("app.exe")
        for pattern in (".", "../outside", str(self.root.parent / "outside")):
            with self.subTest(pattern=pattern), self.assertRaises(ValueError):
                archive.archive(["app.exe", pattern])
            self.assertEqual(original.read_bytes(), b"retained bytes")

    def test_git_and_backups_are_protected(self):
        for name in (".git", ".GIT", "backups", "BACKUPS"):
            original = self.write(name + "/keep")
            with self.subTest(name=name), self.assertRaises(ValueError):
                archive.archive([name])
            self.assertEqual(original.read_bytes(), b"retained bytes")

    def test_repeated_name_keeps_both_versions(self):
        self.write("app.exe", b"first")
        first = archive.archive(["app.exe"])
        self.write("app.exe", b"second")
        second = archive.archive(["app.exe"])
        self.assertNotEqual(first, second)
        self.assertEqual((first / "files/app.exe").read_bytes(), b"first")
        self.assertEqual((second / "files/app.exe").read_bytes(), b"second")

    def test_no_matches_do_not_create_a_backup(self):
        self.assertIsNone(archive.archive(["absent-*.exe"]))
        self.assertFalse((self.root / "backups").exists())


if __name__ == "__main__":
    unittest.main()
