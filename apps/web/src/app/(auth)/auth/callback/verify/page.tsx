// app/auth/callback/verify/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import LoadingPage from "@/app/loading";

export default function VerifyCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status, update } = useSession();
  const [verifying, setVerifying] = useState(true);

  useEffect(() => {
    const verifyUser = async () => {
      try {
        const token = searchParams.get("token");

        if (!token) {
          toast.error("Invalid verification link");
          router.push("/login");
          return;
        }

        // Verify the token
        const response = await fetch("/api/auth/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token }),
        });

        if (!response.ok) {
          throw new Error("Failed to verify email");
        }

        // Update the session to reflect email verification
        await update();
        console.log(session)
        toast.success("Email verified successfully!");
        router.push("/dashboard");
      } catch (error) {
        console.error("Verification error:", error);
        toast.error("Failed to verify email");
        router.push("/login");
      } finally {
        setVerifying(false);
      }
    };

    if (status === "loading") return;
    verifyUser();
  }, [router, searchParams, session, status, update]);

  if (verifying) {
    return <LoadingPage />;
  }

  return null;
}
