/**
 * /dashboard — consolidated into the single-UI app shell. Deep links redirect to
 * /app with the dashboard view selected (one UI: left side menu, right content).
 */
import { redirect } from "next/navigation";

export default function DashboardPage() {
  redirect("/app?view=dashboard");
}
