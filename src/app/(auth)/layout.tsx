import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";

// Signed-in users have no business on the sign-in screens.
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await getCurrentUser()) redirect("/");
  return children;
}
