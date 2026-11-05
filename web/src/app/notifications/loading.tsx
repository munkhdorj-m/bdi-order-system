import { MobileListSkeleton, RepBarSkeleton } from "@/components/page-skeletons";

export default function NotificationsLoading() {
  return (
    <>
      <RepBarSkeleton />
      <MobileListSkeleton />
    </>
  );
}
