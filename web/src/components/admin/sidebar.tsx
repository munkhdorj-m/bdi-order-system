import { AdminBrand, AdminNavList } from "./admin-nav-list";

/**
 * Admin nav rail — deep night-sky navy with the current page in gold
 * (the "Тэнгэр ба алт" palette). Sticky, so it stays put while the
 * content column scrolls.
 */
export function AdminSidebar() {
  return (
    <aside className="hidden lg:flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:sticky lg:top-0 lg:h-screen">
      <div className="flex h-14 items-center border-b border-sidebar-border px-4">
        <AdminBrand />
      </div>
      <AdminNavList />
      <div className="border-t border-sidebar-border px-5 py-4 text-[11px] text-sidebar-foreground/50">
        Бадруун дэвжих интернэйшнл
      </div>
    </aside>
  );
}
