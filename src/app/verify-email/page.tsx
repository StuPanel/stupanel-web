"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { API_URL as API } from "@/lib/api";


function VerifyEmailContent() {
  const params = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setStatus("error");
      setMessage("Invalid verification link.");
      return;
    }

    fetch(`${API}/auth/verify-email?token=${token}`)
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) {
          setStatus("success");
          setMessage(data.message || "Email verified successfully!");
          setTimeout(() => router.replace("/dashboard"), 3000);
        } else {
          setStatus("error");
          setMessage(data.message || "Verification failed. Link may be expired.");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Something went wrong. Please try again.");
      });
  }, [params, router]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-[#E4E0EC] p-10 max-w-md w-full text-center">
      {status === "loading" && (
        <>
          <Loader2 className="w-14 h-14 text-[#7D5CEF] animate-spin mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-[#17151F]">Verifying your email...</h1>
          <p className="text-[#6B6680] mt-2 text-sm">Please wait a moment.</p>
        </>
      )}

      {status === "success" && (
        <>
          <CheckCircle className="w-14 h-14 text-[#1F8A5B] mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-[#17151F]">Email Verified!</h1>
          <p className="text-[#6B6680] mt-2 text-sm">{message}</p>
          <p className="text-[#8A8599] mt-4 text-xs">Redirecting to dashboard in 3 seconds...</p>
        </>
      )}

      {status === "error" && (
        <>
          <XCircle className="w-14 h-14 text-[#C2304F] mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-[#17151F]">Verification Failed</h1>
          <p className="text-[#6B6680] mt-2 text-sm">{message}</p>
          <button
            onClick={() => router.replace("/dashboard")}
            className="mt-6 inline-block bg-[#7D5CEF] text-white text-sm font-semibold px-6 py-2.5 rounded-lg hover:bg-[#5B3FD0] transition-colors"
          >
            Go to Dashboard
          </button>
        </>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen bg-[#F7F5FB] flex items-center justify-center p-4">
      <Suspense
        fallback={
          <div className="bg-white rounded-2xl shadow-sm border border-[#E4E0EC] p-10 max-w-md w-full text-center">
            <Loader2 className="w-14 h-14 text-[#7D5CEF] animate-spin mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-[#17151F]">Loading...</h1>
          </div>
        }
      >
        <VerifyEmailContent />
      </Suspense>
    </div>
  );
}
