
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Award, Medal, Gem } from 'lucide-react'; // Gem for general top, Award/Medal for specific ranks

interface Player {
  rank: number;
  name: string;
  profit: number;
  medal?: 'gold' | 'silver' | 'bronze';
}

const generateMockPlayers = (): Player[] => {
  const players: Omit<Player, 'rank' | 'medal'>[] = [];
  const names = ["SkyPilot", "AceFlyer", "USDTMaster", "MultiplierMax", "ProfitKing", "CryptoJet", "HighRoller", "WinStreak", "LuckyBird", "BetBaron"];
  for (let i = 0; i < 10; i++) {
    players.push({
      name: `${names[i]}${Math.floor(Math.random() * 900) + 100}`, // e.g. SkyPilot123
      profit: Math.floor(Math.random() * (50000 - 1000 + 1)) + 1000, // Profit between 1000 and 50000
    });
  }
  return players
    .sort((a, b) => b.profit - a.profit)
    .map((player, index) => ({
      ...player,
      rank: index + 1,
      medal: index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : undefined,
    }));
};

export function TopPlayersLeaderboard() {
  const [topPlayers, setTopPlayers] = useState<Player[]>([]);

  useEffect(() => {
    // Generate players only on the client-side to avoid hydration issues
    setTopPlayers(generateMockPlayers());
    
    // Optionally, refresh periodically if you want dynamic mock data
    // const interval = setInterval(() => {
    //   setTopPlayers(generateMockPlayers());
    // }, 60000); // Refresh every minute
    // return () => clearInterval(interval);
  }, []);

  const getMedalIcon = (medal?: 'gold' | 'silver' | 'bronze') => {
    if (medal === 'gold') return <Award className="h-5 w-5 text-yellow-500" />;
    if (medal === 'silver') return <Medal className="h-5 w-5 text-slate-400" />;
    if (medal === 'bronze') return <Gem className="h-5 w-5 text-orange-400" />; 
    return null;
  };

  if (topPlayers.length === 0) {
     return (
        <Card className="w-full shadow-xl bg-card/90 backdrop-blur-sm">
            <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-2">
                <Award className="w-7 h-7 text-primary" />
                Top Players (Daily)
                </CardTitle>
                <CardDescription>See who's leading the Sky High charts!</CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground text-center py-8">Loading leaderboard...</p>
            </CardContent>
        </Card>
     );
  }

  return (
    <Card className="w-full shadow-xl bg-card/90 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-2xl flex items-center gap-2">
          <Award className="w-7 h-7 text-primary" />
          Top Players (Daily)
        </CardTitle>
        <CardDescription>See who's leading the Sky High charts!</CardDescription>
      </CardHeader>
      <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">Rank</TableHead>
                <TableHead>Player</TableHead>
                <TableHead className="text-right">Profit (USDT)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topPlayers.map((player) => (
                <TableRow key={player.rank}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {getMedalIcon(player.medal) || <span className="inline-block w-5 h-5"></span>}
                      {player.rank}
                    </div>
                  </TableCell>
                  <TableCell>{player.name}</TableCell>
                  <TableCell className="text-right text-accent font-semibold">
                    {player.profit.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
      </CardContent>
    </Card>
  );
}
