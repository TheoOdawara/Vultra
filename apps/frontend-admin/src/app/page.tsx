import { redirect } from "next/navigation";

/** Root "/" redirects to the dashboard. Auth guard is enforced by middleware. */
export default function RootPage() {
  redirect("/dashboard");
}
