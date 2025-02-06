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

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !name) return;

    setLoading(true);
    console.log("Attempting to register with:", { email, name });

    try {
      // First create the user
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, name }),
      });

      if (!response.ok) {
        throw {
          message: response.status === 409
            ? "An account with this email already exists"
            : "Failed to create account",
          code: "registration_failed",
          status: response.status
        } as ErrorType;
      }

      // Then sign them in
      const result = await nextAuthSignIn("resend", {
        email,
        redirect: false,
        callbackUrl: "/dashboard",
      });

      if (result?.error) {
        throw {
          message: result.error === "EmailSignin"
            ? "Failed to send login email"
            : "Failed to sign in",
          code: result.error,
          status: 400
        } as ErrorType;
      }

      toast.success("Account created! Check your email for the login link");
      const encryptedEmail = encryptEmail(email);
      router.push(`/verify?email=${encodeURIComponent(encryptedEmail)}`);
    } catch (error) {
      console.error("Registration error:", error);
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
        <CardTitle className="text-2xl">Create Account</CardTitle>
        <CardDescription>
          Enter your details to create a new account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

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
            disabled={loading || !email || !name}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating account...
              </>
            ) : (
              "Create account"
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
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-accent hover:text-accent/80"
            >
              Sign in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
