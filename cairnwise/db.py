"""Small SQLite persistence adapter for the local foundation.

The schema is relational and keeps registry, observations, assessments,
evidence, cases, and events separate.  SQLite is used for the first local
vertical slice because it is available in the Python runtime without a
service.  The SQL intentionally avoids document-only storage and keeps the
repository boundary small enough to move to PostgreSQL when deployment is
locked.
"""

from __future__ import annotations

import hashlib
import json
import os
import sqlite3
import threading
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator


ROOT = Path(__file__).resolve().parents[1]


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex}"


def json_text(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def sha256_json(value: Any) -> str:
    return hashlib.sha256(json_text(value).encode("utf-8")).hexdigest()


class Database:
    """Thread-safe database wrapper used by the synchronous service methods."""

    def __init__(self, path: str | os.PathLike[str] | None = None):
        configured = path or os.getenv("CAIRNWISE_DB_PATH")
        if not configured and os.getenv("VERCEL"):
            configured = "/tmp/cairnwise.db"
        self.path = Path(configured) if configured else ROOT / "data" / "cairnwise.db"
        if self.path != Path(":memory:"):
            self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        self._connection = sqlite3.connect(
            ":memory:" if str(self.path) == ":memory:" else str(self.path),
            check_same_thread=False,
        )
        self._connection.row_factory = sqlite3.Row
        self._connection.execute("PRAGMA foreign_keys = ON")
        self._connection.execute("PRAGMA busy_timeout = 5000")
        if str(self.path) != ":memory:":
            self._connection.execute("PRAGMA journal_mode = WAL")

    def initialize(self) -> None:
        schema = (Path(__file__).with_name("schema.sql")).read_text(encoding="utf-8")
        with self._lock:
            self._connection.executescript(schema)
            # Keep local development databases forward-compatible while the
            # schema is still in foundation phase.  PostgreSQL migrations will
            # replace this small SQLite compatibility step before deployment.
            columns = {
                row["name"]
                for row in self._connection.execute("PRAGMA table_info(assessments)").fetchall()
            }
            if "assessment_json" not in columns:
                self._connection.execute(
                    "ALTER TABLE assessments ADD COLUMN assessment_json TEXT NOT NULL DEFAULT '{}'"
                )
            # Local SQLite databases from Phase 1 predate the source-rights,
            # retention, export-audit, and deletion-proof fields.  Keep the
            # migration deliberately additive so existing fixture data remains
            # readable and no user database is silently replaced.
            migrations = {
                "connectors": {
                    "rights_json": "TEXT NOT NULL DEFAULT '{}'",
                    "permissions": "TEXT",
                    "terms_basis": "TEXT",
                    "retention_class": "TEXT NOT NULL DEFAULT 'metadata_180d'",
                    "image_rights": "TEXT",
                    "owner": "TEXT",
                },
                "source_runs": {
                    "availability_state": "TEXT NOT NULL DEFAULT 'available'",
                    "source_rights_json": "TEXT NOT NULL DEFAULT '{}'",
                },
                "observations": {
                    "retention_class": "TEXT NOT NULL DEFAULT 'metadata_180d'",
                    "retention_expires_at": "TEXT",
                    "legal_hold": "INTEGER NOT NULL DEFAULT 0",
                    "deleted_at": "TEXT",
                    "deletion_proof_id": "TEXT",
                },
                "evidence": {
                    "retention_class": "TEXT NOT NULL DEFAULT 'metadata_180d'",
                    "retention_expires_at": "TEXT",
                    "legal_hold": "INTEGER NOT NULL DEFAULT 0",
                    "deleted_at": "TEXT",
                    "deletion_proof_id": "TEXT",
                },
            }
            for table, table_columns in migrations.items():
                present = {
                    row["name"]
                    for row in self._connection.execute(f"PRAGMA table_info({table})").fetchall()
                }
                for name, declaration in table_columns.items():
                    if name not in present:
                        self._connection.execute(f"ALTER TABLE {table} ADD COLUMN {name} {declaration}")
            # Phase 1 rows have no expiry.  They are normalized metadata and
            # receive the declared default class; the service can then apply
            # the regular retention preview without special cases.
            self._connection.execute(
                """
                UPDATE observations
                   SET retention_class = COALESCE(NULLIF(retention_class, ''), 'metadata_180d'),
                       retention_expires_at = COALESCE(
                           retention_expires_at,
                           datetime(collected_at, '+180 days')
                       )
                 WHERE deleted_at IS NULL
                """
            )
            self._connection.execute(
                """
                UPDATE evidence
                   SET retention_class = COALESCE(NULLIF(retention_class, ''), 'metadata_180d'),
                       retention_expires_at = COALESCE(
                           retention_expires_at,
                           datetime(created_at, '+180 days')
                       )
                 WHERE deleted_at IS NULL
                """
            )
            self._connection.commit()

    @contextmanager
    def transaction(self) -> Iterator[sqlite3.Connection]:
        with self._lock:
            try:
                yield self._connection
                self._connection.commit()
            except Exception:
                self._connection.rollback()
                raise

    def execute(self, sql: str, params: tuple[Any, ...] = ()) -> sqlite3.Cursor:
        with self._lock:
            return self._connection.execute(sql, params)

    def fetch_one(self, sql: str, params: tuple[Any, ...] = ()) -> sqlite3.Row | None:
        with self._lock:
            return self._connection.execute(sql, params).fetchone()

    def fetch_all(self, sql: str, params: tuple[Any, ...] = ()) -> list[sqlite3.Row]:
        with self._lock:
            return self._connection.execute(sql, params).fetchall()

    def close(self) -> None:
        with self._lock:
            self._connection.close()


def row_dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
    return dict(row) if row is not None else None
