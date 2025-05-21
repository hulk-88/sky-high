
"use client";

import type { GamePhase } from "@/types";

interface MultiplierDisplayProps {
  multiplier: number;
  gamePhase: GamePhase;
  countdownSeconds: number | null; // Added to know if countdown is active
}

export function MultiplierDisplay({ multiplier, gamePhase, countdownSeconds }: MultiplierDisplayProps) {
  let displayValue = multiplier;
  let textColor = "text-accent"; // Default playing color (now theme's accent)

  if (gamePhase === 'idle') {
    displayValue = 0.00;
    textColor = "text-yellow-400";
  } else if (gamePhase === 'betting' && countdownSeconds !== null && countdownSeconds > 0) {
    displayValue = 0.00;
    textColor = "text-yellow-400"; // Color during countdown
  } else if (gamePhase === 'crashed') {
    textColor = "text-destructive"; // Theme's destructive color
  } else if (gamePhase === 'cashedOut') {
    textColor = "text-accent"; // Theme's accent color for win/cashout
  }
  // When gamePhase is 'playing' or 'betting' (but countdown finished), it uses the actual multiplier and accent color.
  
  return (
    <div className={`font-mono text-7xl md:text-8xl lg:text-9xl font-bold ${textColor} transition-colors duration-300`}>
      {displayValue.toFixed(2)}x
    </div>
  );
}

