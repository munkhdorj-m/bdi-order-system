// The same small set of people, stores, products and orders for every test.
export const ID = {
  admin: "a0000000-0000-4000-8000-000000000001",
  inactiveAdmin: "a0000000-0000-4000-8000-000000000002",
  rep: "b0000000-0000-4000-8000-000000000001",
  buyer1: "c0000000-0000-4000-8000-000000000001",
  buyer2: "c0000000-0000-4000-8000-000000000002",
  pending: "c0000000-0000-4000-8000-000000000003",
  s1: "d0000000-0000-4000-8000-000000000001",
  s2: "d0000000-0000-4000-8000-000000000002",
  s3: "d0000000-0000-4000-8000-000000000003",
  pl1: "e0000000-0000-4000-8000-000000000001",
  p1: "f0000000-0000-4000-8000-000000000001",
  p2: "f0000000-0000-4000-8000-000000000002",
  p3: "f0000000-0000-4000-8000-000000000003",
  p4: "f0000000-0000-4000-8000-000000000004",
  o1: "10000000-0000-4000-8000-000000000001",
  o2: "10000000-0000-4000-8000-000000000002",
};

/** Fill a freshly built database (see harness.mjs) with the test data. */
export async function seed(db) {
  const users = [ID.admin, ID.inactiveAdmin, ID.rep, ID.buyer1, ID.buyer2, ID.pending];
  for (const [i, id] of users.entries()) {
    await db.query(`insert into auth.users (id, phone, raw_user_meta_data) values ($1, $2, '{}'::jsonb)`, [id, "9769900000" + i]);
  }
  // The signup trigger made profiles; make sure they exist, then set roles.
  for (const id of users) {
    await db.query(`insert into public.profiles (id, role, active) values ($1, 'buyer', false) on conflict (id) do nothing`, [id]);
  }
  await db.exec(`
    insert into public.price_lists (id, name) values ('${ID.pl1}', 'List 1');
    insert into public.supermarkets (id, name, active, assigned_rep_id, price_list_id) values
      ('${ID.s1}', 'Store 1', true, null, '${ID.pl1}'),
      ('${ID.s2}', 'Store 2', true, null, null),
      ('${ID.s3}', 'Store 3 (inactive)', false, null, null);
    update public.profiles set role = 'admin', active = true where id = '${ID.admin}';
    update public.profiles set role = 'admin', active = false where id = '${ID.inactiveAdmin}';
    update public.profiles set role = 'rep', active = true where id = '${ID.rep}';
    update public.profiles set role = 'buyer', active = true, supermarket_id = '${ID.s1}' where id = '${ID.buyer1}';
    update public.profiles set role = 'buyer', active = true, supermarket_id = '${ID.s2}' where id = '${ID.buyer2}';
    update public.supermarkets set assigned_rep_id = '${ID.rep}' where id = '${ID.s1}';
    insert into public.products (id, sku, name, base_price, active, stock) values
      ('${ID.p1}', 'SKU1', 'Product 1', 1000, true, 10),
      ('${ID.p2}', 'SKU2', 'Product 2', 2000, true, 10),
      ('${ID.p3}', 'SKU3', 'Product 3', 3000, true, 10),
      ('${ID.p4}', 'SKU4', 'Product 4 (hidden)', 4000, false, 10);
    insert into public.price_list_items (price_list_id, product_id, price) values ('${ID.pl1}', '${ID.p1}', 900);
    insert into public.customer_prices (supermarket_id, product_id, price) values ('${ID.s1}', '${ID.p2}', 800);
    insert into public.orders (id, order_number, supermarket_id, placed_by, status) values
      ('${ID.o1}', 'ORD-T-1', '${ID.s1}', '${ID.buyer1}', 'pending'),
      ('${ID.o2}', 'ORD-T-2', '${ID.s2}', '${ID.buyer2}', 'pending');
    insert into public.order_items (order_id, product_id, product_name_snapshot, qty, unit_price) values
      ('${ID.o1}', '${ID.p1}', 'Product 1', 2, 900),
      ('${ID.o2}', '${ID.p3}', 'Product 3', 1, 3000);
    insert into public.notifications (user_id, kind, title) values ('${ID.buyer1}', 'order_new', 'n1'), ('${ID.buyer2}', 'order_new', 'n2');
    insert into public.discounts (name, kind, pct, active) values ('Deal', 'product', 5, true);
  `);
}
