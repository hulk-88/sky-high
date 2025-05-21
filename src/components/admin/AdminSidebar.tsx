
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Users, ListChecks, Settings, BarChart3, LogOut, Home, MessageSquare } from "lucide-react";
import { setAdminLoggedInCookie } from "@/lib/admin-auth";
import { getTicketsRequiringAdminReplyCount } from "@/lib/support-ticket-storage";
import { getPendingTransactionsCount } from "@/lib/transaction-storage";
import { useEffect, useState } from "react";

const adminNavItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users Management", icon: Users },
  { href: "/admin/transactions", label: "Transactions", icon: ListChecks, notificationKey: "transactions" },
  { href: "/admin/support-tickets", label: "Support Tickets", icon: MessageSquare, notificationKey: "support" },
  { href: "/admin/stats", label: "Game Statistics", icon: BarChart3 },
  { href: "/admin/settings", label: "Site Settings", icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingSupportTicketsCount, setPendingSupportTicketsCount] = useState(0);
  const [pendingTransactionsCount, setPendingTransactionsCount] = useState(0);

  useEffect(() => {
    const fetchCounts = () => {
      setPendingSupportTicketsCount(getTicketsRequiringAdminReplyCount());
      setPendingTransactionsCount(getPendingTransactionsCount());
    };
    fetchCounts(); // Initial fetch
    const intervalId = setInterval(fetchCounts, 5000); // Refresh every 5 seconds

    // Listen to storage changes to update immediately if another tab modifies tickets or transactions
    const handleStorageChange = (event: StorageEvent) => {
        if (event.key === "skyhigh_support_tickets_v1" || event.key === "skyhigh_admin_transactions_v1") {
            fetchCounts();
        }
    };
    if (typeof window !== "undefined") {
        window.addEventListener('storage', handleStorageChange);
    }

    return () => {
      clearInterval(intervalId);
      if (typeof window !== "undefined") {
        window.removeEventListener('storage', handleStorageChange);
      }
    }
  }, []);

  const handleLogout = () => {
    setAdminLoggedInCookie(false);

    if (typeof window !== 'undefined') {
        localStorage.removeItem('skyhigh_isAdmin_view_preference');
    }
    router.push('/login?message=Successfully%20logged%20out');
  };

  return (
    <aside className="sticky top-0 h-screen w-64 bg-card border-r flex flex-col shadow-lg">
      <div className="p-4 border-b">
        <Link href="/admin" className="flex items-center gap-2">
           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-8 w-8 text-primary">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
          </svg>
          <h1 className="text-xl font-bold text-primary">Admin Panel</h1>
        </Link>
      </div>
      <ScrollArea className="flex-1">
        <nav className="p-4 space-y-2">
          {adminNavItems.map((item) => (
            <Button
              key={item.label}
              asChild
              variant={pathname === item.href || (pathname.startsWith(item.href) && item.href !== "/admin") ? "secondary" : "ghost"}
              className={cn(
                "w-full justify-start text-base relative",
                (pathname === item.href || (pathname.startsWith(item.href) && item.href !== "/admin")) && "font-semibold"
              )}
            >
              <Link href={item.href} className="flex items-center w-full">
                <item.icon className="mr-3 h-5 w-5" />
                <span className="flex-1">{item.label}</span>
                {item.notificationKey === "support" && pendingSupportTicketsCount > 0 && (
                  <Badge variant="destructive" className="ml-auto h-5 px-1.5 text-xs">
                    {pendingSupportTicketsCount}
                  </Badge>
                )}
                {item.notificationKey === "transactions" && pendingTransactionsCount > 0 && (
                  <Badge variant="destructive" className="ml-auto h-5 px-1.5 text-xs">
                    {pendingTransactionsCount}
                  </Badge>
                )}
              </Link>
            </Button>
          ))}
        </nav>
      </ScrollArea>
      <div className="p-4 border-t space-y-2">
         <Button
            asChild
            variant="outline"
            className="w-full justify-start text-base"
          >
            <Link href="/">
              <Home className="mr-3 h-5 w-5" />
              Back to Game
            </Link>
          </Button>
        <Button
          variant="outline"
          className="w-full justify-start text-base text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={handleLogout}
        >
          <LogOut className="mr-3 h-5 w-5" />
          Logout Admin
        </Button>
      </div>
    </aside>
  );
}
