"""
Imports per-chain wholesale prices from product_list.xls into customer_prices.

How it works
------------
product_list.xls has one row per BDI SKU and one column per pricing channel
(a chain like "CU Сүлжээ дэлгүүр", "GS25 агуулах", "M Март Сүлжээ" etc.).
Each cell is the price the named chain pays for that product.

We:
  1. Read each product row, take its barcode, find the matching SKU in
     products. SKUs not in the DB are skipped (the file lists 134 products;
     we only have 56 catalogued — by design).
  2. For each pricing column, classify supermarkets into "stores that
     belong to this chain" using a keyword list (CHAIN_KEYWORDS below).
     A store belongs to a chain if any keyword for the chain appears in
     its name, address, or notes.
  3. For every (matched product) × (matched store) pair where the cell
     price > 0, upsert one customer_prices row.

USAGE
    python scripts/import_chain_prices.py --dry-run    # preview counts
    python scripts/import_chain_prices.py              # apply
    python scripts/import_chain_prices.py "C:/path/to/product_list.xls"
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


# ---- keyword mapping: which words identify each pricing column ----------
# Lowercased, NFC-normalized. Compared against lowercased+normalized store
# name, address, and notes. Keep keywords distinctive — "Захууд" alone
# would over-match, so don't include it unless you really want every
# "захууд" store to use that chain's price.
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
    # 'Захууд' deliberately omitted: too broad to safely auto-match.
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
        if value != value:  # NaN
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
        # Paginate to make sure we get all rows past PostgREST's default 1000 limit.
        out: list[dict] = []
        offset = 0
        page = 1000
        while True:
            r = requests.get(
                f"{self.url}/rest/v1/supermarkets",
                headers={**self.headers, "Range": f"{offset}-{offset + page - 1}"},
                params={"select": "id,name,address,notes,active"},
                timeout=60,
            )
            r.raise_for_status()
            batch = r.json()
            out.extend(batch)
            if len(batch) < page:
                break
            offset += page
        return out

    def upsert_prices(self, rows: list[dict]) -> None:
        r = requests.post(
            f"{self.url}/rest/v1/customer_prices",
            headers={
                **self.headers,
                "Content-Type": "application/json",
                "Prefer": "resolution=merge-duplicates,return=minimal",
            },
            params={"on_conflict": "supermarket_id,product_id"},
            json=rows,
            timeout=120,
        )
        if not r.ok:
            raise RuntimeError(f"{r.status_code}: {r.text[:500]}")


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
    # First row is column headers
    biggest.columns = biggest.iloc[0]
    biggest = biggest.iloc[1:].reset_index(drop=True)
    print(f"  {biggest.shape[0]} product rows, {biggest.shape[1]} columns.")

    # Find the barcode and chain columns
    columns = list(biggest.columns)
    barcode_col = next((c for c in columns if "арко" in str(c).lower()), None)
    if not barcode_col:
        print("ERROR: couldn't find Баркод column", file=sys.stderr)
        return 1
    chain_cols = [c for c in columns if c in CHAIN_KEYWORDS]
    print(f"  Found {len(chain_cols)} pricing chains we know how to map.")

    print("\nFetching products and supermarkets from Supabase ...")
    products = sb.fetch_products()
    supermarkets = sb.fetch_supermarkets()
    print(f"  {len(products)} products, {len(supermarkets)} supermarkets.")

    by_sku: dict[str, dict] = {p["sku"]: p for p in products}

    # Pre-compute searchable haystack per store (name+address+notes)
    store_text: dict[str, str] = {}
    for s in supermarkets:
        haystack = " ".join(
            norm(part) for part in (s.get("name"), s.get("address"), s.get("notes"))
        )
        store_text[s["id"]] = f" {haystack} "  # pad so " cu " keyword matches

    # Group supermarkets per chain
    chain_to_store_ids: dict[str, list[str]] = defaultdict(list)
    for chain, keywords in CHAIN_KEYWORDS.items():
        if chain not in chain_cols:
            continue
        norm_kws = [norm(k) for k in keywords]
        for sid, text in store_text.items():
            if any(k in text for k in norm_kws):
                chain_to_store_ids[chain].append(sid)

    print("\nChain → store counts:")
    for chain in sorted(chain_to_store_ids, key=lambda c: -len(chain_to_store_ids[c])):
        print(f"  {chain[:32]:32}  {len(chain_to_store_ids[chain])} stores")
    unmatched_chains = [c for c in chain_cols if c not in chain_to_store_ids]
    for c in unmatched_chains:
        print(f"  (no stores matched)  {c}")

    # Build customer_prices rows
    to_upsert: list[dict] = []
    products_in_file = 0
    products_matched = 0
    products_unmatched: list[str] = []

    for _, row in biggest.iterrows():
        barcode = str(row.get(barcode_col) or "").strip()
        if not re.fullmatch(r"\d{12,14}", barcode):
            continue
        products_in_file += 1

        # Match against DB by exact SKU, OR by stripped barcode if our SKU has -N suffix.
        product = by_sku.get(barcode)
        if not product:
            # try matching products whose sku is `<barcode>-N`
            for p in products:
                if p["sku"].startswith(barcode + "-"):
                    product = p
                    break
        if not product:
            products_unmatched.append(barcode)
            continue
        products_matched += 1

        for chain in chain_cols:
            price = to_int(row.get(chain))
            if not price or price <= 0:
                continue
            for sid in chain_to_store_ids.get(chain, []):
                to_upsert.append({
                    "supermarket_id": sid,
                    "product_id": product["id"],
                    "price": price,
                })

    print(f"\nProducts in file: {products_in_file}, matched to our DB: {products_matched}")
    if products_unmatched:
        print(f"  Skipped {len(products_unmatched)} products not in our catalog "
              f"(first few: {products_unmatched[:3]} ...)")
    print(f"customer_prices rows prepared: {len(to_upsert)}")

    if dry_run:
        print("\n--dry-run set; no DB writes.")
        return 0

    if not to_upsert:
        print("Nothing to upsert.")
        return 0

    # Deduplicate identical pairs (defensive — should already be unique)
    seen: set[tuple[str, str]] = set()
    deduped: list[dict] = []
    for r in to_upsert:
        key = (r["supermarket_id"], r["product_id"])
        if key in seen:
            continue
        seen.add(key)
        deduped.append(r)

    print(f"\nUpserting {len(deduped)} rows ...")
    CHUNK = 500
    done = 0
    for i in range(0, len(deduped), CHUNK):
        batch = deduped[i : i + CHUNK]
        try:
            sb.upsert_prices(batch)
            done += len(batch)
            print(f"  [{done}/{len(deduped)}]")
        except Exception as e:
            print(f"  ERROR on batch {i}: {e}", file=sys.stderr)
            return 2

    print(f"\nDone. {done} customer_prices upserted.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
