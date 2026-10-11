"""Build an installable extension ZIP without development dependencies."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import json
import hashlib

root = Path(__file__).resolve().parent.parent
extension = root / "xExtension-PodcastPlayer"
version = json.loads((extension / "metadata.json").read_text())["version"]
destination = root / "dist" / f"PodcastPlayer-{version}.zip"
destination.parent.mkdir(exist_ok=True)
with ZipFile(destination, "w", ZIP_DEFLATED) as archive:
    for name in ("metadata.json", "extension.php", "configure.phtml", "PodcastRenderer.php", "static/player.js", "static/player.css"):
        archive.write(extension / name, f"{extension.name}/{name}")
    for name in ("README.md", "LICENSE"):
        archive.write(root / name, f"{extension.name}/{name}")
checksum = hashlib.sha256(destination.read_bytes()).hexdigest()
destination.with_suffix(".zip.sha256").write_text(f"{checksum}  {destination.name}\n")
print(destination)
