"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Redirect cũ /chia-noi-bo → /tai-chinh-noi-bo */
export default function ChiaNoiBoRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/tai-chinh-noi-bo");
  }, [router]);
  return <p className="text-sm font-bold text-teal-800">Đang chuyển…</p>;
}
