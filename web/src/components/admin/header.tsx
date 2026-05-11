import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  email: string | null;
  name: string | null;
};

export function AdminHeader({ email, name }: Props) {
  return (
    <header className="h-14 border-b flex items-center justify-between px-4 lg:px-6 bg-background">
      <div className="lg:hidden font-semibold">BDI Admin</div>
      <div className="flex-1" />
      <div className="flex items-center gap-3">
        <div className="text-right">
          {name && <div className="text-sm font-medium leading-tight">{name}</div>}
          {email && (
            <div className="text-xs text-muted-foreground leading-tight">
              {email}
            </div>
          )}
        </div>
        <form action="/auth/signout" method="post">
          <Button type="submit" variant="ghost" size="icon" title="Гарах">
            <LogOut className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </header>
  );
}
