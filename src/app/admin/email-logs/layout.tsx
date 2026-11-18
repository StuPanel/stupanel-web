import { AdminTabs } from "../_components/admin-tabs";

/** Joined with its sister page by tabs (see admin-tabs.tsx). */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <><AdminTabs set="emails" />{children}</>;
}
