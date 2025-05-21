
"use client";

import { useState, useEffect, useCallback } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { MultiplierDisplay } from "@/components/game/MultiplierDisplay";
import { FlyingObject } from "@/components/game/FlyingObject";
import { BettingControls } from "@/components/game/BettingControls";
import { TopPlayersLeaderboard } from "@/components/leaderboard/TopPlayersLeaderboard";
import { TopReferrersLeaderboard } from "@/components/leaderboard/TopReferrersLeaderboard";
import { GameStatusMessage } from "@/components/game/GameStatusMessage";
import { GameHistoryTable } from "@/components/game/GameHistoryTable";
import { ReferralSection } from "@/components/referral/ReferralSection";
import { SupportChatButton } from "@/components/chat/SupportChatButton";
import { SpinAndWin } from "@/components/spin-and-win/SpinAndWin";
import { useGameEngine } from "@/hooks/useGameEngine";
import { Button } from "@/components/ui/button";
import { RefreshCw, LogIn, UserPlus, Wrench, Settings, Gift, PartyPopper } from "lucide-react";
import Link from "next/link";
import { isAdminLoggedIn } from "@/lib/admin-auth";
import { getMaintenanceMode, getSiteSettings } from "@/lib/site-settings-storage";
import { isUserAuthenticated, getLoggedInUser, logoutUser, updateUserBalance as updateUserBalanceAuth } from "@/lib/user-auth";
import type { User } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";


const LAST_REFERRAL_REMINDER_KEY = 'skyhigh_last_referral_reminder_timestamp';
const REFERRAL_REMINDER_INTERVAL = 30 * 60 * 1000;
const BONUS_NOTIFICATION_CHECK_INTERVAL = 3000; // Check more frequently for bonus notifications
const LAST_DEMO_REMINDER_KEY = 'skyhigh_last_demo_reminder_timestamp';
const DEMO_REMINDER_INTERVAL = 5 * 60 * 1000; // 5 minutes


export default function SkyHighUsdtPage() {
  const {
    gameState,
    placeBet,
    cashOut,
    resetGame,
    depositUSDT,
    withdrawUSDT,
    setGameUserBalance,
    setDemoMode,
    startAutoBet,
    stopAutoBet,
  } = useGameEngine();
  const [isAuthenticatedState, setIsAuthenticatedState] = useState(false);
  const [loggedInUserState, setLoggedInUserState] = useState<User | null>(null);
  const [isActuallyAdmin, setIsActuallyAdmin] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [isMaintenanceActiveForUser, setIsMaintenanceActiveForUser] = useState(false);
  const { toast } = useToast();

  const refreshAuthStateAndBalance = useCallback(() => {
    if (typeof window !== 'undefined') {
      const authStatus = isUserAuthenticated();
      setIsAuthenticatedState(authStatus);
      const user = getLoggedInUser();
      setLoggedInUserState(user);
      setGameUserBalance(gameState.isDemoMode ? gameState.demoBalance : (user?.balance ?? 0));
    }
  }, [setGameUserBalance, gameState.isDemoMode, gameState.demoBalance]);

  useEffect(() => {
    setIsClient(true);
    refreshAuthStateAndBalance();

    const adminLoggedIn = isAdminLoggedIn();
    setIsActuallyAdmin(adminLoggedIn);

    const maintenanceMode = getMaintenanceMode();
    setIsMaintenanceActiveForUser(maintenanceMode && !adminLoggedIn);

    const handleStorageChange = (event: StorageEvent) => {
        if (event.key === "skyhigh_logged_in_user_email" || event.key === "skyhigh_users_db") {
            refreshAuthStateAndBalance();
        }
         if (event.key === "skyhigh_site_settings_v2" || event.key === "skyhigh_admin_loggedIn") {
            const admin = isAdminLoggedIn();
            setIsActuallyAdmin(admin);
            const maintenance = getMaintenanceMode();
            setIsMaintenanceActiveForUser(maintenance && !admin);
        }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorageChange);
      window.addEventListener('focus', refreshAuthStateAndBalance);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', handleStorageChange);
        window.removeEventListener('focus', refreshAuthStateAndBalance);
      }
    };
  }, [refreshAuthStateAndBalance]);

  useEffect(() => {
    if (isAuthenticatedState && isClient && !gameState.isDemoMode) {
      const siteSettings = getSiteSettings();
      const showReferralReminder = () => {
        toast({
          title: "Refer & Earn!",
          description: `Invite friends to Sky High USDT and get ${siteSettings.referralBonusPercent}% commission from their deposits! Your friend also gets ${siteSettings.newPlayerBonusUSDT.toFixed(2)} USDT bonus.`,
          variant: "default",
          icon: <Gift className="h-5 w-5 text-primary" />,
          duration: 10000,
        });
        localStorage.setItem(LAST_REFERRAL_REMINDER_KEY, Date.now().toString());
      };
      
      const lastReferralReminderTimestamp = parseInt(localStorage.getItem(LAST_REFERRAL_REMINDER_KEY) || '0', 10);
      const now = Date.now();
  
      if (now - lastReferralReminderTimestamp > REFERRAL_REMINDER_INTERVAL) {
        showReferralReminder();
      }

      const intervalId = setInterval(showReferralReminder, REFERRAL_REMINDER_INTERVAL);
      return () => clearInterval(intervalId);
    }
  }, [isAuthenticatedState, toast, isClient, gameState.isDemoMode]);


  useEffect(() => {
    if (gameState.isDemoMode && isClient) {
      const siteSettings = getSiteSettings();
      const showDemoReminder = () => {
        if (!isAuthenticatedState) {
          toast({
            title: "Try Real Play!",
            description: "Sign up or log in to play with real USDT, earn referral bonuses, and access all features!",
            variant: "default",
            icon: <UserPlus className="h-5 w-5 text-primary" />,
            duration: 10000,
            action: (
              <Button asChild size="sm">
                <Link href="/signup">Sign Up</Link>
              </Button>
            ),
          });
        } else {
          toast({
            title: "Refer & Earn (Demo Mode)!",
            description: `Invite friends and get ${siteSettings.referralBonusPercent}% commission from their deposits! Your friend gets a ${siteSettings.newPlayerBonusUSDT.toFixed(2)} USDT bonus. (Referral system active in real play)`,
            variant: "default",
            icon: <Gift className="h-5 w-5 text-primary" />,
            duration: 10000,
          });
        }
        localStorage.setItem(LAST_DEMO_REMINDER_KEY, Date.now().toString());
      };

      const lastDemoReminderTimestamp = parseInt(localStorage.getItem(LAST_DEMO_REMINDER_KEY) || '0', 10);
      const now = Date.now();

      if (now - lastDemoReminderTimestamp > DEMO_REMINDER_INTERVAL) {
        showDemoReminder();
      }

      const intervalId = setInterval(showDemoReminder, DEMO_REMINDER_INTERVAL);
      return () => clearInterval(intervalId);
    }
  }, [gameState.isDemoMode, isAuthenticatedState, isClient, toast]);


  useEffect(() => {
    if (isAuthenticatedState && loggedInUserState && isClient && !gameState.isDemoMode) {
      const checkAndShowNotifications = () => {
        const referralBonusKey = `skyhigh_show_referral_bonus_${loggedInUserState.email}`;
        const referralBonusDataString = localStorage.getItem(referralBonusKey);
        if (referralBonusDataString) {
          try {
            const bonusData = JSON.parse(referralBonusDataString);
            toast({
              title: "Referral Bonus Received!",
              description: `Congrats! You received ${bonusData.amount.toFixed(2)} USDT commission from a deposit by user ${bonusData.fromUser}.`,
              variant: "success",
              icon: <PartyPopper className="h-5 w-5 text-accent-foreground" />,
              duration: 15000,
            });
            localStorage.removeItem(referralBonusKey);
            refreshAuthStateAndBalance(); // Refresh balance after showing toast
          } catch (e) { console.error("Error parsing referral bonus notification data:", e); localStorage.removeItem(referralBonusKey); }
        }

        const newPlayerBonusKey = `skyhigh_show_new_player_bonus_${loggedInUserState.email}`;
        const newPlayerBonusDataString = localStorage.getItem(newPlayerBonusKey);
        if (newPlayerBonusDataString) {
            try {
                const bonusData = JSON.parse(newPlayerBonusDataString);
                 toast({
                    title: "New Player Bonus Unlocked!",
                    description: `Welcome aboard! You've received a ${bonusData.amount.toFixed(2)} USDT bonus for meeting the first deposit criteria!`,
                    variant: "success",
                    icon: <PartyPopper className="h-5 w-5 text-accent-foreground" />,
                    duration: 15000,
                });
                localStorage.removeItem(newPlayerBonusKey);
                refreshAuthStateAndBalance(); // Refresh balance after showing toast
            } catch (e) { console.error("Error parsing new player bonus notification data:", e); localStorage.removeItem(newPlayerBonusKey); }
        }
      };

      checkAndShowNotifications();
      const intervalId = setInterval(checkAndShowNotifications, BONUS_NOTIFICATION_CHECK_INTERVAL);
      return () => clearInterval(intervalId);
    }
  }, [isAuthenticatedState, loggedInUserState, toast, isClient, gameState.isDemoMode, refreshAuthStateAndBalance]);


  const handleLogout = () => {
    if(gameState.isAutoBetting || gameState.autoBetStarting) stopAutoBet('manual');
    logoutUser();
    setDemoMode(false);
    resetGame();
    refreshAuthStateAndBalance();
  };

  const handleSpinWinClaim = (amount: number) => {
    if (loggedInUserState && !gameState.isDemoMode) {
      const newBalance = loggedInUserState.balance + amount;
      updateUserBalanceAuth(loggedInUserState.email, newBalance);
      setGameUserBalance(newBalance);
      toast({
        title: "Winnings Claimed!",
        description: `${amount.toFixed(2)} USDT has been added to your wallet.`,
        variant: "success"
      });
      refreshAuthStateAndBalance(); // Refresh balance after claim
    }
  };


  const showResetButton = (gameState.gamePhase === 'crashed' || gameState.gamePhase === 'cashedOut') && !gameState.isAutoBetting && !gameState.autoBetStarting;

  if (!isClient) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
        Loading Sky High USDT...
      </div>
    );
  }

  if (isMaintenanceActiveForUser) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4 text-center">
          <AppHeader
            userBalance={gameState.userBalance}
            isAuthenticated={isAuthenticatedState}
            isAdmin={isActuallyAdmin}
            onLogout={handleLogout}
            onDeposit={depositUSDT}
            onWithdraw={withdrawUSDT}
        />
        <div className="bg-card p-8 rounded-xl shadow-2xl">
            <Wrench className="h-16 w-16 text-primary mx-auto mb-6" data-ai-hint="tool maintenance"/>
            <h1 className="text-3xl font-bold mb-4 text-primary">Under Maintenance</h1>
            <p className="text-lg text-card-foreground/80 mb-6">
            Sky High USDT is currently undergoing scheduled maintenance.
            </p>
            <p className="text-sm text-muted-foreground">
            We apologize for any inconvenience and will be back online shortly.
            </p>
        </div>
         <footer className="text-center py-8 text-sm text-muted-foreground w-full">
            <p>&copy; {new Date().getFullYear()} Sky High USDT. All rights reserved.</p>
         </footer>
      </main>
    );
  }

  return (
    <main className="flex flex-col items-center min-h-screen bg-background text-foreground p-2 sm:p-4 overflow-x-hidden">
      <AppHeader
        userBalance={gameState.userBalance}
        isAuthenticated={isAuthenticatedState}
        isAdmin={isActuallyAdmin}
        onLogout={handleLogout}
        onDeposit={depositUSDT}
        onWithdraw={withdrawUSDT}
      />

      <div className="flex items-center space-x-2 my-4 self-center bg-card p-3 rounded-lg shadow-md">
        <Switch
          id="demo-mode-switch"
          checked={gameState.isDemoMode}
          onCheckedChange={setDemoMode}
          aria-label="Toggle Demo Mode"
          disabled={gameState.isAutoBetting || gameState.autoBetStarting || gameState.gamePhase === 'playing' || gameState.gamePhase === 'betting'}
        />
        <Label htmlFor="demo-mode-switch" className="text-base font-medium cursor-pointer">
          Demo Mode {gameState.isDemoMode ? "" : <span className="text-primary ml-1">(Real Play)</span>}
        </Label>
      </div>


      {!isAuthenticatedState && !gameState.isDemoMode ? (
        <div className="flex flex-col items-center justify-center flex-grow">
          <div className="bg-card p-8 rounded-xl shadow-2xl text-center">
            <h2 className="text-3xl font-bold mb-6 text-primary">Welcome to Sky High USDT!</h2>
            <p className="mb-4 text-lg text-card-foreground/80">Log in or sign up to play with real USDT.</p>
            <p className="mb-8 text-sm text-muted-foreground">Or, try Demo Mode above!</p>
            <div className="flex gap-4 justify-center">
               <Button asChild size="lg" variant="secondary">
                  <Link href="/login">Login</Link>
              </Button>
              <Button asChild size="lg">
                  <Link href="/signup">Sign Up</Link>
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col lg:flex-row w-full max-w-7xl gap-4 lg:gap-8 mt-4 lg:mt-8">
            <div
              className="flex-grow lg:flex-grow-[2] flex flex-col items-center justify-end bg-gradient-to-br from-slate-900 via-purple-950 to-indigo-950 p-4 sm:p-6 md:p-8 rounded-xl shadow-2xl relative overflow-hidden border-2 border-primary/30"
              style={{ height: '500px', minWidth: '320px', maxWidth: '700px' }}
            >
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {Array.from({ length: 50 }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute bg-slate-400 rounded-full animate-pulse"
                    style={{
                      width: `${Math.random() * 2 + 1}px`,
                      height: `${Math.random() * 2 + 1}px`,
                      left: `${Math.random() * 100}%`,
                      top: `${Math.random() * 100}%`,
                      animationDelay: `${Math.random() * 5}s`,
                      animationDuration: `${Math.random() * 5 + 5}s`,
                    }}
                  />
                ))}
              </div>

              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
                 <MultiplierDisplay
                    multiplier={gameState.multiplier}
                    gamePhase={gameState.gamePhase}
                    countdownSeconds={gameState.countdownSeconds}
                  />
              </div>

              <GameStatusMessage
                gamePhase={gameState.gamePhase}
                lastMultiplier={gameState.lastMultiplier}
                currentProfit={gameState.currentProfit}
                countdownSeconds={gameState.countdownSeconds}
              />

              <div className="relative w-full h-full">
                {(gameState.gamePhase !== 'betting' || (gameState.gamePhase === 'betting' && gameState.countdownSeconds === 0)) &&
                  <FlyingObject
                    multiplier={gameState.multiplier}
                    gamePhase={gameState.gamePhase}
                    planePosition={gameState.planePosition}
                    obstacles={gameState.obstacles}
                  />
                }
              </div>


              { showResetButton && (
                <Button
                  onClick={resetGame}
                  variant="outline"
                  size="lg"
                  className="absolute bottom-4 right-4 z-20 animate-fadeIn"
                >
                  <RefreshCw className="mr-2 h-5 w-5" /> Play Again
                </Button>
              )}
            </div>

            <div className="lg:w-1/3 w-full flex flex-col gap-4 lg:gap-6">
              <BettingControls
                gamePhase={gameState.gamePhase}
                multiplier={gameState.multiplier}
                betAmount={gameState.betAmount}
                onPlaceBet={placeBet}
                onCashOut={cashOut}
                userBalance={gameState.userBalance}
                isCountdownActive={gameState.gamePhase === 'betting' && gameState.countdownSeconds !== null && gameState.countdownSeconds > 0}
                isAutoBetting={gameState.isAutoBetting}
                autoBetStarting={gameState.autoBetStarting}
                startAutoBet={startAutoBet}
                stopAutoBet={stopAutoBet}
                autoBetRoundsRemaining={gameState.autoBetRoundsRemaining}
                autoBetSessionProfit={gameState.autoBetSessionProfit}
                activeAutoBetSettings={gameState.autoBetSettings}
                isDemoMode={gameState.isDemoMode}
              />
              <TopPlayersLeaderboard />
            </div>
          </div>

          <div className="w-full max-w-7xl mt-6">
            {isAuthenticatedState && loggedInUserState && !gameState.isDemoMode && (
              <SpinAndWin
                user={loggedInUserState}
                onWinClaim={handleSpinWinClaim}
              />
            )}
          </div>

          <div className="w-full max-w-7xl mt-4 lg:mt-8 grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8">
            <GameHistoryTable history={gameState.gameHistory} />
            <TopReferrersLeaderboard />
          </div>
          <div className="w-full max-w-7xl mt-6">
            {isAuthenticatedState && loggedInUserState && !gameState.isDemoMode && (
                <>
                    <ReferralSection referralCode={loggedInUserState.referralCode} />
                    <SupportChatButton user={loggedInUserState} />
                </>
            )}
          </div>
        </>
      )}

      <footer className="text-center py-8 text-sm text-muted-foreground w-full">
        <p>&copy; {new Date().getFullYear()} Sky High USDT. All rights reserved. {gameState.isDemoMode ? "Demo Mode Active." : "For demo purposes only."}</p>
        <p>Please gamble responsibly.</p>
         {isClient && !isActuallyAdmin && (
            <p className="mt-2">
                <Link href="/login?attemptAdmin=true" className="hover:text-primary hover:underline">
                Administrator Login
                </Link>
            </p>
        )}
      </footer>
    </main>
  );
}

    