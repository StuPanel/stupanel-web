import { redirect } from "next/navigation";

/** The admin team now lives in Settings. */
export default function TeamRedirect() { redirect("/admin/settings/team"); }
