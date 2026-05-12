# Scripts

One-off Python utilities, not part of the Next.js app.

## `import_images.py`

Walks a folder of product images on disk, matches each product folder to a
DB product (by 13-digit barcode in any filename, or fuzzy folder-name match),
uploads the chosen image to Supabase Storage, and sets `products.image_url`.

### Requirements
```powershell
python -m pip install requests
```

### Setup — add the service_role key (one-time)

1. Open **Supabase Dashboard → Project Settings → API**.
2. Under **Project API keys**, find `service_role` and click **Reveal**, then copy.
3. Open `web/.env.local` and add at the bottom:
   ```
   SUPABASE_SERVICE_ROLE_KEY=<paste here>
   ```
4. ⚠️ Never commit this file (it's gitignored) and never paste this key in chat
   or share it. It bypasses every RLS rule.

### Preview matches (no uploads, no DB writes)
```powershell
python scripts/import_images.py --dry-run
```
Reports which product folder maps to which DB product. Review the list — if
something maps wrong, fix the folder name or move the image.

### Run for real
```powershell
python scripts/import_images.py
```
Skips products that already have an image. Add `--force` to overwrite.

### Custom source folder
```powershell
python scripts/import_images.py "D:/somewhere/else"
```
Default: `C:/Users/Munkhdorj/Desktop/Marketing/Sorted`.

---

## `import_xlsx.py`

Reads BDI's product xlsx and generates `products_import.sql` for the Supabase SQL Editor.

### Requirements
```powershell
python -m pip install pandas openpyxl
```

### Run
```powershell
# Uses the default path on Munkhdorj's desktop:
python scripts/import_xlsx.py

# Or pass an explicit path:
python scripts/import_xlsx.py "C:\some\other\file.xlsx"
```

### Apply
1. Open `scripts/products_import.sql`
2. Copy the whole file
3. Supabase Dashboard → SQL Editor → + New query → paste → Run
4. Reload `http://localhost:3000/admin/products` — your SKUs should appear.

### Notes
- Re-runnable: existing SKUs are skipped (`on conflict (sku) do nothing`).
- Duplicate barcodes in the source file get a `-2`, `-3`, ... suffix — the script prints them so you can fix later.
- No images yet — images need to be uploaded via the admin UI after import.
