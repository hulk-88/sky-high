
"use client";

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { Toaster } from "@/components/ui/toaster";
import { isAdminLoggedIn } from "@/lib/admin-auth";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname(); // To ensure this runs for any admin path
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = () => {
      setIsLoading(true);
      const loggedIn = isAdminLoggedIn();
      if (loggedIn) {
        setIsAuthorized(true);
      } else {
        // If not logged in, redirect to the main login page with a query param to indicate admin login attempt
        // And a message.
        router.replace(`/login?attemptAdmin=true&message=Admin%20access%20required.%20Please%20log%20in.`);
      }
      setIsLoading(false);
    };
    checkAuth();
  }, [router, pathname]); // Rerun on pathname change to protect all admin routes

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background text-foreground">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="ml-3 text-lg">Loading Admin Area...</p>
      </div>
    );
  }
  
  if (!isAuthorized) {
    // This state should ideally not be reached if redirection works correctly from useEffect.
    // It serves as a fallback UI during the brief moment before redirection or if JS fails.
    return (
        <div className="flex items-center justify-center min-h-screen bg-background text-foreground">
            <p className="text-lg text-destructive">Access Denied. Redirecting to login...</p>
        </div>
    );
  }

  // Authorized, show sidebar and content
  return (
    <div className="flex min-h-screen bg-muted/40">
      <AdminSidebar />
      <main className="flex-1 p-6 overflow-auto">
        {children}
      </main>
      <Toaster />
    </div>
  );
}
