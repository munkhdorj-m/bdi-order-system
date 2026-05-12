"""
Bulk-uploads product images from a sorted-on-disk folder into Supabase Storage
and links them to existing products by SKU.

Folder layout it expects (you control the folder names — they don't have to
match anything in the DB):

    Sorted/
    ├── <Category folder>/
    │   ├── <Product folder>/
    │   │   ├── 1- 99,9% ариутгалын 10ш 4890326012629.png   ← barcode in name = strongest match
    │   │   ├── IMG_3722.jpg
    │   │   └── ...
    │   └── <Another product>/
    └── ...

Matching strategy, per product folder, in order:
  1. If any filename contains a 13-digit barcode that exists in products.sku → match.
  2. Otherwise fuzzy-match the folder name against product names (Jaccard
     similarity on lowercased Mongolian/English tokens). Threshold 0.4.

The 'primary' image picked for each product is the one with a barcode in its
name if present, otherwise the alphabetically-first image in the folder.

USAGE

    # Preview only (no uploads, no DB writes):
    python scripts/import_images.py --dry-run

    # Do it (skip products that already have an image):
    python scripts/import_images.py

    # Overwrite existing images too:
    python scripts/import_images.py --force

    # Custom source folder:
    python scripts/import_images.py "D:/some/other/path"

ENV (read from web/.env.local):
    NEXT_PUBLIC_SUPABASE_URL   — your Supabase project URL
    SUPABASE_SERVICE_ROLE_KEY  — service_role key from Project Settings → API.
                                 NEVER commit or share this. It bypasses RLS.
"""

from __future__ import annotations

import io
import mimetypes
import os
import re
import sys
import unicodedata
import uuid
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import quote

import requests


# ---- utf-8 stdout on Windows so Cyrillic prints --------------------------

def _force_utf8_stdout() -> None:
    if hasattr(sys.stdout, "buffer"):
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")


# ---- env loader ----------------------------------------------------------

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


# ---- product matching ----------------------------------------------------

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp"}
BARCODE_RE = re.compile(r"\b(\d{13})\b")
TOKEN_RE = re.compile(r"[\wЀ-ӿ]+", re.UNICODE)


def tokenize(text: str) -> set[str]:
    """Lowercase, NFC-normalize, split into word-like tokens."""
    n = unicodedata.normalize("NFC", text or "").lower()
    return {t for t in TOKEN_RE.findall(n) if len(t) > 1}


def jaccard(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


@dataclass
class Product:
    id: str
    sku: str
    name: str
    brand: str | None
    image_url: str | None
    tokens: set[str]


@dataclass
class FolderHit:
    folder: Path
    primary_image: Path
    barcode_in_filename: str | None
    product: Product | None
    match_reason: str
    score: float


def pick_primary(images: list[Path]) -> tuple[Path, str | None]:
    """Pick the canonical front image. Prefer one with a barcode in its name."""
    for img in sorted(images):
        m = BARCODE_RE.search(img.stem)
        if m:
            return img, m.group(1)
    return sorted(images)[0], None


def list_product_folders(root: Path) -> list[Path]:
    """Two levels deep: <category>/<product>."""
    out: list[Path] = []
    for cat in sorted(root.iterdir()):
        if not cat.is_dir() or cat.name.lower() in {"references"}:
            continue
        for prod in sorted(cat.iterdir()):
            if prod.is_dir():
                out.append(prod)
    return out


def list_images(folder: Path) -> list[Path]:
    return [p for p in folder.iterdir() if p.is_file() and p.suffix.lower() in IMAGE_EXTS]


# ---- Supabase HTTP ------------------------------------------------------

class Supabase:
    def __init__(self, url: str, service_key: str) -> None:
        self.url = url.rstrip("/")
        self.headers = {
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
        }

    def fetch_products(self) -> list[Product]:
        r = requests.get(
            f"{self.url}/rest/v1/products",
            headers=self.headers,
            params={"select": "id,sku,name,brand,image_url"},
            timeout=30,
        )
        r.raise_for_status()
        return [
            Product(
                id=row["id"],
                sku=row["sku"],
                name=row["name"],
                brand=row.get("brand"),
                image_url=row.get("image_url"),
                tokens=tokenize(f"{row['name']} {row.get('brand') or ''}"),
            )
            for row in r.json()
        ]

    def upload_image(self, file_path: Path) -> str:
        ext = file_path.suffix.lower() or ".jpg"
        key = f"{uuid.uuid4()}{ext}"
        mime = mimetypes.guess_type(file_path.name)[0] or "image/jpeg"
        with file_path.open("rb") as f:
            data = f.read()
        r = requests.post(
            f"{self.url}/storage/v1/object/product-images/{quote(key)}",
            headers={
                **self.headers,
                "Content-Type": mime,
                "x-upsert": "true",
            },
            data=data,
            timeout=120,
        )
        r.raise_for_status()
        return f"{self.url}/storage/v1/object/public/product-images/{key}"

    def update_product_image(self, product_id: str, image_url: str) -> None:
        r = requests.patch(
            f"{self.url}/rest/v1/products",
            headers={
                **self.headers,
                "Content-Type": "application/json",
                "Prefer": "return=minimal",
            },
            params={"id": f"eq.{product_id}"},
            json={"image_url": image_url},
            timeout=30,
        )
        r.raise_for_status()


# ---- matching driver ----------------------------------------------------

def match_folder(folder: Path, products: list[Product]) -> FolderHit | None:
    images = list_images(folder)
    if not images:
        return None
    primary, barcode = pick_primary(images)

    if barcode:
        for p in products:
            if p.sku == barcode or p.sku.startswith(barcode + "-"):
                return FolderHit(
                    folder=folder,
                    primary_image=primary,
                    barcode_in_filename=barcode,
                    product=p,
                    match_reason=f"barcode in filename",
                    score=1.0,
                )

    folder_tokens = tokenize(folder.name)
    best: tuple[Product, float] | None = None
    for p in products:
        s = jaccard(folder_tokens, p.tokens)
        if s == 0:
            continue
        if best is None or s > best[1]:
            best = (p, s)
    if best and best[1] >= 0.4:
        return FolderHit(
            folder=folder,
            primary_image=primary,
            barcode_in_filename=None,
            product=best[0],
            match_reason="folder-name similarity",
            score=best[1],
        )
    return FolderHit(
        folder=folder,
        primary_image=primary,
        barcode_in_filename=None,
        product=None,
        match_reason="no match",
        score=best[1] if best else 0.0,
    )


# ---- main ---------------------------------------------------------------

def main() -> int:
    _force_utf8_stdout()
    args = sys.argv[1:]
    dry_run = "--dry-run" in args
    force = "--force" in args
    positional = [a for a in args if not a.startswith("--")]
    sorted_root = Path(positional[0]) if positional else Path(
        "C:/Users/Munkhdorj/Desktop/Marketing/Sorted"
    )

    if not sorted_root.exists():
        print(f"ERROR: folder not found: {sorted_root}", file=sys.stderr)
        return 1

    env = load_env(Path(__file__).resolve().parent.parent / "web" / ".env.local")
    url = env.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    service_key = env.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get(
        "SUPABASE_SERVICE_ROLE_KEY"
    )

    if not url or not service_key:
        print(
            "ERROR: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing.\n"
            "Add SUPABASE_SERVICE_ROLE_KEY to web/.env.local — see scripts/README.md.",
            file=sys.stderr,
        )
        return 1

    sb = Supabase(url, service_key)
    print(f"Fetching products from {url} ...")
    products = sb.fetch_products()
    print(f"Found {len(products)} products in DB.\n")

    folders = list_product_folders(sorted_root)
    print(f"Scanning {len(folders)} product folders under {sorted_root}\n")

    matched: list[FolderHit] = []
    skipped_no_match: list[FolderHit] = []
    skipped_has_image: list[FolderHit] = []
    skipped_no_images: list[Path] = []

    for folder in folders:
        hit = match_folder(folder, products)
        if hit is None:
            skipped_no_images.append(folder)
            continue
        if hit.product is None:
            skipped_no_match.append(hit)
            continue
        if hit.product.image_url and not force:
            skipped_has_image.append(hit)
            continue
        matched.append(hit)

    # ---- Report ----
    print("=" * 72)
    print(f"MATCHED: {len(matched)} folder(s)")
    print("=" * 72)
    for h in matched:
        assert h.product is not None
        print(
            f"  [{h.score:.2f}]  {h.folder.name[:48]:48}  →  {h.product.name[:48]}  "
            f"({h.match_reason})"
        )
        print(f"         primary: {h.primary_image.name}")

    if skipped_has_image:
        print()
        print(f"SKIPPED (already has image, use --force to overwrite): {len(skipped_has_image)}")
        for h in skipped_has_image:
            assert h.product is not None
            print(f"  {h.folder.name[:48]:48}  →  {h.product.name[:48]}")

    if skipped_no_match:
        print()
        print(f"UNMATCHED: {len(skipped_no_match)} folder(s) (review folder names)")
        for h in skipped_no_match:
            print(f"  {h.folder.name}  (best score: {h.score:.2f})")

    if skipped_no_images:
        print()
        print(f"EMPTY: {len(skipped_no_images)} folder(s) with no image files")
        for f in skipped_no_images:
            print(f"  {f.name}")

    print()
    if dry_run:
        print("--dry-run set; no uploads, no DB writes. Re-run without --dry-run to apply.")
        return 0

    if not matched:
        print("Nothing to upload.")
        return 0

    print(f"Uploading {len(matched)} image(s)...")
    uploaded = 0
    failed: list[tuple[FolderHit, str]] = []
    for h in matched:
        assert h.product is not None
        try:
            url_pub = sb.upload_image(h.primary_image)
            sb.update_product_image(h.product.id, url_pub)
            print(f"  ✓ {h.product.name[:60]}")
            uploaded += 1
        except requests.HTTPError as e:
            body = e.response.text if e.response is not None else "<no body>"
            failed.append((h, f"{e} — {body[:200]}"))
            print(f"  ✗ {h.product.name[:60]}: {e}")
        except Exception as e:
            failed.append((h, str(e)))
            print(f"  ✗ {h.product.name[:60]}: {e}")

    print()
    print(f"Uploaded: {uploaded} / {len(matched)}")
    if failed:
        print(f"Failed:   {len(failed)}")
        for h, err in failed:
            print(f"  {h.folder.name}: {err}")
    return 0 if not failed else 2


if __name__ == "__main__":
    sys.exit(main())
