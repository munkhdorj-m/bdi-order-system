import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { MobileNav } from "./mobile-nav";

type Props = {
  email: string | null;
  name: string | null;
};

export function AdminHeader({ email, name }: Props) {
  return (
    <header className="h-14 border-b flex items-center gap-2 px-4 lg:px-6 bg-background">
      <MobileNav />
      <div className="lg:hidden font-semibold">BDI Admin</div>
      <div className="flex-1" />
      <div className="flex items-center gap-2">
        <div className="text-right hidden sm:block">
          {name && (
            <div className="text-sm font-medium leading-tight">{name}</div>
          )}
          {email && (
            <div className="text-xs text-muted-foreground leading-tight">
              {email}
            </div>
          )}
        </div>
        <ThemeToggle variant="admin" />
        <form action="/auth/signout" method="post">
          <Button type="submit" variant="ghost" size="icon" title="Гарах">
            <LogOut className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </header>
  );
}
