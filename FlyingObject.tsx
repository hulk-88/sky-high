// In FlyingObject.tsx:
useEffect(() => {
  if (gamePhase === 'crashed') {
    setShowExplosion(true);
    // ... timer to hide explosion ...
  } else {
    setShowExplosion(false);
  }
}, [gamePhase]);

// ... rendering logic:
// {(!showExplosion && (gamePhase === 'playing' || ...)) && ( /* render plane */ )}
// {showExplosion && ( /* render explosion */ )}