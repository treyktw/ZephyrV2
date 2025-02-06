// app/page.tsx
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await auth();

  // Redirect to dashboard if authenticated, login if not
  if (session?.user) {
    redirect('/dashboard');
  } else {
    redirect('/login');
  }
}
