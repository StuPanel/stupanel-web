export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F5FB]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 rounded-full border-4 border-indigo-200 border-t-[#7D5CEF] animate-spin" />
        <p className="text-sm text-[#6B6680]">Loading...</p>
      </div>
    </div>
  );
}
