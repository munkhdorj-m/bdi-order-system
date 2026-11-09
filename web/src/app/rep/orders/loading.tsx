import { MobileListSkeleton, RepBarSkeleton } from "@/components/page-skeletons";

export default function RepOrdersLoading() {
  return (
    <>
      <RepBarSkeleton />
      <MobileListSkeleton rows={6} />
    </>
  );
}
