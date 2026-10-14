import sys
from pathlib import Path

# Ensure root directory is in sys.path for cairnwise module discovery
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from cairnwise.api import app  # noqa: E402

__all__ = ["app"]
