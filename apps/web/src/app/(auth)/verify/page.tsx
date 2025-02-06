// app/(auth)/verify/page.tsx
"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MailCheck, Loader2 } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { signIn } from "next-auth/react";
import { decryptEmail } from "@/lib/crypto";

export default function VerifyPage() {
  const [loading, setLoading] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState<string>("");
  const searchParams = useSearchParams();
  const encryptedEmail = searchParams.get("email");

  useEffect(() => {
    if (encryptedEmail) {
      const email = decryptEmail(encryptedEmail);
      // Mask email for display (e.g., t***x@gmail.com)
      const [localPart, domain] = email.split('@');
      const maskedLocal = localPart.charAt(0) + '***' + localPart.charAt(localPart.length - 1);
      setMaskedEmail(`${maskedLocal}@${domain}`);
    }
  }, [encryptedEmail]);

  const resendVerification = async () => {
    if (!encryptedEmail) {
      toast.error("No email found");
      return;
    }

    setLoading(true);
    try {
      const email = decryptEmail(encryptedEmail);
      await signIn("resend", {
        email,
        redirect: false,
      });
      toast.success("Verification email sent!");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      toast.error("Failed to resend verification email", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Check your email</CardTitle>
        <CardDescription>
          {maskedEmail
            ? `We've sent a verification link to ${maskedEmail}`
            : "We've sent you a verification link"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-center py-4">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{
              type: "spring",
              stiffness: 100,
              damping: 10
            }}
          >
            <MailCheck className="h-12 w-12 text-accent" />
          </motion.div>
        </div>

        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            Didn&apos;t receive an email? Check your spam folder or
          </p>
          <Button
            variant="link"
            className="p-0"
            onClick={resendVerification}
            disabled={loading || !encryptedEmail}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              "Click here to resend"
            )}
          </Button>
        </div>

        <div className="text-center">
          <Link href="/login">
            <Button variant="ghost">Back to login</Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
