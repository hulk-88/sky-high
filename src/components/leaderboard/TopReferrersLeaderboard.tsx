
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Gift, Medal, Award as AwardIcon } from 'lucide-react'; // Renamed Award to AwardIcon to avoid conflict

interface Referrer {
  rank: number;
  name: string;
  bonusEarned: number;
  medal?: 'gold' | 'silver' | 'bronze';
}

const generateMockReferrers = (): Referrer[] => {
  const referrers: Omit<Referrer, 'rank' | 'medal'>[] = [];
  const names = ["ReferralGuru", "BonusHunter", "NetworkKing", "AffiliateAce", "ShareMaster", "LinkLord", "ConnectPro", "UsdtMagnet", "BonusBoss", "SocialSharer"];
  for (let i = 0; i < 10; i++) {
    referrers.push({
      name: `${names[i % names.length]}${Math.floor(Math.random() * 899) + 100}`, // e.g. ReferralGuru123
      bonusEarned: Math.floor(Math.random() * (1000 - 50 + 1)) + 50, // Bonus between 50 and 1000 USDT
    });
  }
  return referrers
    .sort((a, b) => b.bonusEarned - a.bonusEarned)
    .map((referrer, index) => ({
      ...referrer,
      rank: index + 1,
      medal: index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : undefined,
    }));
};

export function TopReferrersLeaderboard() {
  const [topReferrers, setTopReferrers] = useState<Referrer[]>([]);

  useEffect(() => {
    setTopReferrers(generateMockReferrers());
  }, []);

  const getMedalIcon = (medal?: 'gold' | 'silver' | 'bronze') => {
    if (medal === 'gold') return <AwardIcon className="h-5 w-5 text-yellow-500" />;
    if (medal === 'silver') return <Medal className="h-5 w-5 text-slate-400" />;
    if (medal === 'bronze') return <AwardIcon className="h-5 w-5 text-orange-400" />; // Using AwardIcon for bronze too, or could be Gem
    return null;
  };

  if (topReferrers.length === 0) {
     return (
        <Card className="w-full shadow-xl bg-card/90 backdrop-blur-sm">
            <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-2">
                <Gift className="w-7 h-7 text-primary" />
                Top Referrers (Daily)
                </CardTitle>
                <CardDescription>See who's maximizing referral bonuses!</CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground text-center py-8">Loading top referrers...</p>
            </CardContent>
        </Card>
     );
  }

  return (
    <Card className="w-full shadow-xl bg-card/90 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-2xl flex items-center gap-2">
          <Gift className="w-7 h-7 text-primary" />
          Top Referrers (Daily)
        </CardTitle>
        <CardDescription>Users with the highest referral bonuses earned today.</CardDescription>
      </CardHeader>
      <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">Rank</TableHead>
                <TableHead>Referrer</TableHead>
                <TableHead className="text-right">Bonus Earned (USDT)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topReferrers.slice(0, 5).map((referrer) => ( // Display top 5
                <TableRow key={referrer.rank}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {getMedalIcon(referrer.medal) || <span className="inline-block w-5 h-5"></span>}
                      {referrer.rank}
                    </div>
                  </TableCell>
                  <TableCell>{referrer.name}</TableCell>
                  <TableCell className="text-right text-accent font-semibold">
                    {referrer.bonusEarned.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
      </CardContent>
    </Card>
  );
}
