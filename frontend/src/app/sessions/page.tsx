"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SessionsPage() {
  const router = useRouter();

  useEffect(() => {
    // Sessions are now in the sidebar — redirect to home
    router.replace("/");
  }, [router]);

  return null;
}
