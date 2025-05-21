
"use client";

import type { GamePhase } from "@/types";

interface GameStatusMessageProps {
  gamePhase: GamePhase;
  lastMultiplier: number | null;
  currentProfit: number | null;
  countdownSeconds: number | null; // Added for countdown display
}

export function GameStatusMessage({ gamePhase, lastMultiplier, currentProfit, countdownSeconds }: GameStatusMessageProps) {
  if (gamePhase === 'betting' && countdownSeconds !== null && countdownSeconds > 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-10">
        <p className="text-4xl font-bold text-yellow-400 animate-pulse">Starting in {countdownSeconds}s...</p>
      </div>
    );
  }
  
  // This original 'betting' message is now covered by the countdown,
  // or can be shown if countdown is somehow null during betting phase.
  // For now, the countdown message takes precedence.
  // if (gamePhase === 'betting' && (countdownSeconds === null || countdownSeconds <= 0)) {
  //   return (
  //     <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-10">
  //       <p className="text-4xl font-bold text-yellow-400 animate-pulse">PREPARING...</p>
  //     </div>
  //   );
  // }

  if (gamePhase === 'crashed' && lastMultiplier) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-md z-10">
        <div className="text-center p-6 rounded-lg shadow-2xl bg-destructive/20 border-2 border-destructive">
          <p className="text-5xl font-bold text-destructive animate-bounce">CRASHED!</p>
          <p className="text-3xl mt-2 text-destructive/90">at {lastMultiplier.toFixed(2)}x</p>
        </div>
      </div>
    );
  }

  if (gamePhase === 'cashedOut' && lastMultiplier && currentProfit !== null) { // Ensure currentProfit is not null
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-md z-10">
         <div className="text-center p-6 rounded-lg shadow-2xl bg-accent/20 border-2 border-accent">
          <p className="text-4xl font-bold text-accent">CASHED OUT!</p>
          <p className="text-2xl mt-2 text-accent/90">at {lastMultiplier.toFixed(2)}x</p>
          <p className="text-xl mt-1 text-accent/80">You won {currentProfit.toFixed(2)} USDT</p>
        </div>
      </div>
    );
  }

  return null;
}
