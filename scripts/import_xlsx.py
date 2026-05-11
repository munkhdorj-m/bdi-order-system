"""
One-time importer: reads BDI's product xlsx and emits a SQL file
that you paste into the Supabase SQL Editor.

Usage:
    python scripts/import_xlsx.py "path/to/file.xlsx"

If no path is given, defaults to:
    C:/Users/Munkhdorj/Desktop/Барааны CG бүх барааны жагсаалт  Бэлний бөөн 202601.xlsx

Output: scripts/products_import.sql

Why we generate SQL instead of writing directly to the DB:
- No need to expose your service_role key.
- You can review the SQL before committing.
- Idempotent re-runs via ON CONFLICT DO NOTHING.
"""

from __future__ import annotations

import io
import re
import sys
import unicodedata
from pathlib import Path

import pandas as pd


def _force_utf8_stdout() -> None:
    if hasattr(sys.stdout, "buffer"):
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")


# ----- Known structure of the BDI xlsx ----------------------------------

CATEGORIES = [
    "Ариутгалын салфетка, цаасан бүтээгдэхүүнүүд",
    "Нүүр цэвэрлэх байгалийн гаралтай хөвөн",
    "Гэр ахуйн угаалга, цэвэрлэгээний бүтээгдэхүүнүүд",
    "Oralgos Ам арчилгааны бүтээгдэхүүнүүд",
    "Эрүүл мэндийн наалтууд",
    "Уургийн паста гоймон",
    "Эко Угаалгын ялтас",
]

# Brand prefixes — first match wins.
BRANDS = [
    "Soft Leaf",
    "Silky Cotton",
    "Yusen",
    "GmFDD",
    "OralGos",
    "Oralgos",
    "Sweet trip",
    "Sweetrip",
    "Dr. Baek",
    "Dr Baek",
    "Ecoclean",
    "Хулсны",
]


# ----- Helpers ----------------------------------------------------------

def norm(value) -> str:
    if value is None:
        return ""
    if isinstance(value, float):
        if pd.isna(value):
            return ""
        if value.is_integer():
            return unicodedata.normalize("NFC", str(int(value))).strip()
    return unicodedata.normalize("NFC", str(value)).strip()


def clean_barcode(raw: str) -> str:
    return re.sub(r"\s+", "", raw)


def detect_brand(name: str) -> str | None:
    if not name:
        return None
    for b in BRANDS:
        if name.lower().startswith(b.lower()):
            return b.replace("Oralgos", "OralGos").replace("Dr Baek", "Dr. Baek")
    return None


def first_int(text: str) -> int | None:
    if not text:
        return None
    m = re.search(r"\d+", text.replace(",", ""))
    return int(m.group()) if m else None


def sql_str(value) -> str:
    if value is None or value == "":
        return "NULL"
    return "'" + str(value).replace("'", "''") + "'"


def sql_num(value) -> str:
    if value is None or value == "":
        return "NULL"
    return str(value)


# ----- Parser -----------------------------------------------------------

# Column layout that holds across every section of this xlsx. Section-specific
# "№" header rows can override these — but if a section omits its header row,
# we still parse correctly.
DEFAULT_COL_MAP = {
    "sku": 1,
    "name": 2,
    "description": 3,  # header says "Хэмжээ", but content is actually a description
    "pack_info": 5,
    "box_count": 6,
    "base_price": 7,
    "cash_price": 8,
}


def parse(df: pd.DataFrame):
    current_category: str | None = None
    column_map: dict[str, int] = dict(DEFAULT_COL_MAP)
    products: list[dict] = []
    seen_skus: dict[str, int] = {}
    duplicates: list[tuple[str, str]] = []

    for _, row in df.iterrows():
        cells = [
            norm(row.iloc[i]) if i < len(row) else "" for i in range(min(11, len(row)))
        ]
        c0 = cells[0] if cells else ""

        # 1. Category header? It can appear in col 0, 1, or 2.
        matched_cat = next(
            (cat for cat in CATEGORIES if cat in cells[:3]), None,
        )
        if matched_cat:
            current_category = matched_cat
            continue

        # 2. Column header row → refresh map (keep defaults for any column we
        # don't see a label for).
        if c0 == "№":
            new_map = dict(DEFAULT_COL_MAP)
            for ci, h_raw in enumerate(cells):
                h = h_raw.lower()
                if not h:
                    continue
                if "нэр" in h:
                    new_map["name"] = ci
                elif "код" in h:
                    new_map["sku"] = ci
                elif "савлагаа" in h or "грам" in h:
                    new_map["pack_info"] = ci
                elif "хайрцаг" in h:
                    new_map["box_count"] = ci
                elif "бөөн" in h:
                    new_map["base_price"] = ci
                elif "бэлэн" in h or "жижиглэн" in h:
                    new_map["cash_price"] = ci
            column_map = new_map
            continue

        # 3. Product row — col 0 must be an integer
        if not c0 or not re.match(r"^\d+$", c0):
            continue

        sku_raw = cells[column_map["sku"]] if column_map["sku"] < len(cells) else ""
        sku = clean_barcode(sku_raw)
        name = cells[column_map["name"]] if column_map["name"] < len(cells) else ""
        if not sku or not name:
            continue

        # Dedupe SKUs with a -N suffix; the dedup map keys off the original sku.
        seen_skus[sku] = seen_skus.get(sku, 0) + 1
        if seen_skus[sku] > 1:
            duplicates.append((sku, name))
            sku = f"{sku}-{seen_skus[sku]}"

        def cell(key: str) -> str:
            ci = column_map.get(key)
            if ci is None or ci >= len(cells):
                return ""
            return cells[ci]

        desc = cell("description")
        pack_info = cell("pack_info")
        box_count = first_int(cell("box_count"))
        base_price = first_int(cell("base_price"))
        cash_price = first_int(cell("cash_price"))

        if base_price is None:
            continue  # rows without a wholesale price aren't usable products

        rich_desc_parts = [d for d in (desc, pack_info) if d]
        rich_desc = "\n\n".join(rich_desc_parts) if rich_desc_parts else None

        products.append({
            "sku": sku,
            "name": name,
            "category": current_category,
            "brand": detect_brand(name),
            "description": rich_desc,
            "box_count": box_count,
            "base_price": base_price,
            "cash_price": cash_price,
        })

    return products, duplicates


def emit_sql(products: list[dict], src_filename: str) -> str:
    lines = [
        "-- ============================================================",
        f"-- Auto-generated from: {src_filename}",
        f"-- Products: {len(products)}",
        "-- ============================================================",
        "-- Run this in Supabase SQL Editor.",
        "-- Idempotent: existing SKUs are skipped (ON CONFLICT DO NOTHING).",
        "",
        "insert into products",
        "  (sku, name, category_id, brand, description, box_count, base_price, cash_price, stock, active)",
        "values",
    ]

    rows_sql = []
    for p in products:
        cat_sql = (
            f"(select id from categories where name = {sql_str(p['category'])})"
            if p["category"]
            else "NULL"
        )
        rows_sql.append(
            "  (" + ", ".join([
                sql_str(p["sku"]),
                sql_str(p["name"]),
                cat_sql,
                sql_str(p["brand"]),
                sql_str(p["description"]),
                sql_num(p["box_count"]),
                sql_num(p["base_price"]),
                sql_num(p["cash_price"]),
                "0",
                "true",
            ]) + ")"
        )
    lines.append(",\n".join(rows_sql))
    lines.append("on conflict (sku) do nothing;")
    return "\n".join(lines) + "\n"


# ----- Main -------------------------------------------------------------

def main():
    _force_utf8_stdout()
    default_path = (
        "C:/Users/Munkhdorj/Desktop/"
        "Барааны CG бүх барааны жагсаалт  Бэлний бөөн 202601.xlsx"
    )
    src = Path(sys.argv[1] if len(sys.argv) > 1 else default_path)
    if not src.exists():
        print(f"ERROR: xlsx not found: {src}", file=sys.stderr)
        sys.exit(1)

    df = pd.read_excel(src, sheet_name=0, header=None)
    products, duplicates = parse(df)

    out = Path(__file__).parent / "products_import.sql"
    out.write_text(emit_sql(products, src.name), encoding="utf-8")

    print(f"✓ Parsed {len(products)} products from {src.name}")
    print(f"✓ Wrote SQL to {out}")
    print()
    print("Next step: open the SQL file, copy its contents,")
    print("and paste into Supabase Dashboard → SQL Editor → Run.")
    print()

    if duplicates:
        print(f"⚠ {len(duplicates)} duplicate barcode(s) in source — kept with -N suffix:")
        for sku, name in duplicates:
            print(f"    {sku}  ←  {name[:60]}")


if __name__ == "__main__":
    main()
