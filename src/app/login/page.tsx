
"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, User, Shield } from "lucide-react";
import Link from "next/link";
import { isAdminLoggedIn } from "@/lib/admin-auth";
import { LoginForm } from "@/components/auth/LoginForm";
import { AdminLoginForm } from "@/components/auth/AdminLoginForm";
import { isUserAuthenticated as isRegularUserAuthenticated } from "@/lib/user-auth"; 

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [message, setMessage] = useState<string | null>(null);
  const [attemptAdminLogin, setAttemptAdminLogin] = useState(false);

  useEffect(() => {
    const queryMessage = searchParams.get("message");
    if (queryMessage) {
      setMessage(decodeURIComponent(queryMessage));
    }
    
    const isAdminLoginAttempt = searchParams.get("attemptAdmin") === "true";
    setAttemptAdminLogin(isAdminLoginAttempt);

    const adminIsLoggedIn = isAdminLoggedIn();
    const userIsLoggedIn = isRegularUserAuthenticated();

    if (isAdminLoginAttempt) {
      if (adminIsLoggedIn) {
        router.replace("/admin");
      }
    } else { // This is a regular user login page attempt
      if (userIsLoggedIn) {
        router.replace('/');
      } else if (adminIsLoggedIn) {
        // If user tries to access regular login but is already admin, redirect to admin panel
        router.replace("/admin");
      }
    }
  }, [router, searchParams]);

  const handleUserLoginSuccess = () => {
    router.push('/'); 
  };

  const handleAdminLoginSuccess = () => {
    router.push('/admin');
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-2">
            {attemptAdminLogin ? <Shield className="h-10 w-10 text-primary" /> : <User className="h-10 w-10 text-primary" /> }
          </div>
          <CardTitle className="text-3xl font-bold text-primary">
            {attemptAdminLogin ? "Admin Login" : "Login"}
          </CardTitle>
          <CardDescription>
            {attemptAdminLogin ? "Access the Sky High USDT administration panel." : "Access your Sky High USDT account."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {message && (
            <div className="mb-4 flex items-center text-sm text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 p-3 rounded-md">
              <AlertTriangle className="h-4 w-4 mr-2 text-blue-500" />
              {message}
            </div>
          )}
          {attemptAdminLogin ? (
            <AdminLoginForm onLoginSuccess={handleAdminLoginSuccess} />
          ) : (
            <LoginForm onLoginSuccess={handleUserLoginSuccess} />
          )}
        </CardContent>
        {!attemptAdminLogin && (
          <CardFooter className="flex flex-col items-center gap-2 pt-4">
            <p className="text-sm text-muted-foreground">
              Don&apos;t have an account?
            </p>
            <Button variant="link" asChild className="p-0">
              <Link href="/signup">Sign Up</Link>
            </Button>
          </CardFooter>
        )}
      </Card>
      
      {attemptAdminLogin ? (
         <Button variant="outline" asChild className="mt-8">
            <Link href="/login">User Login</Link>
         </Button>
      ) : (
        <Button variant="outline" asChild className="mt-8">
            <Link href="/">Back to Game</Link>
        </Button>
      )}

      {!attemptAdminLogin && (
        <p className="text-xs text-muted-foreground mt-4">
          <Link href="/login?attemptAdmin=true" className="underline hover:text-primary">Switch to Admin Login</Link>
        </p>
      )}
    </div>
  );
}

