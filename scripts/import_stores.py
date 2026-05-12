"""
Bulk-imports BDI's customer registry into supermarkets.

Source: hariltsagchid_files/sheet001.htm (saved-as-html from Excel).
Pass the path on the command line, or it defaults to the standard location
on Munkhdorj's desktop.

Matching by external_id (BDI's internal registration number) keeps the
import idempotent: re-running updates changed rows in place instead of
making duplicates.

USAGE
    python scripts/import_stores.py --dry-run    # preview
    python scripts/import_stores.py              # do it
    python scripts/import_stores.py "C:/path/to/sheet001.htm"

ENV (read from web/.env.local):
    NEXT_PUBLIC_SUPABASE_URL
    SUPABASE_SERVICE_ROLE_KEY
"""

from __future__ import annotations

import io
import sys
import unicodedata
from pathlib import Path
from typing import Iterator

import pandas as pd
import requests


# ---- utf-8 stdout on Windows --------------------------------------------

def _force_utf8_stdout() -> None:
    if hasattr(sys.stdout, "buffer"):
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")


# ---- env loader ---------------------------------------------------------

def load_env(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    if not path.exists():
        return env
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


# ---- helpers ------------------------------------------------------------

def norm(value) -> str | None:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    s = unicodedata.normalize("NFC", str(value)).strip()
    s = " ".join(s.split())  # collapse multiple spaces
    return s if s else None


def build_notes(company: str | None, manager: str | None, internal: str | None) -> str | None:
    bits: list[str] = []
    if company:
        bits.append(f"Компани: {company}")
    if internal:
        bits.append(f"Дотоод код: {internal}")
    if manager:
        bits.append(f"Менежер: {manager}")
    return "\n".join(bits) if bits else None


def parse(df: pd.DataFrame) -> Iterator[dict]:
    """Walk the data rows. First row is the column headers."""
    df.columns = df.iloc[0]
    rows = df.iloc[1:]
    for _, row in rows.iterrows():
        external_id = norm(row.get("Бүртгэлийн  дугаар"))
        if not external_id:
            continue
        status = norm(row.get("Төлөв"))
        if status not in {"Хэвийн"}:
            continue
        branch = norm(row.get("Цэгийн нэр"))
        company = norm(row.get("Компани"))
        # Prefer branch name; fall back to company name
        name = branch or company
        if not name:
            continue
        yield {
            "external_id": external_id,
            "name": name,
            "type": norm(row.get("Төрөл")),
            "district": norm(row.get("Дүүрэг")),
            "address": norm(row.get("Хаяг")),
            "contact_phone": norm(row.get("Утас")),
            "notes": build_notes(
                company if branch else None,  # if we used company as name, don't duplicate it
                norm(row.get("Менежер")),
                norm(row.get("дотоод код")),
            ),
            "active": True,
        }


# ---- Supabase HTTP ------------------------------------------------------

class Supabase:
    def __init__(self, url: str, service_key: str) -> None:
        self.url = url.rstrip("/")
        self.headers = {
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
        }

    def upsert_supermarkets(self, rows: list[dict]) -> None:
        # PostgREST will upsert on the unique key external_id.
        r = requests.post(
            f"{self.url}/rest/v1/supermarkets",
            headers={
                **self.headers,
                "Content-Type": "application/json",
                "Prefer": "resolution=merge-duplicates,return=minimal",
            },
            params={"on_conflict": "external_id"},
            json=rows,
            timeout=120,
        )
        if not r.ok:
            raise RuntimeError(f"{r.status_code}: {r.text[:500]}")


# ---- main ---------------------------------------------------------------

DEFAULT_PATH = Path(
    "C:/Users/Munkhdorj/Downloads/hariltsagchid_files/sheet001.htm"
)


def main() -> int:
    _force_utf8_stdout()
    args = sys.argv[1:]
    dry_run = "--dry-run" in args
    positional = [a for a in args if not a.startswith("--")]
    src = Path(positional[0]) if positional else DEFAULT_PATH
    if not src.exists():
        print(f"ERROR: file not found: {src}", file=sys.stderr)
        return 1

    print(f"Reading {src} ...")
    tables = pd.read_html(str(src), encoding="utf-8")
    if not tables:
        print("ERROR: no tables in file", file=sys.stderr)
        return 1
    biggest = max(tables, key=lambda t: t.shape[0])
    print(f"Found {biggest.shape[0]} rows.\n")

    rows = list(parse(biggest))
    print(f"Parsed {len(rows)} active customer rows.\n")

    # Sample preview
    print("Sample (first 5):")
    for r in rows[:5]:
        print(f"  [{r['external_id']}] {r['name']}  ({r['contact_phone'] or '—'})")
    print()

    if dry_run:
        print("--dry-run set; no DB writes.")
        return 0

    env = load_env(Path(__file__).resolve().parent.parent / "web" / ".env.local")
    url = env.get("NEXT_PUBLIC_SUPABASE_URL")
    service_key = env.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not service_key:
        print(
            "ERROR: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in web/.env.local",
            file=sys.stderr,
        )
        return 1

    sb = Supabase(url, service_key)

    # Upsert in chunks so we don't blow past PostgREST's payload limit.
    CHUNK = 200
    uploaded = 0
    for i in range(0, len(rows), CHUNK):
        batch = rows[i : i + CHUNK]
        try:
            sb.upsert_supermarkets(batch)
            uploaded += len(batch)
            print(f"  [{uploaded}/{len(rows)}] upserted")
        except Exception as e:
            print(f"  ERROR on batch {i}-{i + len(batch)}: {e}", file=sys.stderr)
            return 2
    print()
    print(f"Done. Upserted {uploaded} supermarket rows.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
