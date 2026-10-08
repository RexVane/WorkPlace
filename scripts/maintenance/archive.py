"""Move generated project files into backups, preserving names and directories."""

from datetime import datetime
from pathlib import Path
import json
import sys


ROOT = Path(__file__).resolve().parents[2]


def collect(patterns):
    paths = set()
    for pattern in patterns:
        relative = Path(pattern)
        if not relative.parts or relative.is_absolute() or relative.anchor or ".." in relative.parts:
            raise ValueError(f"Use a path inside the project: {pattern}")
        for source in ROOT.glob(pattern):
            resolved = source.resolve()
            if source == ROOT or not resolved.is_relative_to(ROOT):
                raise ValueError(f"Path leaves the project: {source}")
            if source.relative_to(ROOT).parts[0].casefold() in {".git", "backups"}:
                raise ValueError(f"Protected directory: {source}")
            paths.add(source)
    # A directory is moved whole; a second pattern may have named its files.
    return [p for p in sorted(paths) if not any(parent in paths for parent in p.parents)]


def archive(patterns):
    sources = collect(patterns)
    if not sources:
        return None
    base = ROOT / "backups"
    if not base.resolve().is_relative_to(ROOT):
        raise ValueError("The backups directory must stay inside the project")
    base.mkdir(exist_ok=True)
    module = base / "go.mod"
    if not module.exists():
        module.write_text("module workplace.local/backups\n\ngo 1.26.0\n", encoding="utf-8")
    destination = base / ("archive-" + datetime.now().strftime("%Y%m%d-%H%M%S-%f"))
    destination.mkdir()
    records = []
    for source in sources:
        relative = source.relative_to(ROOT)
        target = destination / "files" / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        source.rename(target)
        records.append(relative.as_posix())
        (destination / "manifest.json").write_text(
            json.dumps({"paths": records}, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    print(f"Archived {len(records)} paths to {destination.relative_to(ROOT)}")
    return destination


if __name__ == "__main__":
    try:
        archive(sys.argv[1:])
    except (OSError, ValueError) as error:
        sys.exit(str(error))
