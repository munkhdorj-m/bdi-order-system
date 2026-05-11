import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminUsersPage() {
  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Хэрэглэгч</h1>
      <Card>
        <CardHeader>
          <CardTitle>Удахгүй...</CardTitle>
          <CardDescription>Phase 2 — төлөөлөгч, худалдан авагч урих хэсэг.</CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}
