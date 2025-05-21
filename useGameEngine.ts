// In useGameEngine.ts, inside the game loop interval:
// ...
let effectiveGameDifficultyPercent = siteSettings.gameDifficultyPercent;
if (currentGs.betAmount && currentGs.betAmount >= 50) {
  effectiveGameDifficultyPercent = 90;
}
// ...
if (effectiveGameDifficultyPercent >= 90 && elapsedSeconds > (Math.random() * 4 + 1) ) {
  collisionDetected = true;
}
// ...
if (collisionDetected) {
  if (gameLoopRef.current) clearInterval(gameLoopRef.current);
  // ...
  return {
      ...currentGs,
      gamePhase: 'crashed',
      // ... other state updates for crash
  };
}
// ...