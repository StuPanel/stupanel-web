import { redirect } from "next/navigation";

/** Salary now lives in Team pay. */
export default function SalaryRedirect() {
  redirect("/team-pay");
}
