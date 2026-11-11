import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F7F5FB] px-4">
      <div className="text-center">
        <p className="text-6xl font-bold text-[#7D5CEF]">404</p>
        <h1 className="mt-4 text-2xl font-semibold text-[#17151F]">Page not found</h1>
        <p className="mt-2 text-[#6B6680]">The page you're looking for doesn't exist or has been moved.</p>
        <Link
          href="/dashboard"
          className="mt-8 inline-block rounded-lg bg-[#7D5CEF] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#5B3FD0] transition-colors"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
