import { redirect } from "next/navigation";

/** Expenses now live in Accounts (every taka in or out, per account). */
export default function ExpensesRedirect() {
  redirect("/accounts?tab=out");
}
