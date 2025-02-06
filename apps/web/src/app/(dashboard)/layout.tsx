import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (!session.user.emailVerified) {
    redirect("/verify");
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Add your dashboard navigation/header here */}
      <main>{children}</main>
    </div>
  );
}
