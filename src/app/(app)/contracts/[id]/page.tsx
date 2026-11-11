"use client";

import { Suspense, use } from "react";
import { useSearchParams } from "next/navigation";
import { ContractEditor } from "../_components/contract-editor";

function Inner({ id }: { id: string }) {
  const share = useSearchParams().get("share") === "1";
  return <ContractEditor key={id} id={id} openShare={share} />;
}
export default function ContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <Suspense fallback={null}><Inner id={id} /></Suspense>;
}
