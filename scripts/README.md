# Scripts

One-off Python utilities, not part of the Next.js app.

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
