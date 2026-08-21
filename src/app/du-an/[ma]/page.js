"use client";

import { Suspense } from "react";
import DuAnWorkspaceClient from "./DuAnWorkspaceClient";

export default function DuAnWorkspacePage() {
  return (
    <Suspense fallback={<p className="text-sm font-bold text-teal-800">Đang tải…</p>}>
      <DuAnWorkspaceClient />
    </Suspense>
  );
}
