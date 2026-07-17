import { Suspense } from "react";
import LineAuthCallback from "@/components/LineAuthCallback";

export const dynamic = "force-dynamic";

export default function LineCallbackPage() {
  return (
    <Suspense fallback={<div>กำลังตรวจสอบ LINE login...</div>}>
      <LineAuthCallback />
    </Suspense>
  );
}
