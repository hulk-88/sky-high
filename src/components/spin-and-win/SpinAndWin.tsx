
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Gift, PlayCircle, AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { User, SpinPrize } from '@/types';
import { SpinWheel } from './SpinWheel';
import { addTransaction } from '@/lib/transaction-storage';
import { SOUND_FILES } from '@/types';

interface SpinAndWinProps {
  user: User;
  onWinClaim: (amount: number) => void;
}

const LS_LAST_SPIN_TIME_KEY_PREFIX = "skyhigh_last_spin_time_";
const COOLDOWN_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

const playSound = (sound: keyof typeof SOUND_FILES) => {
  if (typeof window !== 'undefined' && SOUND_FILES[sound]) {
    const audio = new Audio(SOUND_FILES[sound]);
    audio.play().catch(error => console.warn(`Sound play failed for ${sound}:`, error));
  }
};

const prizeSegments: SpinPrize[] = [
  { value: 0.10, label: "$0.10", color: "hsl(var(--chart-1))", weight: 350 }, // Higher weight = more common
  { value: 0.20, label: "$0.20", color: "hsl(var(--chart-2))", weight: 250 },
  { value: 0.30, label: "$0.30", color: "hsl(var(--chart-3))", weight: 150 },
  { value: 0.50, label: "$0.50", color: "hsl(var(--chart-4))", weight: 100 },
  { value: 0.75, label: "$0.75", color: "hsl(var(--chart-5))", weight: 70 },
  { value: 1.00, label: "$1.00", color: "hsl(var(--primary))", weight: 50 },
  { value: 2.50, label: "$2.50", color: "hsl(var(--accent))", weight: 20 }, // Harder to get
  { value: 5.00, label: "$5.00", color: "hsl(var(--destructive))", weight: 7 }, // Even harder
  { value: 10.00, label: "$10", color: "hsl(var(--secondary))", weight: 2 }, // Rare
  { value: 25.00, label: "$25", color: "hsl(var(--muted-foreground))", weight: 1 }, // Very Rare
  // { value: 50.00, label: "$50", color: "hsl(var(--ring))", weight: 0.5 }, // Extremely Rare (adjust weight to be integer)
];

const calculateTotalWeight = () => prizeSegments.reduce((sum, prize) => sum + prize.weight, 0);
const totalWeight = calculateTotalWeight();

const selectPrize = (): SpinPrize => {
  let random = Math.random() * totalWeight;
  for (const prize of prizeSegments) {
    if (random < prize.weight) {
      return prize;
    }
    random -= prize.weight;
  }
  return prizeSegments[0]; // Fallback, should not happen if weights are correct
};

export function SpinAndWin({ user, onWinClaim }: SpinAndWinProps) {
  const { toast } = useToast();
  const [lastSpinTime, setLastSpinTime] = useState<number | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [canSpin, setCanSpin] = useState(false);
  const [targetSegmentIndex, setTargetSegmentIndex] = useState<number | null>(null);

  const getLsKey = useCallback(() => `${LS_LAST_SPIN_TIME_KEY_PREFIX}${user.id}`, [user.id]);

  useEffect(() => {
    const storedLastSpinTime = localStorage.getItem(getLsKey());
    if (storedLastSpinTime) {
      setLastSpinTime(parseInt(storedLastSpinTime, 10));
    } else {
      setCanSpin(true); // Can spin if no record
    }
  }, [getLsKey]);

  useEffect(() => {
    if (lastSpinTime === null) return;

    const updateCooldown = () => {
      const now = Date.now();
      const timeSinceLastSpin = now - lastSpinTime;
      const remaining = COOLDOWN_DURATION_MS - timeSinceLastSpin;

      if (remaining <= 0) {
        setCooldownRemaining(0);
        setCanSpin(true);
        if (timerId) clearInterval(timerId);
      } else {
        setCooldownRemaining(remaining);
        setCanSpin(false);
      }
    };

    updateCooldown(); // Initial check
    const timerId = setInterval(updateCooldown, 1000);

    return () => clearInterval(timerId);
  }, [lastSpinTime]);

  const handleSpin = () => {
    if (!canSpin || isSpinning) return;

    playSound('SPIN_CLICK');
    setIsSpinning(true);
    setTargetSegmentIndex(null); // Clear previous target

    const wonPrize = selectPrize();
    const winningIndex = prizeSegments.findIndex(p => p.value === wonPrize.value);
    
    // Simulate spin duration
    const spinDuration = 3000 + Math.random() * 2000; // 3-5 seconds

    setTimeout(() => {
      playSound('SPIN_LAND');
      setTargetSegmentIndex(winningIndex);
      setIsSpinning(false);
      
      const now = Date.now();
      localStorage.setItem(getLsKey(), now.toString());
      setLastSpinTime(now);
      setCanSpin(false);

      toast({
        title: "Congratulations!",
        description: (
          <div className="flex flex-col gap-2 items-start">
            <span>You won: <strong>{wonPrize.label}</strong>!</span>
            <Button
              size="sm"
              onClick={() => {
                onWinClaim(wonPrize.value);
                addTransaction({
                  userId: user.id,
                  userEmail: user.email,
                  type: 'spin_win',
                  amount: wonPrize.value,
                });
                // No need to call toast here, onWinClaim in page.tsx will show "Winnings Claimed!"
              }}
              className="mt-2 bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              <CheckCircle className="mr-2 h-4 w-4" /> Claim Winnings
            </Button>
          </div>
        ),
        variant: "success",
        duration: 15000, // Keep toast longer for user to claim
      });

    }, spinDuration);
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <Card className="w-full max-w-md mx-auto shadow-xl my-6">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl flex items-center justify-center gap-2">
          <Gift className="w-7 h-7 text-primary" />
          Spin & Win Daily!
        </CardTitle>
        <CardDescription>Try your luck once every 24 hours to win USDT prizes.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-6">
        <SpinWheel segments={prizeSegments} spinning={isSpinning} targetSegmentIndex={targetSegmentIndex} />

        {canSpin ? (
          <Button
            size="lg"
            onClick={handleSpin}
            disabled={isSpinning}
            className="w-full text-lg py-6 bg-gradient-to-r from-primary via-purple-500 to-pink-500 hover:from-primary/90 hover:via-purple-500/90 hover:to-pink-500/90 text-primary-foreground shadow-lg"
          >
            <PlayCircle className="mr-2 h-6 w-6" /> {isSpinning ? 'Spinning...' : 'Spin the Wheel!'}
          </Button>
        ) : (
          <div className="w-full p-4 border rounded-lg bg-muted text-center">
            <div className="flex items-center justify-center text-lg font-semibold text-primary">
              <Clock className="mr-2 h-5 w-5" />
              Next Spin In:
            </div>
            <div className="text-3xl font-bold text-foreground tabular-nums my-2">
              {formatTime(cooldownRemaining)}
            </div>
            <p className="text-xs text-muted-foreground">Come back after 24 hours for another chance to win!</p>
          </div>
        )}
        {!user.email.endsWith("@gmail.com") && ( // Example condition for a message
            <p className="text-xs text-destructive mt-2 text-center flex items-center justify-center">
                <AlertTriangle className="h-4 w-4 mr-1" /> Please verify your email to ensure prize delivery. (Mock message)
            </p>
        )}
         <p className="text-xs text-muted-foreground text-center mt-2">Prizes range from $0.10 to $50. Good luck!</p>
      </CardContent>
    </Card>
  );
}
