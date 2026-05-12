"""
One-shot importer: takes the chain-pricing matrix in product_list.xls,
creates one price_list per chain column, fills price_list_items from
each cell, and assigns matching supermarkets to the right list by keyword
match (same matching logic as import_chain_prices.py).

After running, your stores are categorized into pricing presets. The
buyer catalog will use the assigned list automatically via the
supermarket_prices view's 3-tier coalesce. Any per-store overrides
already in customer_prices keep working (they win over the list).

USAGE
    python scripts/import_pricelists.py --dry-run   # preview counts
    python scripts/import_pricelists.py             # apply

ENV (read from web/.env.local):
    NEXT_PUBLIC_SUPABASE_URL
    SUPABASE_SERVICE_ROLE_KEY

PREREQUISITES
    - Apply docs/fixes/08-price-lists.sql first (adds the tables).
    - Stores already imported via scripts/import_stores.py.
    - Products already imported via scripts/import_xlsx.py
      (the script only matches barcodes we already carry).
"""

from __future__ import annotations

import io
import re
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path

import pandas as pd
import requests


# Same keyword map as import_chain_prices.py — chain → words that identify
# its stores in the supermarkets table.
CHAIN_KEYWORDS: dict[str, list[str]] = {
    "BSB сүлжээ": ["bsb"],
    "CU Сүлжээ дэлгүүр": [" cu ", "cu сүлжээ", "cu - "],
    "Абсолют": ["абсолют"],
    "Агар Эмийн сангууд": ["агар "],
    "Ази Фарма": ["ази фарма"],
    "БОСА Сүлжээ": ["боса", "bosa"],
    "Баянхонгор": ["баянхонгор"],
    "Дүүхэйд": ["дүүхэйд"],
    "Жижиг Бэлний супермаркет": ["жижиг бэлн", "жижиг бэлэн"],
    "ИМонос": ["имонос", "i-monos"],
    "Монос": ["монос"],
    "Номин": ["номин"],
    "Содон бөмбөгөр": ["содон"],
    "Фармапортал": ["фармапортал"],
    "Хоум Плаза": ["хоум плаза", "home plaza"],
    "Хямдралтай": ["хямдрал"],
    "ЭФЕС": ["эфес"],
    "Энто эмийн сан": ["энто эмийн", "энто  эмийн"],
    "наран": ["наран"],
    "E-Mart": ["e-mart", "e mart", "emart", "и март"],
    "GS25 агуулах": ["gs25", "gs-25"],
    "M Mарт Сүлжээ": ["m март", "m-март", "m mарт", "м-март", "ммарт"],
    "тэнгэр бөөн": ["тэнгэр бөөн"],
    "тэнгэр плаза": ["тэнгэр плаза"],
    "цэнгэлдэх": ["цэнгэлдэх"],
    "O'Resh": ["o'resh", "o resh", "oresh"],
    "sansar": ["sansar", "сансар"],
    "SHOPPY": ["shoppy", "шоппи"],
    "Touten": ["touten", "тоутен"],
    "Well mart": ["well mart", "well-mart", "wellmart"],
}


def _force_utf8_stdout() -> None:
    if hasattr(sys.stdout, "buffer"):
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")


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


def norm(s) -> str:
    if s is None or (isinstance(s, float) and pd.isna(s)):
        return ""
    return unicodedata.normalize("NFC", str(s)).lower().strip()


def to_int(value) -> int | None:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    if isinstance(value, (int, float)):
        if value != value:
            return None
        return int(value) if int(value) == value else None
    s = str(value).replace(",", "").strip()
    m = re.search(r"\d+", s)
    return int(m.group()) if m else None


# ---- Supabase HTTP ------------------------------------------------------

class Supabase:
    def __init__(self, url: str, service_key: str) -> None:
        self.url = url.rstrip("/")
        self.headers = {
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
        }

    def fetch_products(self) -> list[dict]:
        r = requests.get(
            f"{self.url}/rest/v1/products",
            headers=self.headers,
            params={"select": "id,sku,name"},
            timeout=30,
        )
        r.raise_for_status()
        return r.json()

    def fetch_supermarkets(self) -> list[dict]:
        out: list[dict] = []
        offset = 0
        page = 1000
        while True:
            r = requests.get(
                f"{self.url}/rest/v1/supermarkets",
                headers={**self.headers, "Range": f"{offset}-{offset + page - 1}"},
                params={"select": "id,name,address,notes,active,price_list_id"},
                timeout=60,
            )
            r.raise_for_status()
            batch = r.json()
            out.extend(batch)
            if len(batch) < page:
                break
            offset += page
        return out

    def upsert_price_list(self, name: str, description: str | None = None) -> str:
        """Upsert a price_list by name; return its id."""
        r = requests.post(
            f"{self.url}/rest/v1/price_lists",
            headers={
                **self.headers,
                "Content-Type": "application/json",
                "Prefer": "resolution=merge-duplicates,return=representation",
            },
            params={"on_conflict": "name"},
            json=[{"name": name, "description": description, "active": True}],
            timeout=30,
        )
        if not r.ok:
            raise RuntimeError(f"price_lists upsert {r.status_code}: {r.text[:400]}")
        data = r.json()
        if not data:
            # PostgREST occasionally returns [] on merge-duplicates if the row
            # was unchanged; fall back to a SELECT.
            sel = requests.get(
                f"{self.url}/rest/v1/price_lists",
                headers=self.headers,
                params={"select": "id", "name": f"eq.{name}"},
                timeout=30,
            )
            sel.raise_for_status()
            data = sel.json()
        return data[0]["id"]

    def upsert_items(self, rows: list[dict]) -> None:
        if not rows:
            return
        r = requests.post(
            f"{self.url}/rest/v1/price_list_items",
            headers={
                **self.headers,
                "Content-Type": "application/json",
                "Prefer": "resolution=merge-duplicates,return=minimal",
            },
            params={"on_conflict": "price_list_id,product_id"},
            json=rows,
            timeout=120,
        )
        if not r.ok:
            raise RuntimeError(f"items upsert {r.status_code}: {r.text[:400]}")

    def assign_stores(self, store_ids: list[str], price_list_id: str) -> None:
        if not store_ids:
            return
        # PostgREST's PATCH with `in.(...)` updates many rows at once.
        joined = ",".join(store_ids)
        r = requests.patch(
            f"{self.url}/rest/v1/supermarkets",
            headers={
                **self.headers,
                "Content-Type": "application/json",
                "Prefer": "return=minimal",
            },
            params={"id": f"in.({joined})"},
            json={"price_list_id": price_list_id},
            timeout=60,
        )
        if not r.ok:
            raise RuntimeError(f"assign {r.status_code}: {r.text[:400]}")


# ---- main ---------------------------------------------------------------

DEFAULT_PATH = Path("C:/Users/Munkhdorj/Downloads/product_list.xls")


def main() -> int:
    _force_utf8_stdout()
    args = sys.argv[1:]
    dry_run = "--dry-run" in args
    positional = [a for a in args if not a.startswith("--")]
    src = Path(positional[0]) if positional else DEFAULT_PATH
    if not src.exists():
        print(f"ERROR: file not found: {src}", file=sys.stderr)
        return 1

    env = load_env(Path(__file__).resolve().parent.parent / "web" / ".env.local")
    url = env.get("NEXT_PUBLIC_SUPABASE_URL")
    service_key = env.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not service_key:
        print(
            "ERROR: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing.",
            file=sys.stderr,
        )
        return 1

    sb = Supabase(url, service_key)

    print(f"Loading product_list from {src} ...")
    tables = pd.read_html(str(src), encoding="utf-8")
    biggest = max(tables, key=lambda t: t.shape[0])

    def _looks_like_headers(cols) -> bool:
        return any("арко" in str(c).lower() for c in cols)

    if not _looks_like_headers(biggest.columns):
        biggest.columns = biggest.iloc[0]
        biggest = biggest.iloc[1:].reset_index(drop=True)
    print(f"  {biggest.shape[0]} product rows, {biggest.shape[1]} columns.")

    columns = list(biggest.columns)
    barcode_col = next((c for c in columns if "арко" in str(c).lower()), None)
    if not barcode_col:
        print("ERROR: couldn't find Баркод column", file=sys.stderr)
        return 1
    chain_cols = [c for c in columns if c in CHAIN_KEYWORDS]
    print(f"  {len(chain_cols)} known pricing chains in the file.")

    print("\nFetching products and supermarkets ...")
    products = sb.fetch_products()
    stores = sb.fetch_supermarkets()
    print(f"  {len(products)} products, {len(stores)} supermarkets.")

    # Build lookups
    by_sku: dict[str, dict] = {p["sku"]: p for p in products}
    by_barcode_prefix: dict[str, dict] = {}
    for p in products:
        if "-" in p["sku"]:
            by_barcode_prefix.setdefault(p["sku"].split("-")[0], p)

    store_haystack: dict[str, str] = {}
    for s in stores:
        haystack = " ".join(
            norm(part) for part in (s.get("name"), s.get("address"), s.get("notes"))
        )
        store_haystack[s["id"]] = f" {haystack} "

    chain_to_store_ids: dict[str, list[str]] = defaultdict(list)
    for chain in chain_cols:
        norm_kws = [norm(k) for k in CHAIN_KEYWORDS[chain]]
        for sid, text in store_haystack.items():
            if any(k in text for k in norm_kws):
                chain_to_store_ids[chain].append(sid)

    # Build product-id × price map per chain
    chain_to_items: dict[str, list[dict]] = defaultdict(list)
    unmatched_barcodes: list[str] = []

    for _, row in biggest.iterrows():
        barcode = str(row.get(barcode_col) or "").strip()
        if not re.fullmatch(r"\d{12,14}", barcode):
            continue
        product = by_sku.get(barcode) or by_barcode_prefix.get(barcode)
        if not product:
            unmatched_barcodes.append(barcode)
            continue

        for chain in chain_cols:
            price = to_int(row.get(chain))
            if not price or price <= 0:
                continue
            chain_to_items[chain].append({
                "product_id": product["id"],
                "price": price,
            })

    # ---- Report --------------------------------------------------------
    print("\nProposed price lists (chain → items, stores):")
    total_items = 0
    total_stores = 0
    for chain in chain_cols:
        items = chain_to_items.get(chain, [])
        store_ids = chain_to_store_ids.get(chain, [])
        marker = " " if items and store_ids else "·"
        print(
            f"  {marker} {chain[:32]:32}  {len(items):3} items  →  "
            f"{len(store_ids):3} stores"
        )
        total_items += len(items)
        total_stores += len(store_ids)
    print(f"  totals: {total_items} items, {total_stores} store-assignments")
    if unmatched_barcodes:
        print(
            f"  ({len(unmatched_barcodes)} barcodes in file not in our products — skipped)"
        )

    if dry_run:
        print("\n--dry-run set; no DB writes.")
        return 0

    # ---- Apply ---------------------------------------------------------
    print("\nUpserting price lists ...")
    chain_to_list_id: dict[str, str] = {}
    for chain in chain_cols:
        list_id = sb.upsert_price_list(chain, description=f"Auto-imported {chain}")
        chain_to_list_id[chain] = list_id
        print(f"  ✓ {chain}  → {list_id}")

    print("\nUpserting items ...")
    for chain in chain_cols:
        items = chain_to_items.get(chain, [])
        if not items:
            continue
        list_id = chain_to_list_id[chain]
        # Deduplicate within a chain (defensive)
        seen: set[str] = set()
        rows: list[dict] = []
        for it in items:
            if it["product_id"] in seen:
                continue
            seen.add(it["product_id"])
            rows.append({"price_list_id": list_id, **it})
        # Chunk
        CHUNK = 500
        done = 0
        for i in range(0, len(rows), CHUNK):
            sb.upsert_items(rows[i : i + CHUNK])
            done += len(rows[i : i + CHUNK])
        print(f"  ✓ {chain[:32]:32}  {done} items")

    print("\nAssigning stores ...")
    for chain in chain_cols:
        ids = chain_to_store_ids.get(chain, [])
        if not ids:
            continue
        list_id = chain_to_list_id[chain]
        # Chunk PATCH so the in.(...) URL doesn't get huge
        CHUNK = 200
        done = 0
        for i in range(0, len(ids), CHUNK):
            sb.assign_stores(ids[i : i + CHUNK], list_id)
            done += len(ids[i : i + CHUNK])
        print(f"  ✓ {chain[:32]:32}  {done} stores")

    print("\nDone. Refresh /admin/price-lists.")
    print(
        "\nNote: rows in customer_prices from the earlier chain-prices import\n"
        "still act as per-store overrides on top of the list. Same numbers, so\n"
        "no visible difference. Clean them up later if you want a tidier DB."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
