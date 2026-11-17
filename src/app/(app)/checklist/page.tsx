import { redirect } from "next/navigation";

/** Checklist is hidden for now (Faisal, 18-NOV-2026). The data and the API stay; an old link goes to Programs. */
export default function ChecklistPage() {
  redirect("/programs");
}
