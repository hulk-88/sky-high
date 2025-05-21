
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, DollarSign, Activity, Percent, ShieldOff, CheckCircle, AlertTriangle, Loader2, Award, Gift } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getUsers } from "@/lib/user-auth"; 
import { getAllTransactions } from "@/lib/transaction-storage";
import { getSiteSettings } from "@/lib/site-settings-storage";
import type { AdminTransaction, TopReferrerStat, User as AppUser, AdminSiteSettings } from "@/types"; // Added TopReferrerStat and User

interface AdminDashboardStats {
  totalUsers: number;
  activeGames: number; 
  totalVolume: number; 
  winPercentage: number; 
  lossPercentage: number; 
  blockedUsers: number;
  pendingDeposits: number;
  pendingWithdrawals: number;
}

interface MonthlyGameData {
  name: string;
  Wins: number;
  Losses: number;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [gameData, setGameData] = useState<MonthlyGameData[]>([]); 
  const [isLoading, setIsLoading] = useState(true);
  const [topReferrers, setTopReferrers] = useState<TopReferrerStat[]>([]);

  useEffect(() => {
    setIsLoading(true);
    const fetchData = async () => {
      await new Promise(resolve => setTimeout(resolve, 500)); 
      
      const allUsers = getUsers();
      const allTransactions = getAllTransactions(); 
      const siteSettings = getSiteSettings();

      let calculatedTotalVolume = 0;
      allTransactions.forEach(txn => {
        if (txn.type === 'deposit' && txn.status === 'approved') {
          calculatedTotalVolume += txn.amount; 
        }
      });

      const calculatedPendingDeposits = allTransactions.filter(t => t.type === 'deposit' && t.status === 'pending').length;
      const calculatedPendingWithdrawals = allTransactions.filter(t => t.type === 'withdrawal' && t.status === 'pending').length;
      
      const calculatedStats: AdminDashboardStats = {
        totalUsers: allUsers.length,
        activeGames: 0, 
        totalVolume: calculatedTotalVolume,
        winPercentage: 0, 
        lossPercentage: 0, 
        blockedUsers: allUsers.filter(u => u.isBlocked).length,
        pendingDeposits: calculatedPendingDeposits,
        pendingWithdrawals: calculatedPendingWithdrawals,
      };
      setStats(calculatedStats);
      
      // Calculate Top Referrers
      const referrersData = allUsers.map(user => {
        let totalCommissionEarnedFromMyReferrals = 0;
        if (user.referredUsers && user.referredUsers.length > 0) {
          user.referredUsers.forEach(referredDetail => {
            totalCommissionEarnedFromMyReferrals += referredDetail.totalDepositedApproved * (siteSettings.referralBonusPercent / 100);
          });
        }
        return {
          userId: user.id,
          username: user.username,
          email: user.email,
          successfulReferrals: user.successfulReferralsCount || 0,
          totalCommissionEarned: totalCommissionEarnedFromMyReferrals,
          totalReferredUsersCount: user.referredUsers?.length || 0,
        };
      })
      .filter(r => r.totalCommissionEarned > 0 || r.successfulReferrals > 0) // Keep only those who earned commission or have successful referrals
      .sort((a, b) => b.totalCommissionEarned - a.totalCommissionEarned) // Sort by commission earned
      .slice(0, 10) // Take top 10
      .map((r, index) => ({ ...r, rank: index + 1 })); // Add rank

      setTopReferrers(referrersData);
      
      setGameData([]); 
      
      setIsLoading(false);
    };
    fetchData();
    
    const intervalId = setInterval(fetchData, 5000);
    return () => clearInterval(intervalId);

  }, []);

  if (isLoading && !stats) { 
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg text-muted-foreground">Loading dashboard data...</p>
      </div>
    );
  }

  if (!stats) { 
     return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
            <AlertTriangle className="h-12 w-12 text-destructive" />
            <p className="mt-4 text-lg text-muted-foreground">Dashboard data could not be loaded.</p>
             <p className="text-sm text-muted-foreground">Win/Loss percentages and game performance charts are illustrative.</p>
        </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-primary">Admin Overview</h1>
       <p className="text-muted-foreground">Summary of key platform metrics. Some data like win/loss ratios are illustrative and would require game event tracking.</p>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Users" value={stats.totalUsers.toLocaleString()} icon={<Users className="h-6 w-6 text-primary" />} description="Registered users on the platform" />
        <StatCard title="Active Games" value={stats.activeGames.toLocaleString()} icon={<Activity className="h-6 w-6 text-green-500" />} description="Current live games (illustrative)" />
        <StatCard title="Total Approved Deposits (USDT)" value={stats.totalVolume.toLocaleString('en-US', { style: 'currency', currency: 'USD' }).replace('$', '')} icon={<DollarSign className="h-6 w-6 text-blue-500" />} description="Sum of all approved deposits" />
        <StatCard title="Blocked Users" value={stats.blockedUsers.toLocaleString()} icon={<ShieldOff className="h-6 w-6 text-red-500" />} description="Users currently blocked" />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Game Win/Loss Ratio (Illustrative)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-around items-center">
              <div className="text-center">
                <Percent className="h-8 w-8 text-accent mx-auto mb-1" />
                <p className="text-2xl font-bold">{stats.winPercentage.toFixed(1)}%</p>
                <p className="text-sm text-muted-foreground">Player Wins</p>
              </div>
              <div className="text-center">
                <Percent className="h-8 w-8 text-destructive mx-auto mb-1" />
                <p className="text-2xl font-bold">{stats.lossPercentage.toFixed(1)}%</p>
                <p className="text-sm text-muted-foreground">Player Losses (House Wins)</p>
              </div>
            </div>
             {(stats.winPercentage === 0 && stats.lossPercentage === 0) && (
                <p className="text-center text-muted-foreground mt-4">Game win/loss ratio is illustrative and requires game event tracking.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Pending Transactions</CardTitle>
            <CardDescription>Live counts of transactions awaiting approval.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
             <div className="flex items-center justify-between">
                <div className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                    <span className="text-sm">Pending Deposits</span>
                </div>
                <span className="font-semibold text-lg">{stats.pendingDeposits}</span>
            </div>
            <div className="flex items-center justify-between">
                <div className="flex items-center">
                    <AlertTriangle className="h-5 w-5 text-yellow-500 mr-2" />
                    <span className="text-sm">Pending Withdrawals</span>
                </div>
                <span className="font-semibold text-lg">{stats.pendingWithdrawals}</span>
            </div>
            {(stats.pendingDeposits === 0 && stats.pendingWithdrawals === 0) && (
                 <p className="text-center text-muted-foreground pt-2">No pending deposits or withdrawals currently.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl flex items-center"><Gift className="mr-2 h-5 w-5 text-yellow-500" /> Top 10 Referrers</CardTitle>
          <CardDescription>Users with the highest referral commissions earned.</CardDescription>
        </CardHeader>
        <CardContent>
          {topReferrers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">Rank</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-center">Successful Referrals</TableHead>
                  <TableHead className="text-right">Total Commission (USDT)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topReferrers.map((referrer) => (
                  <TableRow key={referrer.userId}>
                    <TableCell className="font-medium">{referrer.rank}</TableCell>
                    <TableCell>{referrer.username}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{referrer.email}</TableCell>
                    <TableCell className="text-center">{referrer.successfulReferrals}</TableCell>
                    <TableCell className="text-right font-semibold text-green-500">{referrer.totalCommissionEarned.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-center py-10">No referral data available yet.</p>
          )}
        </CardContent>
      </Card>

       <Card>
        <CardHeader>
          <CardTitle className="text-xl">Monthly Game Performance (Illustrative)</CardTitle>
          <CardDescription>Chart data is illustrative and would be populated from aggregated game records.</CardDescription>
        </CardHeader>
        <CardContent className="h-[350px]">
        {gameData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={gameData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="Wins" fill="hsl(var(--accent))" />
              <Bar dataKey="Losses" fill="hsl(var(--destructive))" />
            </BarChart>
          </ResponsiveContainer>
          ) : <p className="text-muted-foreground text-center py-10">No game performance data available for chart. This section is illustrative.</p>}
        </CardContent>
      </Card>

    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description?: string;
}

function StatCard({ title, value, icon, description }: StatCardProps) {
  return (
    <Card className="shadow-md hover:shadow-lg transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
        {description && <p className="text-xs text-muted-foreground pt-1">{description}</p>}
      </CardContent>
    </Card>
  );
}
