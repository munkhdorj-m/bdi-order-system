import { Headset } from "lucide-react";
import { ContactLinks } from "@/components/contact-links";
import { hasContactLinks } from "@/lib/contact";

/**
 * Buyer "Холбоо барих" page — reached from the 4th bottom-tab. Lists every
 * configured contact + social channel (env-driven). When nothing is
 * configured yet we still render a friendly placeholder rather than a
 * blank screen.
 */
export default function BuyerContactPage() {
  const configured = hasContactLinks();

  return (
    <div className="px-3 sm:px-4 py-5 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <span className="size-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Headset className="h-5 w-5" strokeWidth={2} />
        </span>
        <div>
          <h1 className="text-[22px] font-bold tracking-tight leading-tight">
            Холбоо барих
          </h1>
          <p className="text-[13px] text-muted-foreground">
            Асуулт, захиалгын талаар бидэнтэй холбогдоорой
          </p>
        </div>
      </div>

      <div className="mt-5">
        {configured ? (
          <ContactLinks variant="card" />
        ) : (
          <div className="rounded-2xl bg-muted/40 ring-1 ring-border px-4 py-8 text-center text-[13px] text-muted-foreground">
            Холбоо барих мэдээлэл удахгүй нэмэгдэнэ.
          </div>
        )}
      </div>

      <p className="mt-5 text-[12px] text-muted-foreground text-center leading-relaxed">
        Ажлын цаг: Даваа–Бямба, 09:00–18:00
      </p>
    </div>
  );
}
