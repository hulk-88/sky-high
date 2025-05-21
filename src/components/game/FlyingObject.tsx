"use client";

import type { GamePhase, Obstacle as ObstacleType } from '@/types';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface FlyingObjectProps {
  multiplier: number;
  gamePhase: GamePhase;
  planePosition: { x: number, y: number, width: number, height: number };
  obstacles: ObstacleType[];
}

// F16-like SVG, will be rotated for L-R flight.
// Visual size controlled by Tailwind classes (w-28 h-40 before rotation)
const F16PlaneSVG = ({ className, isCrashed, ...props }: React.SVGProps<SVGSVGElement> & { isCrashed?: boolean }) => (
  <svg
    viewBox="0 0 60 100"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    className={cn(
      "text-primary drop-shadow-[0_5px_15px_hsl(var(--primary)/0.4)]",
      "w-28 h-40", // Base size before rotation
      isCrashed ? "opacity-50" : "",
      className
    )}
    data-ai-hint="fighter jet"
    {...props}
  >
    {/* Main Body */}
    <path d="M30 0 L35 20 L25 20 Z" /> {/* Nose cone */}
    <path d="M25 20 L35 20 L35 60 L25 60 Z" /> {/* Fuselage */}

    {/* Stripes on Fuselage */}
    <rect x="26" y="25" width="8" height="1.5" fill="hsl(var(--secondary-foreground))" /> {/* Blueish/darker stripe */}
    <rect x="26" y="30" width="8" height="1.5" fill="hsl(var(--destructive))" /> {/* Red stripe */}
    <rect x="26" y="35" width="8" height="1.5" fill="hsl(var(--primary-foreground))" /> {/* White stripe */}
    <rect x="26" y="40" width="8" height="1.5" fill="hsl(var(--secondary-foreground))" />
    <rect x="26" y="45" width="8" height="1.5" fill="hsl(var(--destructive))" />
    <rect x="26" y="50" width="8" height="1.5" fill="hsl(var(--primary-foreground))" />


    {/* Wings */}
    <path d="M5 25 L25 35 L25 45 L5 50 Z" />
    <path d="M55 25 L35 35 L35 45 L55 50 Z" />

    {/* Stripes on Wings (example on one wing) */}
    <polygon points="10,30 20,38 20,39 10,31" fill="hsl(var(--secondary-foreground))" />
    <polygon points="10,33 20,41 20,42 10,34" fill="hsl(var(--destructive))" />
    <polygon points="40,38 50,30 50,31 40,39" fill="hsl(var(--primary-foreground))" />


    {/* Tail */}
    <path d="M28 60 L32 60 L35 75 L25 75 Z" />
    <path d="M30 75 L33 95 L27 95 Z" />
    <path d="M15 62 L28 62 L28 70 L15 75 Z" />
    <path d="M45 62 L32 62 L32 70 L45 75 Z" />
    <ellipse cx="30" cy="58" rx="7" ry="4" className="fill-slate-400 opacity-75" />
  </svg>
);


// Simple smoke particle, now returns a div with an SVG containing a circle
const SmokeParticle = ({ offset, scale, opacity }: { offset: {x: number, y: number}, scale: number, opacity: number }) => {
  const radius = 8 * scale;
  if (radius <= 0) return null;
  const diameter = 2 * radius;

  return (
    <div
      style={{
        position: 'absolute',
        left: `${offset.x - radius}px`,
        top: `${offset.y - radius}px`,
        width: `${diameter}px`,
        height: `${diameter}px`,
        opacity: opacity,
        pointerEvents: 'none',
      }}
      className="transition-opacity duration-150"
    >
      <svg viewBox={`0 0 ${diameter} ${diameter}`} width="100%" height="100%">
        <circle
          cx={radius}
          cy={radius}
          r={radius}
          className="fill-slate-400"
        />
      </svg>
    </div>
  );
};


const MissileSVG = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 50 20" // ViewBox swapped for horizontal orientation
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    className={cn("w-12 h-6 text-destructive drop-shadow-md", className)} // Dimensions swapped
    data-ai-hint="horizontal missile" // Updated hint
    {...props}
  >
    <g transform="rotate(-90 25 10) translate(-15 15)"> {/* Adjusted rotation and translation for new viewBox */}
      {/* Original SVG paths, now effectively horizontal */}
      <path d="M10 0 L13 5 L7 5 Z" /> {/* Nose cone (now right tip) */}
      <rect x="7" y="5" width="6" height="35" /> {/* Body */}
      {/* Fins */}
      <path d="M7 30 L2 35 L2 40 L7 38 Z" />
      <path d="M13 30 L18 35 L18 40 L13 38 Z" />
      <path d="M9 45 L11 45 L11 50 L9 50 Z" fill="orange" />  {/* Thruster (now left end) */}
    </g>
  </svg>
);


const ExplosionSVG = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 100 100"
    xmlns="http://www.w3.org/2000/svg"
    className={cn("w-full h-full", className)}
    data-ai-hint="explosion burst"
    {...props}
  >
    <circle cx="50" cy="50" r="45" fill="url(#grad)" />
    <defs>
      <radialGradient id="grad" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
        <stop offset="0%" style={{stopColor: 'rgba(255,220,0,1)', stopOpacity: 1}} />
        <stop offset="70%" style={{stopColor: 'rgba(255,150,0,0.8)', stopOpacity: 1}} />
        <stop offset="100%" style={{stopColor: 'rgba(255,0,0,0.5)', stopOpacity: 0}} />
      </radialGradient>
    </defs>
    {[0, 45, 90, 135, 180, 225, 270, 315].map(angle => (
      <polygon
        key={angle}
        points="50,5 55,45 50,50 45,45"
        fill="rgba(255,200,0,0.7)"
        transform={`rotate(${angle} 50 50) translate(0 -5) scale(1.2)`}
      />
    ))}
  </svg>
);

// Original F16 visual dimensions before rotation for positioning smoke
const F16_VISUAL_W_UPRIGHT = 112; // w-28
const F16_VISUAL_H_UPRIGHT = 160; // h-40

export function FlyingObject({ gamePhase, planePosition, obstacles }: FlyingObjectProps) {
  const [showExplosion, setShowExplosion] = useState(false);
  const [smokeParticlesData, setSmokeParticlesData] = useState<{id: number, age: number}[]>([]);

  useEffect(() => {
    if (gamePhase === 'crashed') {
      setShowExplosion(true);
      const timer = setTimeout(() => setShowExplosion(false), 700); // Duration of explosion animation
      return () => clearTimeout(timer);
    } else {
      setShowExplosion(false);
    }
  }, [gamePhase]);

  // Smoke particle effect
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    if (gamePhase === 'playing') {
      intervalId = setInterval(() => {
        setSmokeParticlesData(prev => {
          const newParticles = [...prev.map(p => ({ ...p, age: p.age + 1 })).filter(p => p.age < 5)]; // Age out particles
          newParticles.unshift({ id: Date.now(), age: 0 }); // Add new particle
          return newParticles.slice(0, 10); // Limit max smoke particles
        });
      }, 100); // Add particle every 100ms
    } else {
      setSmokeParticlesData([]); // Clear smoke when not playing
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [gamePhase]);


  const isPlaying = gamePhase === 'playing';

  // Visual width/height when F16 is rotated for L-R flight
  const RENDER_PLANE_VISUAL_WIDTH = F16_VISUAL_H_UPRIGHT; // Original height is now width
  const RENDER_PLANE_VISUAL_HEIGHT = F16_VISUAL_W_UPRIGHT; // Original width is now height

  // Missile visual dimensions (now horizontal)
  const RENDER_MISSILE_WIDTH = 48;
  const RENDER_MISSILE_HEIGHT = 24;


  return (
    <>
      {/* F16 Plane */}
      <div
        className="absolute transition-transform duration-100 ease-linear"
        style={{
          // planePosition.x/y is center of collision box
          left: `${planePosition.x - RENDER_PLANE_VISUAL_WIDTH / 2}px`,
          top: `${planePosition.y - RENDER_PLANE_VISUAL_HEIGHT / 2}px`,
          width: `${RENDER_PLANE_VISUAL_WIDTH}px`, // Visual container takes rotated dimensions
          height: `${RENDER_PLANE_VISUAL_HEIGHT}px`,
        }}
      >
        {(!showExplosion && (gamePhase === 'playing' || gamePhase === 'betting' || gamePhase === 'idle' || gamePhase === 'cashedOut')) && (
          <div
            className={cn(
              "relative w-full h-full", // Container for rotation and smoke
              isPlaying ? "animate-subtlePulse" : "opacity-70",
              gamePhase === 'cashedOut' && "opacity-50"
            )}
            style={{ transformOrigin: 'center center' }} // Ensure rotation is centered
          >
            <F16PlaneSVG
              style={{ transform: 'rotate(90deg) translateY(-15%) translateX(15%)' }} // Rotate SVG, then adjust for visual centering
              className="absolute top-0 left-0" // Position SVG within its rotated container
              isCrashed={gamePhase === 'crashed'}
            />
            {/* Smoke Trail - positioned relative to the plane's (rotated) tail */}
            {isPlaying && smokeParticlesData.map(p => (
                <SmokeParticle
                  key={p.id}
                  offset={{
                    // Position smoke relative to the (now horizontal) plane's left side (tail)
                    x: RENDER_PLANE_VISUAL_WIDTH * 0.2 - (p.age * 7), // Start from plane's "tail" (left part after rotation) and move left with age
                    y: RENDER_PLANE_VISUAL_HEIGHT / 2 + (Math.random() - 0.5) * 15 // Slight vertical jitter around center
                  }}
                  scale={1 - p.age * 0.18} // Shrink with age
                  opacity={Math.max(0, 0.7 - p.age * 0.18)} // Fade out with age
                />
              ))}
          </div>
        )}
        {showExplosion && (
          <div
            className="animate-pingOnce"
            style={{
              width: `${RENDER_PLANE_VISUAL_WIDTH * 0.9}px`,
              height: `${RENDER_PLANE_VISUAL_WIDTH * 0.9}px`, // Explosion based on plane's current main dimension
              position: 'absolute',
              left: `50%`,
              top: `50%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <ExplosionSVG />
          </div>
        )}
      </div>

      {/* Obstacles (Missiles) - Moving Right to Left, now horizontal */}
      {obstacles.map(obstacle => (
        <div
          key={obstacle.id}
          className="absolute"
          style={{
            // obstacle.x is center, obstacle.y is center (for horizontal missile)
            left: `${obstacle.x - RENDER_MISSILE_WIDTH / 2}px`,
            top: `${obstacle.y - RENDER_MISSILE_HEIGHT / 2}px`, // Adjust Y to be centered
            width: `${RENDER_MISSILE_WIDTH}px`,
            height: `${RENDER_MISSILE_HEIGHT}px`,
          }}
        >
          {obstacle.type === 'missile' && <MissileSVG />}
        </div>
      ))}
    </>
  );
}
