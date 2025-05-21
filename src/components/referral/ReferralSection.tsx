
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getSiteSettings } from '@/lib/site-settings-storage';


interface ReferralSectionProps {
  referralCode: string | null;
}

export function ReferralSection({ referralCode }: ReferralSectionProps) {
  const [referralLink, setReferralLink] = useState("");
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);
  const [siteSettings, setSiteSettings] = useState(getSiteSettings());

  useEffect(() => {
    setIsClient(true);
    if (referralCode && typeof window !== 'undefined') {
      // Construct the user-specific referral link using current window origin
      setReferralLink(`${window.location.origin}/signup?ref=${referralCode}`);
    } else if (!referralCode) {
      setReferralLink("Log in to get your referral link.");
    }
     // Update site settings if they change dynamically (e.g. from admin panel in another tab)
    const handleStorageChange = (event: StorageEvent) => {
        if (event.key === "skyhigh_site_settings_v2") {
            setSiteSettings(getSiteSettings());
        }
    };
    if (typeof window !== 'undefined') {
        window.addEventListener('storage', handleStorageChange);
    }
    return () => {
        if (typeof window !== 'undefined') {
            window.removeEventListener('storage', handleStorageChange);
        }
    };
  }, [referralCode]);

  const handleCopyLink = () => {
    if(!isClient || !referralCode || !referralLink.includes("/signup?ref=")) return; // Check if it's a valid referral link
    navigator.clipboard.writeText(referralLink)
      .then(() => {
        toast({ title: "Link Copied!", description: "Referral link copied to clipboard." });
      })
      .catch(err => {
        toast({ title: "Copy Failed", description: "Could not copy link.", variant: "destructive" });
        console.error('Failed to copy: ', err);
      });
  };

  if (!isClient) {
    return null; // Or a skeleton loader
  }

  return (
    <Card className="mt-6 shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2">
          <Share2 className="w-6 h-6 text-primary" />
          Referral Program
        </CardTitle>
        <CardDescription>Share your link to earn bonuses!</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Invite friends to Sky High USDT! When they sign up using your unique referral link and deposit at least ${siteSettings.referralMinDepositForBonus.toFixed(2)}, 
          they get a ${siteSettings.newPlayerBonusUSDT.toFixed(2)} USDT starting bonus, and you earn {siteSettings.referralBonusPercent}% commission from their deposits automatically to your wallet.
        </p>
        <div className="flex items-center gap-2">
          <Input value={referralLink} readOnly className="bg-muted" aria-label="Referral Link" disabled={!referralCode || !referralLink.includes("/signup?ref=")} />
          <Button 
            variant="outline" 
            size="icon" 
            onClick={handleCopyLink} 
            title="Copy Referral Link"
            disabled={!referralCode || !referralLink.includes("/signup?ref=")}
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
        {/* Mock share button, can be expanded later */}
        {/* <Button className="w-full" disabled={!referralCode || !referralLink.includes("/signup?ref=")}>
          <Share2 className="mr-2 h-4 w-4" />
          More Ways to Share (Mock)
        </Button> */}
      </CardContent>
    </Card>
  );
}

