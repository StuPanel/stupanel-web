import { redirect } from "next/navigation";

/** Feature flags now live in Settings. */
export default function FeatureFlagsRedirect() { redirect("/admin/settings/features"); }
