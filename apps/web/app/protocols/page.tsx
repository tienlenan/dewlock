/**
 * /protocols — consolidated into the single-UI app shell. Deep links redirect to
 * /app with the protocols view selected.
 */
import { redirect } from "next/navigation";

export default function ProtocolsPage() {
  redirect("/app?view=protocols");
}
