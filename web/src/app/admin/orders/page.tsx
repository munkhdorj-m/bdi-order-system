import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminOrdersPage() {
  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Захиалга</h1>
      <Card>
        <CardHeader>
          <CardTitle>Удахгүй...</CardTitle>
          <CardDescription>Phase 4 — захиалга жагсаалт, статус удирдах хэсэг.</CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}
