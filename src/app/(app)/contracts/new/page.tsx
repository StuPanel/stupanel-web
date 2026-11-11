"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ContractEditor } from "../_components/contract-editor";

function Inner() {
  const sp = useSearchParams();
  return <ContractEditor programId={sp.get("program") ?? undefined} templateId={sp.get("template") ?? undefined} />;
}
export default function NewContractPage() {
  return <Suspense fallback={null}><Inner /></Suspense>;
}
