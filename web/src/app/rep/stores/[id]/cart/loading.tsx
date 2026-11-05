import { MobileListSkeleton, RepBarSkeleton } from "@/components/page-skeletons";

export default function RepCartLoading() {
  return (
    <>
      <RepBarSkeleton />
      <MobileListSkeleton rows={4} />
    </>
  );
}
