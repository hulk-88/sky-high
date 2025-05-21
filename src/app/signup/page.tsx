
"use client";
import { SignupForm } from "@/components/auth/SignupForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from "react";

export default function SignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [referralCode, setReferralCode] = useState<string | null>(null);

  useEffect(() => {
    const refCode = searchParams.get('ref');
    if (refCode) {
      setReferralCode(refCode.trim()); // Trim whitespace for robustness
    }
  }, [searchParams]);

  const handleSignupSuccess = () => {
    // toast is handled in SignupForm
    router.push('/login?message=Signup%20successful!%20Please%20log%20in.');
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-primary">Create Account</CardTitle>
          <CardDescription>Join Sky High USDT and start playing.</CardDescription>
        </CardHeader>
        <CardContent>
          <SignupForm onSignupSuccess={handleSignupSuccess} initialReferralCode={referralCode} />
        </CardContent>
        <CardFooter className="flex flex-col items-center gap-2">
          <p className="text-sm text-muted-foreground">
            Already have an account?
          </p>
          <Button variant="link" asChild className="p-0">
            <Link href="/login">Login</Link>
          </Button>
        </CardFooter>
      </Card>
       <Button variant="outline" asChild className="mt-8">
        <Link href="/">Back to Game</Link>
      </Button>
    </div>
  );
}

