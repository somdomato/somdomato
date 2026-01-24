"use client";

import { useRouter } from "next/navigation";
import { RequestModal } from "@/components/RequestModal";

export default function ModalClient() {
  const router = useRouter();

  return <RequestModal isOpen={true} onClose={() => router.back()} />;
}
