
"use client";

import React, { useEffect, useState } from 'react';
import type { SpinPrize } from '@/types';
import { cn } from '@/lib/utils';

interface SpinWheelProps {
  segments: SpinPrize[];
  spinning: boolean;
  targetSegmentIndex: number | null; // Index of the segment to land on
}

const WHEEL_SIZE = 300; // px
const POINTER_SIZE = 40; // px

export function SpinWheel({ segments, spinning, targetSegmentIndex }: SpinWheelProps) {
  const numSegments = segments.length;
  const anglePerSegment = 360 / numSegments;
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (spinning) {
      // Continuous rotation animation while spinning
      const animateSpin = () => {
        setRotation(prev => prev + 10); // Adjust speed of visual spin
        requestAnimationFrame(animateSpin);
      };
      const animationFrameId = requestAnimationFrame(animateSpin);
      return () => cancelAnimationFrame(animationFrameId);
    } else if (targetSegmentIndex !== null) {
      // Calculate final rotation to land on the target segment
      // The wheel spins multiple times + lands on the target
      // The pointer is at the top (0 degrees or 360 degrees on the SVG coordinate system, which is effectively 12 o'clock)
      // We want the *middle* of the target segment to align with the pointer.
      // Angle of the start of the target segment: targetSegmentIndex * anglePerSegment
      // Angle of the middle of the target segment: (targetSegmentIndex * anglePerSegment) + (anglePerSegment / 2)
      // We need to rotate the wheel so this middle angle is at the top (effectively 0 or negative of this angle)
      
      const targetAngle = -((targetSegmentIndex * anglePerSegment) + (anglePerSegment / 2));
      
      // Add multiple full rotations for visual effect
      const fullRotations = 5 * 360; // 5 full spins
      const finalRotation = fullRotations + targetAngle;
      
      setRotation(finalRotation);
    }
  }, [spinning, targetSegmentIndex, anglePerSegment, numSegments]);


  return (
    <div className="relative flex items-center justify-center" style={{ width: WHEEL_SIZE, height: WHEEL_SIZE }}>
      {/* Pointer */}
      <div
        className="absolute z-10"
        style={{
          top: `-${POINTER_SIZE / 3}px`, // Position pointer above the wheel
          left: `calc(50% - ${POINTER_SIZE / 2}px)`,
          width: `${POINTER_SIZE}px`,
          height: `${POINTER_SIZE}px`,
        }}
      >
        <svg viewBox="0 0 100 100" fill="hsl(var(--primary))" className="drop-shadow-lg">
          <polygon points="50,0 65,50 35,50" /> {/* Simple triangle pointer */}
        </svg>
      </div>

      {/* Wheel */}
      <div
        className={cn(
          "relative rounded-full border-4 border-primary/50 shadow-2xl overflow-hidden",
          "transition-transform duration-[4000ms] ease-out" // CSS transition for landing
        )}
        style={{
          width: WHEEL_SIZE,
          height: WHEEL_SIZE,
          transform: `rotate(${rotation}deg)`,
        }}
        data-ai-hint="prize wheel casino"
      >
        {segments.map((segment, index) => {
          const rotateAngle = index * anglePerSegment;
          const skewAngle = 90 - anglePerSegment; // Skew for pie slice effect

          // Calculate clip-path for wedge shape
          // For a segment, we need 3 points: center (50% 50%), and two points on the circumference
          // The angle for the first point on circumference
          const startAngleRad = (index * anglePerSegment - 90) * (Math.PI / 180);
          // The angle for the second point on circumference
          const endAngleRad = ((index + 1) * anglePerSegment - 90) * (Math.PI / 180);

          const x1 = 50 + 50 * Math.cos(startAngleRad);
          const y1 = 50 + 50 * Math.sin(startAngleRad);
          const x2 = 50 + 50 * Math.cos(endAngleRad);
          const y2 = 50 + 50 * Math.sin(endAngleRad);
          
          // If anglePerSegment is large (e.g., > 180), the clip-path might need adjustments.
          // For standard wheels with many segments, this should work.
          const clipPathPolygon = numSegments > 1 ? `polygon(50% 50%, ${x1}% ${y1}%, ${x2}% ${y2}%)` : `circle(50%)`;


          return (
            <div
              key={segment.value + "-" + index}
              className={cn(
                "absolute inset-0 flex items-center justify-center origin-center",
                segment.color
              )}
              style={{
                clipPath: clipPathPolygon,
              }}
            >
              <div
                className="text-center text-xs font-semibold text-primary-foreground drop-shadow-sm"
                style={{
                  transform: `rotate(${anglePerSegment / 2}deg) translate(0, -${WHEEL_SIZE / 4}px) rotate(${-rotateAngle - (anglePerSegment / 2)}deg)`,
                  // Position text towards the outer edge and orient it correctly
                }}
              >
                {segment.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
