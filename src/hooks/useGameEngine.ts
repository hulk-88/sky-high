
// src/hooks/useGameEngine.ts
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  GamePhase,
  GameState,
  GameHistoryEntry,
  User,
  Obstacle,
  AutoBetSettings,
  TransactionType,
} from '@/types';
import { useToast } from '@/hooks/use-toast';
import { getSiteSettings } from '@/lib/site-settings-storage';
import { getLoggedInUser, updateUserBalance, recordUserWithdrawal, calculateUserDailyWithdrawalLimit } from '@/lib/user-auth';
import { addTransaction } from '@/lib/transaction-storage';
import { SOUND_FILES } from '@/types';

const INITIAL_PLANE_POSITION = { x: 50, y: 200, width: 160, height: 112 }; // Rotated width becomes height
const GAME_AREA_WIDTH = 700; // Max width of the game area
const GAME_AREA_HEIGHT = 500; // Max height of the game area

const MAX_MULTIPLIER = 10000; // Arbitrary high multiplier cap
const COUNTDOWN_DURATION = 3; // seconds
const AUTO_BET_INITIAL_DELAY = 5000; // ms, time before the first auto-bet of a session
const AUTO_BET_INTER_ROUND_DELAY = 1500; // ms, time between auto-bet rounds
const DEMO_MODE_INITIAL_BALANCE = 1000;
const DEMO_MODE_DIFFICULTY_PERCENT = 50; // Lower difficulty for demo

// Sound utility
const playSound = (sound: keyof typeof SOUND_FILES) => {
  if (typeof window !== 'undefined' && SOUND_FILES[sound]) {
    const audio = new Audio(SOUND_FILES[sound]);
    audio.play().catch(error => console.warn(`Sound play failed for ${sound}:`, error));
  }
};

const stopSound = (sound: keyof typeof SOUND_FILES) => {
  // Placeholder for potential future use if specific sound instances need to be managed
};

// History key generator
const getUserHistoryKey = (userId: string | undefined | null): string => {
  if (!userId) return 'skyhigh_game_history_guest';
  return `skyhigh_game_history_user_${userId}`;
};

const LOGGED_IN_USER_KEY = "skyhigh_logged_in_user_email";

export function useGameEngine() {
  const { toast } = useToast();

  const initialGameState: GameState = {
    gamePhase: 'idle',
    multiplier: 0.00,
    betAmount: null,
    startTime: null,
    currentProfit: null,
    userBalance: 0,
    lastMultiplier: null,
    loggedInUser: null,
    gameHistory: [],
    planePosition: INITIAL_PLANE_POSITION,
    obstacles: [],
    countdownSeconds: null,

    isAutoBetting: false,
    autoBetStarting: false,
    autoBetSettings: null,
    autoBetRoundsRemaining: 0,
    autoBetSessionProfit: 0,

    isDemoMode: false,
    demoBalance: DEMO_MODE_INITIAL_BALANCE,

    currentBetWasAuto: false,
    currentBetAutoCashOutTarget: null,
  };

  const [gameState, setGameState] = useState<GameState>(initialGameState);

  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);
  const obstaclesRef = useRef<Obstacle[]>([]);
  const siteSettingsRef = useRef(getSiteSettings());
  const autoBetActionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(false);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const stopAutoBet = useCallback((reason?: 'rounds_completed' | 'profit_target' | 'loss_limit' | 'manual' | 'error') => {
    console.log(`stopAutoBet called. Reason: ${reason || 'unknown'}. Current timer ref:`, autoBetActionTimerRef.current);
    if (autoBetActionTimerRef.current) {
      clearTimeout(autoBetActionTimerRef.current);
      autoBetActionTimerRef.current = null;
    }
    const wasAutoBettingOrStarting = gameState.isAutoBetting || gameState.autoBetStarting;

    setGameState(prev => {
        const shouldKeepSummary = prev.isAutoBetting && prev.autoBetSettings && reason !== 'manual' && reason !== 'error';
        return {
            ...prev,
            isAutoBetting: false,
            autoBetStarting: false,
            autoBetSettings: shouldKeepSummary ? prev.autoBetSettings : null,
            autoBetRoundsRemaining: shouldKeepSummary ? prev.autoBetRoundsRemaining : 0,
            autoBetSessionProfit: shouldKeepSummary ? prev.autoBetSessionProfit : 0,
        };
    });

    if ((reason === 'manual' || reason === 'error') && wasAutoBettingOrStarting && isMountedRef.current) {
         setTimeout(() => {
            toast({title: "Auto-Bet Stopped", description: "The auto-bet sequence has been disabled."});
        },0);
    }
  }, [toast, gameState.isAutoBetting, gameState.autoBetStarting, gameState.autoBetSettings]);


  useEffect(() => {
    isMountedRef.current = true;
    siteSettingsRef.current = getSiteSettings();

    const handleSettingsChange = () => {
        siteSettingsRef.current = getSiteSettings();
    };

    const handleStorageAndFocus = () => {
      if (isMountedRef.current) {
        const user = getLoggedInUser();
        setGameState(prev => ({
          ...prev,
          loggedInUser: user,
          userBalance: prev.isDemoMode ? prev.demoBalance : (user?.balance ?? 0),
        }));
      }
    };

    if (typeof window !== 'undefined') {
        window.addEventListener('storage', (event) => {
            if (event.key === "skyhigh_site_settings_v2") handleSettingsChange();
            if (event.key === "skyhigh_users_db" || event.key === LOGGED_IN_USER_KEY) handleStorageAndFocus();
        });
        window.addEventListener('focus', handleStorageAndFocus);
    }

    const user = getLoggedInUser();
    const initialRealBalance = user ? user.balance : 0;
    const initialDemoBalance = DEMO_MODE_INITIAL_BALANCE;

    setGameState(prev => ({
      ...prev,
      loggedInUser: user,
      demoBalance: initialDemoBalance,
      userBalance: prev.isDemoMode ? initialDemoBalance : initialRealBalance,
    }));

    return () => {
        isMountedRef.current = false;
        if (typeof window !== 'undefined') {
            window.removeEventListener('storage', handleSettingsChange);
            window.removeEventListener('storage', handleStorageAndFocus);
            window.removeEventListener('focus', handleStorageAndFocus);
        }
        if (gameLoopRef.current) clearInterval(gameLoopRef.current);
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        if (autoBetActionTimerRef.current) clearTimeout(autoBetActionTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const user = getLoggedInUser();
    setGameState(prev => ({
      ...prev,
      loggedInUser: user,
      userBalance: prev.isDemoMode ? prev.demoBalance : (user?.balance ?? 0),
      demoBalance: (prev.isDemoMode && prev.demoBalance === 0 && !prev.loggedInUser) ? DEMO_MODE_INITIAL_BALANCE : prev.demoBalance,
    }));
  }, [gameState.isDemoMode, gameState.loggedInUser?.email]);

  const saveHistoryToLocalStorage = useCallback((history: GameHistoryEntry[], userId: string | undefined | null, isDemo: boolean) => {
    if (isDemo || typeof window === 'undefined' || !userId) return;
    const userHistoryKey = getUserHistoryKey(userId);
    const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
    const recentHistory = history.filter(entry => entry.timestamp >= twentyFourHoursAgo);
    localStorage.setItem(userHistoryKey, JSON.stringify(recentHistory.slice(0, 50)));
  }, []);

  useEffect(() => {
    if (gameState.isDemoMode) {
      setGameState(prev => ({ ...prev, gameHistory: [] }));
      return;
    }
    let userSpecificHistory: GameHistoryEntry[] = [];
    if (typeof window !== 'undefined' && gameState.loggedInUser?.id) {
        const userHistoryKey = getUserHistoryKey(gameState.loggedInUser.id);
        const storedHistory = localStorage.getItem(userHistoryKey);
        if (storedHistory) {
            try {
                const parsedHistory: GameHistoryEntry[] = JSON.parse(storedHistory);
                const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
                userSpecificHistory = parsedHistory.filter((entry: GameHistoryEntry) => entry.timestamp >= twentyFourHoursAgo);
            } catch (e) { console.error("Failed to parse game history for user", gameState.loggedInUser.email, e); }
        }
    }
    setGameState(prev => ({ ...prev, gameHistory: userSpecificHistory.slice(0, 50) }));
  }, [gameState.loggedInUser?.id, gameState.isDemoMode]);

  const setGameUserBalance = useCallback((newBalance: number) => {
    setGameState(prev => ({
      ...prev,
      demoBalance: prev.isDemoMode ? newBalance : prev.demoBalance,
      userBalance: newBalance, // Always update userBalance for display consistency
    }));
  }, []);

  const resetGameInternals = useCallback(() => {
    if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    stopSound('PLANE_FLYING');
    obstaclesRef.current = [];
    return {
        gamePhase: 'idle' as GamePhase,
        multiplier: 0.00,
        startTime: null,
        currentProfit: null,
        lastMultiplier: null,
        planePosition: INITIAL_PLANE_POSITION,
        obstacles: [],
        countdownSeconds: null,
    };
  }, []);

  const handleCrash = useCallback((finalMultiplier: number, currentBetAmount: number) => {
    if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    playSound('EXPLOSION');
    stopSound('PLANE_FLYING');

    const lossAmount = currentBetAmount;
    const profit = -lossAmount;

    const historyEntry: GameHistoryEntry = {
      id: crypto.randomUUID(),
      betAmount: currentBetAmount,
      outcome: 'crashed',
      outcomeMultiplier: finalMultiplier,
      profit: profit,
      timestamp: Date.now(),
    };

    if (!gameState.isDemoMode && gameState.loggedInUser) {
        addTransaction({
            userId: gameState.loggedInUser.id,
            userEmail: gameState.loggedInUser.email,
            type: 'bet_lost',
            amount: currentBetAmount, // Log the amount bet/lost
            outcomeMultiplier: finalMultiplier,
        });
    }
    const toastMessage = `Crashed at ${finalMultiplier.toFixed(2)}x. You lost ${lossAmount.toFixed(2)} USDT.`;

    setGameState(prev => {
        const newHistory = prev.isDemoMode ? prev.gameHistory : [historyEntry, ...prev.gameHistory];
        if (!prev.isDemoMode && prev.loggedInUser?.id) saveHistoryToLocalStorage(newHistory, prev.loggedInUser.id, false);

        const updatedAutoBetRoundsRemaining = prev.currentBetWasAuto ? Math.max(0, (prev.autoBetRoundsRemaining || 1) - 1) : prev.autoBetRoundsRemaining;
        const updatedAutoBetSessionProfit = prev.currentBetWasAuto ? prev.autoBetSessionProfit + profit : prev.autoBetSessionProfit;
        
        // Balance was debited at placeBet. No further deduction needed here.
        // For demo mode, prev.userBalance already reflects the debited demoBalance.
        return {
            ...prev,
            gamePhase: 'crashed',
            lastMultiplier: finalMultiplier,
            multiplier: finalMultiplier,
            currentProfit: profit,
            gameHistory: newHistory.slice(0,50),
            autoBetRoundsRemaining: updatedAutoBetRoundsRemaining,
            autoBetSessionProfit: updatedAutoBetSessionProfit,
            currentBetWasAuto: false,
            currentBetAutoCashOutTarget: null,
        };
    });
    if (isMountedRef.current) {
        setTimeout(() => {
            toast({ title: "Crashed!", description: toastMessage, variant: "destructive" });
        }, 0);
    }
  }, [toast, saveHistoryToLocalStorage, gameState.isDemoMode, gameState.loggedInUser, gameState.autoBetRoundsRemaining, gameState.autoBetSessionProfit, gameState.currentBetWasAuto]);

  const startGame = useCallback((betAmountForThisRound: number, autoCashOutTargetForThisRound?: number) => {
    console.log("startGame called. Bet Amount:", betAmountForThisRound, "Is demo:", gameState.isDemoMode, "AutoCashOut Target:", autoCashOutTargetForThisRound);
    if (betAmountForThisRound === null || betAmountForThisRound <= 0) {
      console.error("startGame: Invalid bet amount or null, cannot start game. Bet Amount:", betAmountForThisRound);
      setGameState(prev => ({ ...prev, gamePhase: 'idle' }));
      if(gameState.isAutoBetting || gameState.autoBetStarting) {
        console.log("Stopping auto-bet due to invalid bet amount in startGame.");
        stopAutoBet('error');
      }
      return;
    }

    playSound('PLANE_FLYING');
    obstaclesRef.current = [];

    setGameState(prev => ({
        ...prev,
        gamePhase: 'playing',
        multiplier: 0.00,
        startTime: Date.now(),
        betAmount: betAmountForThisRound,
        currentProfit: -(betAmountForThisRound),
        planePosition: INITIAL_PLANE_POSITION,
        obstacles: [],
        countdownSeconds: null,
        currentBetAutoCashOutTarget: autoCashOutTargetForThisRound ?? prev.currentBetAutoCashOutTarget,
      }));

    gameLoopRef.current = setInterval(() => {
      setGameState(currentGs => {
        if (currentGs.gamePhase !== 'playing' || !currentGs.startTime || currentGs.betAmount === null) {
          if (gameLoopRef.current) clearInterval(gameLoopRef.current);
          return currentGs;
        }

        const elapsedSeconds = (Date.now() - currentGs.startTime) / 1000;
        let newMultiplier;
        if (elapsedSeconds < 1) {
            newMultiplier = parseFloat((elapsedSeconds * 1.00).toFixed(2));
        } else {
            newMultiplier = parseFloat((1.00 + (elapsedSeconds - 1) * 0.1 + Math.pow(elapsedSeconds - 1, 2) * 0.02).toFixed(2));
        }
        newMultiplier = Math.max(0.00, Math.min(newMultiplier, MAX_MULTIPLIER));

        const planeSpeedX = 30;
        const planeCurrentX = INITIAL_PLANE_POSITION.x + elapsedSeconds * planeSpeedX;
        let currentPlanePosition = { ...currentGs.planePosition, x: Math.min(planeCurrentX, GAME_AREA_WIDTH - currentGs.planePosition.width) };

        let newObstacles = [...obstaclesRef.current];
        const missileSpawnProbability = 0.03 + Math.min(0.15, newMultiplier * 0.005);
        if (Math.random() < missileSpawnProbability && elapsedSeconds > 0.5) {
          const newMissile: Obstacle = {
            id: `obs-${Date.now()}-${Math.random()}`,
            x: GAME_AREA_WIDTH + Math.random() * 100,
            y: currentGs.planePosition.y + (currentGs.planePosition.height / 2) - 5 + (Math.random() * 30 - 15),
            type: 'missile',
            width: 48, height: 24,
            speedX: -(Math.random() * 150 + 200 + newMultiplier * 5),
            spawnTime: Date.now(),
            lifetimeLeft: 3000,
          };
          newObstacles.push(newMissile);
          playSound('MISSILE_SPAWN');
        }

        const timeDelta = (1000/30)/1000;
        newObstacles = newObstacles.map(obs => ({
          ...obs,
          x: obs.x + (obs.speedX || 0) * timeDelta,
          lifetimeLeft: obs.lifetimeLeft - (1000/30),
        })).filter(obs => obs.x + obs.width > 0 && obs.lifetimeLeft > 0);
        obstaclesRef.current = newObstacles;

        let collisionDetected = false;
        for (const obs of newObstacles) {
          if (
            currentPlanePosition.x < obs.x + obs.width &&
            currentPlanePosition.x + currentPlanePosition.width > obs.x &&
            currentPlanePosition.y < obs.y + obs.height &&
            currentPlanePosition.y + currentPlanePosition.height > obs.y
          ) {
            collisionDetected = true;
            break;
          }
        }

        // --- Game Difficulty Logic ---
        // Determine effective difficulty percentage for the current round.
        // 1. Demo mode uses a fixed difficulty.
        // 2. Real mode:
        //    - Bets < 50 USDT use the difficulty set by the admin.
        //    - Bets >= 50 USDT automatically use a higher difficulty (85%).
        let effectiveGameDifficultyPercent = currentGs.isDemoMode
            ? DEMO_MODE_DIFFICULTY_PERCENT
            : siteSettingsRef.current.gameDifficultyPercent;

        if (!currentGs.isDemoMode && currentGs.betAmount && currentGs.betAmount >= 50) {
            effectiveGameDifficultyPercent = 85; // Override for higher bets in real mode.
        }
        // --- End Game Difficulty Logic ---


        // --- Crash Probability Calculation ---
        // Base immediate crash probability (very low, constant but influenced by difficulty)
        const baseImmediateCrashProb = 0.0001 + (0.0005 * (effectiveGameDifficultyPercent / 100));
        // Multiplier-driven crash probability (increases as multiplier grows, scaled by difficulty)
        const multiplierDrivenCrashProb = (Math.pow(Math.max(0.01, newMultiplier), 1.5) / 5000) * (effectiveGameDifficultyPercent / 70); // Normalizing factor 70 to scale effect
        const totalCrashProbabilityThisTick = baseImmediateCrashProb + multiplierDrivenCrashProb;

        if (currentGs.gamePhase === 'playing' && Math.random() < totalCrashProbabilityThisTick && newMultiplier >= 0.01) { // Ensure multiplier is at least 0.01
            collisionDetected = true;
        }

        // Specific quick crash logic for high bets (>= 50 USDT, non-demo)
        // This logic applies IN ADDITION to the general crash probability when betAmount >= 50.
        // Here, effectiveGameDifficultyPercent is already 85.
        if (!currentGs.isDemoMode && currentGs.betAmount && currentGs.betAmount >= 50) {
            const quickCrashTimeLowerBound = 0.5; // seconds
            const quickCrashTimeUpperBound = 4.0; // seconds (crash becomes more likely over this window)

             if (elapsedSeconds > quickCrashTimeLowerBound) {
                const timeIntoWindow = elapsedSeconds - quickCrashTimeLowerBound;
                const windowDuration = quickCrashTimeUpperBound - quickCrashTimeLowerBound;
                // The probability increases linearly over the window for high bets.
                // Scaled by difficulty (normalized around 50% for the scaling factor).
                const highBetCrashProbabilityPerTick = (0.10 / 30) * (timeIntoWindow / windowDuration) * (effectiveGameDifficultyPercent / 50);
                if (timeIntoWindow < windowDuration && Math.random() < highBetCrashProbabilityPerTick) {
                    collisionDetected = true;
                }
            }
        }
        // --- End Crash Probability Calculation ---


        if (collisionDetected) {
          handleCrash(newMultiplier, currentGs.betAmount);
          return { // Return a new state object for the crash
              ...currentGs,
              gamePhase: 'crashed',
              multiplier: newMultiplier,
              lastMultiplier: newMultiplier,
              obstacles: newObstacles, // Use current obstacles at crash time
              planePosition: currentPlanePosition, // Use current plane position at crash time
              currentProfit: -currentGs.betAmount, // Profit is negative bet amount on crash
              currentBetWasAuto: false, // Reset auto-bet specific flags
              currentBetAutoCashOutTarget: null,
          };
        }

        const currentProfitValue = (currentGs.betAmount || 0) * newMultiplier - (currentGs.betAmount || 0);

        if (currentGs.currentBetAutoCashOutTarget && newMultiplier >= currentGs.currentBetAutoCashOutTarget) {
            if (gameLoopRef.current) clearInterval(gameLoopRef.current);
            stopSound('PLANE_FLYING');
            playSound('WIN');

            const targetMultiplier = currentGs.currentBetAutoCashOutTarget;
            // Net profit: (total return) - (original bet)
            const profit = (currentGs.betAmount || 0) * targetMultiplier - (currentGs.betAmount || 0);

            let newBalanceAfterWin = currentGs.userBalance;
            let newDemoBalanceAfterWin = currentGs.demoBalance;

            // Balance was debited at placeBet. Now add back the original bet + profit.
            const totalReturn = (currentGs.betAmount || 0) * targetMultiplier;

            if (currentGs.isDemoMode) {
                newDemoBalanceAfterWin = currentGs.demoBalance + totalReturn;
                newBalanceAfterWin = newDemoBalanceAfterWin; // Update main userBalance for display
            } else {
                newBalanceAfterWin = currentGs.userBalance + totalReturn;
                 if(currentGs.loggedInUser) {
                    updateUserBalance(currentGs.loggedInUser.email, newBalanceAfterWin);
                    addTransaction({
                        userId: currentGs.loggedInUser.id,
                        userEmail: currentGs.loggedInUser.email,
                        type: 'win',
                        amount: profit, // Log the net profit
                        outcomeMultiplier: targetMultiplier,
                    });
                 }
            }

            const historyEntry: GameHistoryEntry = {
              id: crypto.randomUUID(),
              betAmount: currentGs.betAmount || 0,
              outcome: 'cashedOut',
              outcomeMultiplier: targetMultiplier,
              profit: profit,
              timestamp: Date.now(),
            };

            const toastMessage = `Auto Cashed Out at ${targetMultiplier.toFixed(2)}x. You ${profit >= 0 ? 'won' : 'lost'} ${profit >= 0 ? '+' : ''}${profit.toFixed(2)} USDT.`;
            const toastVariant = profit >= 0 ? 'success' : 'destructive';

            const updatedAutoBetRoundsRemaining = currentGs.currentBetWasAuto ? Math.max(0, (currentGs.autoBetRoundsRemaining || 1) - 1) : currentGs.autoBetRoundsRemaining;
            const updatedAutoBetSessionProfit = currentGs.currentBetWasAuto ? currentGs.autoBetSessionProfit + profit : currentGs.autoBetSessionProfit;

            const stateAfterAutoCashout = {
                ...currentGs,
                gamePhase: 'cashedOut' as GamePhase,
                lastMultiplier: targetMultiplier,
                multiplier: targetMultiplier,
                currentProfit: profit,
                userBalance: newBalanceAfterWin,
                demoBalance: newDemoBalanceAfterWin,
                obstacles: newObstacles,
                planePosition: currentPlanePosition,
                autoBetRoundsRemaining: updatedAutoBetRoundsRemaining,
                autoBetSessionProfit: updatedAutoBetSessionProfit,
                currentBetWasAuto: false,
                currentBetAutoCashOutTarget: null,
            };

            setGameState(prev => {
                const newHistory = prev.isDemoMode ? prev.gameHistory : [historyEntry, ...prev.gameHistory];
                if (!prev.isDemoMode && prev.loggedInUser?.id) saveHistoryToLocalStorage(newHistory, prev.loggedInUser.id, false);
                return { ...stateAfterAutoCashout, gameHistory: newHistory.slice(0,50) };
            });

            if (isMountedRef.current) {
                setTimeout(() => {
                    toast({
                        title: "Auto Cashed Out!",
                        description: toastMessage,
                        variant: toastVariant
                    });
                }, 0);
            }
            return stateAfterAutoCashout; // Return new state
        }
        return { ...currentGs, multiplier: newMultiplier, currentProfit: currentProfitValue, planePosition: currentPlanePosition, obstacles: newObstacles };
      });
    }, 1000 / 30); // Game loop runs at ~30 FPS
  }, [gameState.isDemoMode, gameState.isAutoBetting, gameState.autoBetStarting, handleCrash, siteSettingsRef, saveHistoryToLocalStorage, toast, stopAutoBet, gameState.loggedInUser]);

  const resetGameForNextRound = useCallback(() => {
    const resetState = resetGameInternals();
    setGameState(prev => ({
      ...prev,
      ...resetState,
      betAmount: null, // Clear betAmount for the next round
      currentBetWasAuto: false,
      currentBetAutoCashOutTarget: null,
    }));
  }, [resetGameInternals]);

  const startCountdown = useCallback((betAmountFromPlaceBet: number, autoCashOutAtFromPlaceBet?: number) => {
    setGameState(prev => ({ ...prev, gamePhase: 'betting', countdownSeconds: COUNTDOWN_DURATION, multiplier: 0.00 }));
    let count = COUNTDOWN_DURATION;
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    countdownIntervalRef.current = setInterval(() => {
      count--;
      setGameState(prev => ({ ...prev, countdownSeconds: count }));
      if (count === 0) {
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        startGame(betAmountFromPlaceBet, autoCashOutAtFromPlaceBet); // Pass validated bet amount
      }
    }, 1000);
  }, [startGame]);

  const placeBet = useCallback((amount: number, options?: { isAutoRound?: boolean; autoCashOutAt?: number }) => {
    const { gamePhase, isDemoMode, demoBalance, userBalance, loggedInUser, isAutoBetting, autoBetStarting } = gameState;
    console.log("placeBet called with amount:", amount, "options:", options, "current gamePhase:", gamePhase);

    const canPlaceBetInCurrentPhase = gamePhase === 'idle' || gamePhase === 'crashed' || gamePhase === 'cashedOut';
    const isStartingAutoBetRound = (isAutoBetting || autoBetStarting) && (options?.isAutoRound ?? false);

    if (!canPlaceBetInCurrentPhase && !isStartingAutoBetRound) {
        if(isAutoBetting || autoBetStarting) {
             console.warn("placeBet (auto): Bet rejected, game not in correct phase. Current phase:", gamePhase, ". Auto-bet might retry or stop.");
        } else {
            console.warn("placeBet (manual): Bet rejected, game not in correct phase. Current phase:", gamePhase);
             if (isMountedRef.current) {
                setTimeout(() => {
                    toast({ title: "Game Not Ready", description: "Please wait for the current round to end or reset.", variant: "default" });
                }, 0);
            }
        }
        return;
    }

    const balanceToCheck = isDemoMode ? demoBalance : userBalance;
    if (amount <= 0 || amount > balanceToCheck) {
      if (isMountedRef.current) {
        setTimeout(() => {
            toast({ title: "Invalid Bet",
                    description: amount > balanceToCheck ? `Insufficient balance. You have ${balanceToCheck.toFixed(2)} USDT.` : "Bet amount must be positive.",
                    variant: "destructive" });
        }, 0);
      }
      if (isStartingAutoBetRound) {
        console.log("placeBet (auto): Insufficient balance, stopping auto-bet.");
        stopAutoBet('error');
      }
      return;
    }

    playSound('BET_PLACED');

    let newBalanceAfterBet = userBalance;
    let newDemoBalanceAfterBet = demoBalance;

    if (isDemoMode) {
        newDemoBalanceAfterBet -= amount;
        newBalanceAfterBet = newDemoBalanceAfterBet;
    } else {
        newBalanceAfterBet -= amount;
        if(loggedInUser) {
          updateUserBalance(loggedInUser.email, newBalanceAfterBet);
          addTransaction({
            userId: loggedInUser.id,
            userEmail: loggedInUser.email,
            type: 'bet',
            amount: amount, // Log the amount bet
          });
        }
    }

    setGameState(prev => ({
      ...prev,
      betAmount: amount, // Set the betAmount for the current game
      userBalance: newBalanceAfterBet,
      demoBalance: newDemoBalanceAfterBet,
      gamePhase: 'betting',
      countdownSeconds: COUNTDOWN_DURATION,
      multiplier: 0.00,
      lastMultiplier: prev.multiplier, // Keep previous multiplier for display if needed
      currentProfit: -amount, // Initial profit is negative bet amount
      currentBetWasAuto: options?.isAutoRound ?? false,
      currentBetAutoCashOutTarget: options?.autoCashOutAt ?? null,
    }));

    if (isMountedRef.current) {
      setTimeout(() => {
        toast({ title: "Bet Placed", description: `Your bet of ${amount.toFixed(2)} USDT is placed. Game starting in ${COUNTDOWN_DURATION}s.`, variant: "default" });
      }, 0);
    }

    startCountdown(amount, options?.autoCashOutAt); // Pass validated amount
  }, [gameState, startCountdown, toast, stopAutoBet]);

  const cashOut = useCallback(() => {
    const { gamePhase, betAmount, multiplier, isDemoMode, demoBalance, userBalance, loggedInUser, currentBetWasAuto, autoBetRoundsRemaining, autoBetSessionProfit } = gameState;
    if (gamePhase !== 'playing' || !betAmount || multiplier <= 0) return;

    if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    stopSound('PLANE_FLYING');
    playSound('WIN');

    // Net profit: (total return) - (original bet)
    const profit = (betAmount * multiplier) - betAmount;

    let newBalanceAfterWin = userBalance;
    let newDemoBalanceAfterWin = demoBalance;

    // Balance was debited at placeBet. Now add back the original bet + profit.
    const totalReturn = betAmount * multiplier;

    if (isDemoMode) {
        newDemoBalanceAfterWin = demoBalance + totalReturn;
        newBalanceAfterWin = newDemoBalanceAfterWin;
    } else {
        newBalanceAfterWin = userBalance + totalReturn;
        if(loggedInUser) {
          updateUserBalance(loggedInUser.email, newBalanceAfterWin);
          addTransaction({
            userId: loggedInUser.id,
            userEmail: loggedInUser.email,
            type: 'win',
            amount: profit, // Log the net profit
            outcomeMultiplier: multiplier,
          });
        }
    }

    const historyEntry: GameHistoryEntry = {
      id: crypto.randomUUID(),
      betAmount: betAmount,
      outcome: 'cashedOut',
      outcomeMultiplier: multiplier,
      profit: profit,
      timestamp: Date.now(),
    };

    const toastMessage = `Cashed Out at ${multiplier.toFixed(2)}x. You ${profit >= 0 ? 'won' : 'lost'} ${profit >= 0 ? '+' : ''}${profit.toFixed(2)} USDT.`;
    const toastVariant = profit >= 0 ? 'success' : 'destructive';


    const updatedAutoBetRoundsRemaining = currentBetWasAuto ? Math.max(0, (autoBetRoundsRemaining || 1) - 1) : autoBetRoundsRemaining;
    const updatedAutoBetSessionProfit = currentBetWasAuto ? autoBetSessionProfit + profit : autoBetSessionProfit;

    setGameState(prev => {
        const newHistory = prev.isDemoMode ? prev.gameHistory : [historyEntry, ...prev.gameHistory];
        if (!prev.isDemoMode && prev.loggedInUser?.id) saveHistoryToLocalStorage(newHistory, prev.loggedInUser.id, false);
        return {
            ...prev,
            gamePhase: 'cashedOut',
            lastMultiplier: prev.multiplier,
            currentProfit: profit,
            userBalance: newBalanceAfterWin,
            demoBalance: newDemoBalanceAfterWin,
            gameHistory: newHistory.slice(0,50),
            autoBetRoundsRemaining: updatedAutoBetRoundsRemaining,
            autoBetSessionProfit: updatedAutoBetSessionProfit,
            currentBetWasAuto: false,
            currentBetAutoCashOutTarget: null,
        };
    });
    if (isMountedRef.current) {
        setTimeout(() => {
            toast({
                title: "Cashed Out!",
                description: toastMessage,
                variant: toastVariant
            });
        },0);
    }
  }, [gameState, toast, saveHistoryToLocalStorage]);

  const setDemoMode = useCallback((enableDemo: boolean) => {
    setGameState(prev => {
        if (prev.isDemoMode === enableDemo) return prev;

        const balanceToDisplay = enableDemo
            ? (prev.demoBalance > 0 ? prev.demoBalance : DEMO_MODE_INITIAL_BALANCE)
            : (prev.loggedInUser?.balance ?? 0);

        const actualDemoBalance = enableDemo
            ? (prev.demoBalance > 0 ? prev.demoBalance : DEMO_MODE_INITIAL_BALANCE)
            : DEMO_MODE_INITIAL_BALANCE; // Keep demoBalance store even if not active

        const gameResetState = resetGameInternals();
        let autoBetResetState = {};

        if (prev.isAutoBetting || prev.autoBetStarting) {
            if (autoBetActionTimerRef.current) clearTimeout(autoBetActionTimerRef.current);
            autoBetActionTimerRef.current = null;
            autoBetResetState = {
                isAutoBetting: false,
                autoBetStarting: false,
                autoBetSettings: null,
                autoBetRoundsRemaining: 0,
                autoBetSessionProfit: 0,
            };
             if(isMountedRef.current){
              setTimeout(() => {
                toast({ title: "Auto-Bet Stopped", description: "Game mode changed."});
              },0);
            }
        }

        if(isMountedRef.current){
          setTimeout(() => {
            toast({ title: "Mode Switched", description: `Demo mode is now ${enableDemo ? "ON" : "OFF"}.` });
          },0);
        }

        return {
            ...prev,
            ...gameResetState,
            ...autoBetResetState,
            isDemoMode: enableDemo,
            userBalance: balanceToDisplay,
            demoBalance: actualDemoBalance,
            gameHistory: enableDemo ? [] : prev.gameHistory, // Clear history for demo, or keep real for real
            betAmount: null, // Reset current bet amount
            currentBetWasAuto: false,
            currentBetAutoCashOutTarget: null,
        };
    });
  }, [resetGameInternals, toast]);

  const startAutoBet = useCallback((settings: AutoBetSettings) => {
    // This function now primarily sets the intention to start auto-betting.
    // The useEffect hook will handle the actual start logic.
    if (gameState.isAutoBetting || gameState.autoBetStarting) {
      if(isMountedRef.current) {
          setTimeout(() => {
            toast({ title: "Auto-Bet Info", description: "Auto-bet is already active or initializing."});
          },0);
      }
      return;
    }
    playSound('AUTO_BET_START');
    console.log("startAutoBet called with settings:", settings);

    setGameState(prev => ({
      ...prev,
      autoBetSettings: settings,
      autoBetRoundsRemaining: settings.numberOfBets,
      autoBetSessionProfit: 0,
      autoBetStarting: true, // Indicate that auto-bet is trying to start
      isAutoBetting: false, // Not yet actively betting
    }));

    if (isMountedRef.current) {
      setTimeout(() => {
        toast({ title: "Auto-Bet Initializing",
                description: `Will start after current round or short delay. Rounds: ${settings.numberOfBets}, Bet: ${settings.betAmount.toFixed(2)} USDT.`});
      }, 0);
    }
  }, [gameState.isAutoBetting, gameState.autoBetStarting, toast]);

  useEffect(() => {
    // This useEffect now manages the lifecycle of an auto-bet session
    const { isAutoBetting, autoBetStarting, autoBetSettings, autoBetRoundsRemaining,
            gamePhase, userBalance, autoBetSessionProfit, isDemoMode, demoBalance } = gameState;

    console.log("Auto-Bet Effect Triggered. State:", { isAutoBetting, autoBetStarting, gamePhase, autoBetRoundsRemaining });

    if (!autoBetStarting && !isAutoBetting) {
      if (autoBetActionTimerRef.current) {
        console.log("Auto-Bet Effect: Clearing timer as no auto-bet is active or starting.");
        clearTimeout(autoBetActionTimerRef.current);
        autoBetActionTimerRef.current = null;
      }
      return; // No auto-bet session active or starting
    }

    const canStartNewRound = gamePhase === 'idle' || gamePhase === 'crashed' || gamePhase === 'cashedOut';
    const currentEffectiveBalance = isDemoMode ? demoBalance : userBalance;

    // Handle the initial start of the auto-bet session
    if (autoBetStarting && !isAutoBetting) {
      if (!autoBetSettings) { console.error("Auto-Bet Effect (Starting): No settings found, stopping."); stopAutoBet('error'); return; }
      if (!canStartNewRound) { console.log("Auto-Bet Effect (Starting): Game not ready for first bet, waiting. Phase:", gamePhase); return; } // Wait for game to be idle

      // Clear any existing timer before setting a new one
      if (autoBetActionTimerRef.current) clearTimeout(autoBetActionTimerRef.current);

      console.log(`Auto-Bet Effect (Starting): Scheduling first auto-bet in ${AUTO_BET_INITIAL_DELAY / 1000}s.`);
      autoBetActionTimerRef.current = setTimeout(() => {
        setGameState(currentGs => { // Use functional update to get latest state
          // Double check conditions inside timeout
          if (!currentGs.autoBetStarting || currentGs.isAutoBetting || !currentGs.autoBetSettings) {
            console.log("Auto-Bet Effect (First Bet Timeout): Conditions changed, aborting first bet.");
            return currentGs; // Abort if state changed (e.g., user stopped it)
          }
          const currentPhaseInTimeout = currentGs.gamePhase;
          if (currentPhaseInTimeout !== 'idle' && currentPhaseInTimeout !== 'crashed' && currentPhaseInTimeout !== 'cashedOut') {
             console.log("Auto-Bet Effect (First Bet Timeout): Game not idle for first bet, phase:", currentPhaseInTimeout, ". Will retry on next effect run.");
             // Do not place bet, useEffect will re-trigger when gamePhase changes
             return currentGs;
          }

          const balanceForFirstBet = currentGs.isDemoMode ? currentGs.demoBalance : currentGs.userBalance;
          if (currentGs.autoBetSettings.betAmount <= balanceForFirstBet) {
            console.log("Auto-Bet Effect (First Bet Timeout): Placing first auto-bet.");
            placeBet(currentGs.autoBetSettings.betAmount, { isAutoRound: true, autoCashOutAt: currentGs.autoBetSettings.cashOutAtMultiplier });
            // Transition from starting to active betting
            return { ...currentGs, isAutoBetting: true, autoBetStarting: false };
          } else {
            if(isMountedRef.current) { setTimeout(() => { toast({ title: "Auto-Bet Stopped", description: "Insufficient balance for first auto-bet.", variant: "destructive"}); },0); }
            console.log("Auto-Bet Effect (First Bet Timeout): Insufficient balance, stopping auto-bet.");
            stopAutoBet('error'); // This will set autoBetStarting and isAutoBetting to false
            return { ...currentGs, autoBetStarting: false, isAutoBetting: false }; // Ensure state is consistent
          }
        });
      }, AUTO_BET_INITIAL_DELAY);
    }
    // Handle subsequent rounds of an active auto-bet session
    else if (isAutoBetting && !autoBetStarting) {
      if (!autoBetSettings) { console.error("Auto-Bet Effect (Running): No settings found, stopping."); stopAutoBet('error'); return; }

      // Check for stop conditions
      if ((autoBetRoundsRemaining || 0) <= 0) {
        if(isMountedRef.current && autoBetSettings && autoBetSettings.numberOfBets > 0) { // Only toast if rounds were actually set
          setTimeout(() => { toast({ title: "Auto-Bet Finished", description: `All ${autoBetSettings.numberOfBets} rounds completed. Session Profit: ${autoBetSessionProfit.toFixed(2)} USDT.`}); },0);
        }
        console.log("Auto-Bet Effect (Running): All rounds completed. Stopping auto-bet.");
        stopAutoBet('rounds_completed');
        return;
      }
      if (autoBetSettings.stopOnProfit && autoBetSessionProfit >= autoBetSettings.stopOnProfit) {
        if(isMountedRef.current) { setTimeout(() => { toast({ title: "Auto-Bet Finished", description: `Profit target of +${autoBetSettings.stopOnProfit!.toFixed(2)} USDT reached. Session Profit: ${autoBetSessionProfit.toFixed(2)} USDT`}); }, 0); }
        console.log("Auto-Bet Effect (Running): Stop on profit reached. Stopping auto-bet.");
        stopAutoBet('profit_target');
        return;
      }
      if (autoBetSettings.stopOnLoss && autoBetSessionProfit <= -(autoBetSettings.stopOnLoss)) {
         if(isMountedRef.current) { setTimeout(() => { toast({ title: "Auto-Bet Finished", description: `Loss limit of -${autoBetSettings.stopOnLoss!.toFixed(2)} USDT reached. Session Profit: ${autoBetSessionProfit.toFixed(2)} USDT`, variant: "destructive"}); }, 0); }
         console.log("Auto-Bet Effect (Running): Stop on loss reached. Stopping auto-bet.");
         stopAutoBet('loss_limit');
         return;
      }

      // Wait for the game to be ready for the next round
      if (!canStartNewRound) { console.log("Auto-Bet Effect (Running): Game not ready for next round, waiting. Phase:", gamePhase); return; }

      // Check balance before placing the next bet
      if (autoBetSettings.betAmount > currentEffectiveBalance) {
        if(isMountedRef.current) { setTimeout(() => { toast({ title: "Auto-Bet Stopped", description: "Insufficient balance for next auto-bet round.", variant: "destructive"}); },0); }
        console.log("Auto-Bet Effect (Running): Insufficient balance for next bet, stopping auto-bet.");
        stopAutoBet('error');
        return;
      }

      // Clear any existing timer before setting a new one
      if (autoBetActionTimerRef.current) clearTimeout(autoBetActionTimerRef.current);

      console.log(`Auto-Bet Effect (Running): Scheduling next bet in ${AUTO_BET_INTER_ROUND_DELAY / 1000}s. Rounds remaining: ${autoBetRoundsRemaining}`);
      autoBetActionTimerRef.current = setTimeout(() => {
        setGameState(currentGs => { // Use functional update
          // Double check conditions inside timeout
          if (!currentGs.isAutoBetting || currentGs.autoBetStarting || !currentGs.autoBetSettings || (currentGs.autoBetRoundsRemaining || 0) <= 0) {
            console.log("Auto-Bet Effect (Next Bet Timeout): Conditions changed, aborting next bet.");
            return currentGs; // Abort if state changed
          }
          const currentPhaseInTimeout = currentGs.gamePhase;
           if (currentPhaseInTimeout !== 'idle' && currentPhaseInTimeout !== 'crashed' && currentPhaseInTimeout !== 'cashedOut') {
             console.log("Auto-Bet Effect (Next Bet Timeout): Game not idle for next bet, phase:", currentPhaseInTimeout, ". Will retry on next effect run.");
             return currentGs;
          }

          const balanceForNextBet = currentGs.isDemoMode ? currentGs.demoBalance : currentGs.userBalance;
          if (currentGs.autoBetSettings.betAmount <= balanceForNextBet) {
            console.log("Auto-Bet Effect (Next Bet Timeout): Placing next auto-bet.");
            placeBet(currentGs.autoBetSettings.betAmount, { isAutoRound: true, autoCashOutAt: currentGs.autoBetSettings.cashOutAtMultiplier });
          } else {
            if(isMountedRef.current) { setTimeout(() => { toast({ title: "Auto-Bet Stopped", description: "Insufficient balance for next auto-bet round.", variant: "destructive"}); },0); }
            console.log("Auto-Bet Effect (Next Bet Timeout): Insufficient balance, stopping auto-bet.");
            stopAutoBet('error'); // This will set isAutoBetting to false
            return { ...currentGs, isAutoBetting: false }; // Ensure state is consistent
          }
          return currentGs; // Return current state, placeBet will trigger re-render
        });
      }, AUTO_BET_INTER_ROUND_DELAY);
    }

    // Cleanup function for the useEffect
    return () => {
      if (autoBetActionTimerRef.current) {
        console.log("Auto-Bet Effect: Cleanup function clearing autoBetActionTimerRef.");
        clearTimeout(autoBetActionTimerRef.current);
        autoBetActionTimerRef.current = null;
      }
    };
  }, [ // Carefully chosen dependencies
       gameState.isAutoBetting, gameState.autoBetStarting, gameState.autoBetSettings, gameState.autoBetRoundsRemaining,
       gameState.gamePhase, gameState.userBalance, gameState.demoBalance, gameState.isDemoMode, gameState.autoBetSessionProfit,
       placeBet, stopAutoBet, toast
     ]);

  // Cleanup game loop on unmount
  useEffect(() => {
    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
      if(countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      stopSound('PLANE_FLYING'); // Ensure flying sound stops on unmount
    };
  }, []);

  // Deposit function
  const depositUSDT = useCallback(async (amount: number, transferProofImage: string | null): Promise<boolean> => {
    if (gameState.isDemoMode) {
      if (isMountedRef.current) { setTimeout(() => { toast({ title: "Demo Mode", description: "Deposits are disabled in demo mode.", variant: "default" }); }, 0); }
      return false;
    }
    if (!gameState.loggedInUser || !gameState.loggedInUser.id || !gameState.loggedInUser.email) {
      if (isMountedRef.current) { setTimeout(() => { toast({ title: "Error", description: "You must be logged in to deposit.", variant: "destructive" }); }, 0); }
      return false;
    }

    addTransaction({
        userId: gameState.loggedInUser.id,
        userEmail: gameState.loggedInUser.email,
        type: 'deposit',
        amount: amount,
        transferProofImage: transferProofImage
    });

    if (isMountedRef.current) { setTimeout(() => { toast({ title: "Deposit Submitted", description: `Your deposit request of ${amount} USDT is pending approval.`, variant: "default" }); }, 0); }
    return true;
  }, [gameState.loggedInUser, gameState.isDemoMode, toast]);

  // Withdraw function
  const withdrawUSDT = useCallback(async (amount: number, address: string): Promise<boolean> => {
     if (gameState.isDemoMode) {
      if (isMountedRef.current) { setTimeout(() => { toast({ title: "Demo Mode", description: "Withdrawals are disabled in demo mode.", variant: "default" }); }, 0); }
      return false;
    }
    if (!gameState.loggedInUser || !gameState.loggedInUser.id || !gameState.loggedInUser.email) {
       if (isMountedRef.current) { setTimeout(() => { toast({ title: "Error", description: "You must be logged in to withdraw.", variant: "destructive" }); }, 0); }
      return false;
    }
    if (amount <= 0) {
      if (isMountedRef.current) { setTimeout(() => { toast({title: "Invalid Amount", description: "Withdrawal amount must be positive.", variant: "destructive"}); }, 0); }
      return false;
    }

    const currentBalance = gameState.userBalance;
    if (amount > currentBalance) {
      if (isMountedRef.current) { setTimeout(() => { toast({ title: "Error", description: `Insufficient balance. You have ${currentBalance.toFixed(2)} USDT.`, variant: "destructive" }); }, 0); }
      return false;
    }

    const dailyLimit = calculateUserDailyWithdrawalLimit(gameState.loggedInUser);
    if (amount > dailyLimit) {
      if (isMountedRef.current) { setTimeout(() => { toast({ title: "Limit Exceeded", description: `Withdrawal amount exceeds your daily limit of ${dailyLimit.toFixed(2)} USDT.`, variant: "destructive" }); }, 0); }
      return false;
    }

    addTransaction({
        userId: gameState.loggedInUser.id,
        userEmail: gameState.loggedInUser.email,
        type: 'withdrawal',
        amount: amount,
        address: address
    });
    recordUserWithdrawal(gameState.loggedInUser.email, amount); // Record withdrawal for daily limit tracking

    if (isMountedRef.current) { setTimeout(() => { toast({ title: "Withdrawal Submitted", description: `Your withdrawal request of ${amount} USDT to ${address} is pending approval.`, variant: "default"}); }, 0); }
    return true;
  }, [gameState.loggedInUser, gameState.userBalance, gameState.isDemoMode, toast]);


  return {
    gameState,
    placeBet,
    cashOut,
    resetGame: resetGameForNextRound,
    depositUSDT,
    withdrawUSDT,
    setGameUserBalance,
    setDemoMode,
    startAutoBet,
    stopAutoBet,
  };
}

