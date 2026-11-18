import { redirect } from "next/navigation";

/** Settings opens on its first part. */
export default function SettingsHome() { redirect("/admin/settings/payments"); }
