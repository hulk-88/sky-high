
"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DollarSign, Users, Percent, TrendingUp, TrendingDown, Gamepad2, AlertCircle, Activity, Loader2 } from "lucide-react";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getAllTransactions } from "@/lib/transaction-storage"; 
import { getUsers } from "@/lib/user-auth"; 

interface OverviewStats {
  totalWagered: number; 
  totalPlayerWins: number; 
  totalProfitForHouse: number; 
  uniquePlayersToday: number; 
  averageBetAmount: number; 
  biggestWinToday: number; 
  gamesPlayedToday: number; 
}

interface HourlyBetData { 
  hour: string;
  bets: number;
}

interface MultiplierDistributionData { 
  name: string;
  value: number;
}

const COLORS = ['hsl(var(--accent))', 'hsl(var(--destructive))', 'hsl(var(--primary))', 'hsl(var(--secondary))'];


export default function AdminStatsPage() {
  const [overviewStats, setOverviewStats] = useState<OverviewStats | null>(null);
  const [dailyBetsData, setDailyBetsData] = useState<HourlyBetData[]>([]); 
  const [multiplierDistributionData, setMultiplierDistributionData] = useState<MultiplierDistributionData[]>([]); 
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      setIsLoading(true); 
      await new Promise(resolve => setTimeout(resolve, 500)); 
      
      const allTransactions = getAllTransactions();
      const allUsers = getUsers();

      let calculatedTotalWagered = 0; 
      let calculatedTotalPlayerWins = 0; 

      allTransactions.forEach(txn => {
        if (txn.type === 'deposit' && txn.status === 'approved') {
          calculatedTotalWagered += (txn.amount || 0);
        } else if (txn.type === 'withdrawal' && txn.status === 'approved') {
          calculatedTotalPlayerWins += (txn.amount || 0);
        }
      });
      
      const calculatedProfitForHouse = calculatedTotalWagered - calculatedTotalPlayerWins;

      const calculatedOverviewStats: OverviewStats = {
        totalWagered: calculatedTotalWagered,
        totalPlayerWins: calculatedTotalPlayerWins, 
        totalProfitForHouse: calculatedProfitForHouse,
        uniquePlayersToday: allUsers.length, 
        averageBetAmount: 0,    
        biggestWinToday: 0,     
        gamesPlayedToday: 0,    
      };
      
      setOverviewStats(calculatedOverviewStats);
      setDailyBetsData([]); 
      setMultiplierDistributionData([]); 
      
    } catch (error) {
        console.error("Failed to fetch stats:", error);
        // setOverviewStats(null); // Or handle error state appropriately
    } finally {
        setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const intervalId = setInterval(fetchStats, 5000); 
    return () => clearInterval(intervalId);
  }, [fetchStats]);

  if (isLoading && !overviewStats) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg text-muted-foreground">Loading statistics...</p>
      </div>
    );
  }

  if (!overviewStats) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <p className="mt-4 text-lg text-muted-foreground">Statistics data could not be loaded.</p>
            <p className="text-sm text-muted-foreground">Chart data and game-specific metrics like average bet are illustrative.</p>
        </div>
    );
  }

  const houseProfitPercentage = (overviewStats.totalWagered ?? 0) > 0 
    ? (((overviewStats.totalProfitForHouse ?? 0) / (overviewStats.totalWagered ?? 1)) * 100) // Avoid division by zero if totalWagered is 0
    : 0;
  
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-primary">Financial & Game Statistics</h1>
      <p className="text-muted-foreground">Monitor key financial indicators based on transaction data. Game-specific metrics (charts, average bet) are illustrative.</p>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Approved Deposits (USDT)" value={(overviewStats.totalWagered ?? 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} icon={<DollarSign className="h-6 w-6 text-blue-500" />} description="Sum of approved deposits" />
        <StatCard title="Total Approved Withdrawals (USDT)" value={(overviewStats.totalPlayerWins ?? 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} icon={<TrendingUp className="h-6 w-6 text-accent" />} description="Sum of approved withdrawals" />
        <StatCard title="Net Platform Revenue (USDT)" value={(overviewStats.totalProfitForHouse ?? 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} icon={<TrendingDown className="h-6 w-6 text-destructive" />} description="Deposits - Withdrawals" />
        <StatCard title="Total Registered Users" value={(overviewStats.uniquePlayersToday ?? 0).toLocaleString()} icon={<Users className="h-6 w-6 text-purple-500" />} description="All users on platform" />
      </div>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
         <StatCard title="Average Bet (USDT)" value={(overviewStats.averageBetAmount ?? 0).toFixed(2)} icon={<Gamepad2 className="h-6 w-6 text-orange-500" />} description="Illustrative (needs game history)" />
         <StatCard title="Biggest Win Today (USDT)" value={(overviewStats.biggestWinToday ?? 0).toFixed(2)} icon={<TrendingUp className="h-6 w-6 text-yellow-400" />} description="Illustrative (needs game history)" />
         <StatCard title="Games Played Today" value={(overviewStats.gamesPlayedToday ?? 0).toLocaleString()} icon={<Activity className="h-6 w-6 text-indigo-500" />} description="Illustrative (needs game history)" />
         <StatCard title="Platform Margin" value={`${(houseProfitPercentage ?? 0).toFixed(2)}%`} icon={<Percent className="h-6 w-6 text-teal-500" />} description="Based on Deposits vs Net Revenue" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">Hourly Bets Today (Illustrative)</CardTitle>
            <CardDescription>Number of bets placed per 2-hour interval.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {dailyBetsData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyBetsData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Bar dataKey="bets" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
                </ResponsiveContainer>
            ) : <p className="text-muted-foreground text-center py-10">No hourly bet data available for chart. This section is illustrative.</p>}
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">Crash Multiplier Distribution (Illustrative)</CardTitle>
            <CardDescription>Distribution of where games typically end.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {multiplierDistributionData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                    data={multiplierDistributionData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    fontSize={12}
                    >
                    {multiplierDistributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: "12px" }}/>
                </PieChart>
                </ResponsiveContainer>
            ) : <p className="text-muted-foreground text-center py-10">No multiplier distribution data available for chart. This section is illustrative.</p>}
          </CardContent>
        </Card>
      </div>
      
       <Card className="border-orange-500/50 bg-orange-500/5 shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl text-orange-600 dark:text-orange-400 flex items-center gap-2"><AlertCircle /> System Health (Conceptual)</CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-4 text-sm">
            <div><span className="font-semibold">API Latency:</span> N/A (Backend Integration Needed)</div>
            <div><span className="font-semibold">Error Rate:</span> N/A (Backend Integration Needed)</div>
            <div><span className="font-semibold">Server Load:</span> N/A (Backend Integration Needed)</div>
            <div><span className="font-semibold">DB Connections:</span> N/A (Backend Integration Needed)</div>
            <div><span className="font-semibold">AI Service:</span> N/A (If Applicable)</div>
            <div><span className="font-semibold">TRC20 Node:</span> N/A (Backend Integration Needed)</div>
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
        <div className="text-2xl font-bold">{value}</div>
        {description && <p className="text-xs text-muted-foreground pt-1">{description}</p>}
      </CardContent>
    </Card>
  );
}

