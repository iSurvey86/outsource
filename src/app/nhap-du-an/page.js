"use client";

import { Suspense } from "react";
import NhapDuAnClient from "./NhapDuAnClient";

export default function NhapDuAnPage() {
  return (
    <Suspense fallback={<p className="text-sm font-bold text-teal-800">Đang tải…</p>}>
      <NhapDuAnClient />
    </Suspense>
  );
}
