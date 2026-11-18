import { redirect } from "next/navigation";

/** Team costs now live in Team pay. */
export default function TeamCostsRedirect() {
  redirect("/team-pay?tab=costs");
}
