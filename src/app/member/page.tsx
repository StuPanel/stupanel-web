import { redirect } from "next/navigation";

/** /member on its own opens the member's dashboard (it was a 404). */
export default function MemberHome() {
  redirect("/member/dashboard");
}
