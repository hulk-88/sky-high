
"use client";

import { Wallet, LogIn, UserPlus, LogOut, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { WalletActions } from "@/components/wallet/WalletActions";

interface AppHeaderProps {
  userBalance: number;
  isAuthenticated: boolean;
  isAdmin: boolean; // This prop will reflect the actual admin logged-in status
  onLogout: () => void;
  onDeposit: (amount: number, transferProofImage: string | null) => Promise<boolean>;
  onWithdraw: (amount: number, address: string) => Promise<boolean>;
}

export function AppHeader({ userBalance, isAuthenticated, isAdmin, onLogout, onDeposit, onWithdraw }: AppHeaderProps) {
  return (
    <header className="w-full max-w-7xl py-4 px-2 sm:px-0 flex justify-between items-center">
      <Link href="/" className="text-2xl sm:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary via-blue-400 to-teal-300">
        Sky High USDT
      </Link>
      <div className="flex items-center gap-1 sm:gap-2">
        {isAuthenticated ? (
          <>
            <div className="flex items-center gap-2 p-2 px-3 sm:px-4 rounded-lg bg-card/80 shadow">
              <Wallet className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              <span className="text-md sm:text-lg font-semibold text-foreground">
                {userBalance.toFixed(2)} <span className="text-xs sm:text-sm text-muted-foreground">USDT</span>
              </span>
            </div>
            <WalletActions onDeposit={onDeposit} onWithdraw={onWithdraw} />
            {isAdmin && ( // Button visible if isAdmin prop (from isAdminLoggedIn()) is true
              <Button variant="outline" size="sm" asChild className="hidden sm:inline-flex">
                <Link href="/admin">
                  <ShieldCheck className="mr-2 h-4 w-4" /> Admin Panel
                </Link>
              </Button>
            )}
             <Button variant="ghost" size="icon" onClick={onLogout} title="Logout">
              <LogOut className="w-5 h-5" />
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" asChild size="sm">
              <Link href="/login">
                <LogIn className="mr-2 h-4 w-4" /> Login
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/signup">
                <UserPlus className="mr-2 h-4 w-4" /> Sign Up
              </Link>
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
