"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { handleError, type ErrorType } from "@/types/error";
import { signIn as nextAuthSignIn } from "next-auth/react";
import { encryptEmail } from "@/lib/crypto";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    console.log("Attempting to sign in with email:", email);

    try {
      const result = await nextAuthSignIn("resend", {
        email,
        redirect: false,
        callbackUrl: "/dashboard",
      });

      console.log("Sign in result:", result);

      if (result?.error) {
        throw {
          message: result.error === "EmailSignin"
            ? "Failed to send login email"
            : "Failed to sign in",
          code: result.error,
          status: 400
        } as ErrorType;
      }

      toast.success("Check your email for the login link");
      const encryptedEmail = encryptEmail(email);
      router.push(`/verify?email=${encodeURIComponent(encryptedEmail)}`);
    } catch (error) {
      console.error("Sign in error:", error);
      handleError(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSocialSignIn = (provider: "google" | "github") => {
    setLoading(true);
    nextAuthSignIn(provider, {
      callbackUrl: "/dashboard",
    }).catch((error) => {
      console.error(`${provider} sign in error:`, error);
      handleError({
        message: `Failed to sign in with ${provider}`,
        code: `${provider}_signin_error`,
        status: 400
      });
      setLoading(false);
    });
  };

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-2xl">Sign In</CardTitle>
        <CardDescription>
          Enter your email to sign in to your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="m@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={loading || !email}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending link...
              </>
            ) : (
              "Send magic link"
            )}
          </Button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>

          <div className="grid gap-2">
            <Button
              variant="outline"
              onClick={() => handleSocialSignIn("google")}
              type="button"
              disabled={loading}
            >
              Google
            </Button>
            <Button
              variant="outline"
              onClick={() => handleSocialSignIn("github")}
              type="button"
              disabled={loading}
            >
              GitHub
            </Button>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="text-accent hover:text-accent/80"
            >
              Sign up
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
