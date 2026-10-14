'use client';

import React, { useState } from 'react';

interface RadarSpiderChartProps {
  resemblance: number; // 0 to 1
  authorizationConflict: number; // 0 to 1
  observedHarm: number; // 0 to 1
  evidenceQuality: number; // 0 to 1
  size?: number;
}

export function RadarSpiderChart({
  resemblance,
  authorizationConflict,
  observedHarm,
  evidenceQuality,
  size = 280,
}: RadarSpiderChartProps) {
  const [hoveredAxis, setHoveredAxis] = useState<string | null>(null);

  const center = size / 2;
  const maxRadius = (size / 2) - 38;

  // Clamp values between 0.05 and 1 for visual clarity
  const rResemblance = Math.max(0.08, Math.min(1, resemblance));
  const rAuth = Math.max(0.08, Math.min(1, authorizationConflict));
  const rHarm = Math.max(0.08, Math.min(1, observedHarm));
  const rQuality = Math.max(0.08, Math.min(1, evidenceQuality));

  // 4 Cardinal Points:
  // North (0°): Resemblance
  // East (90°): Authorization Conflict
  // South (180°): Observed Harm
  // West (270°): Evidence Quality
  const ptResemblance = { x: center, y: center - (maxRadius * rResemblance) };
  const ptAuth = { x: center + (maxRadius * rAuth), y: center };
  const ptHarm = { x: center, y: center + (maxRadius * rHarm) };
  const ptQuality = { x: center - (maxRadius * rQuality), y: center };

  const polygonPath = `M ${ptResemblance.x} ${ptResemblance.y} L ${ptAuth.x} ${ptAuth.y} L ${ptHarm.x} ${ptHarm.y} L ${ptQuality.x} ${ptQuality.y} Z`;

  // Uncertainty Margin (Confidence Ellipse):
  // When evidence quality is low, the uncertainty margin expands, visually enforcing the truth boundary:
  // "Low evidence quality requires abstention over certainty".
  const uncertainty = Math.max(0, 1 - rQuality) * 0.35;
  const ptUncertaintyRes = { x: center, y: center - (maxRadius * Math.min(1, rResemblance + uncertainty)) };
  const ptUncertaintyAuth = { x: center + (maxRadius * Math.min(1, rAuth + uncertainty)), y: center };
  const ptUncertaintyHarm = { x: center, y: center + (maxRadius * Math.min(1, rHarm + uncertainty)) };
  const ptUncertaintyQual = { x: center - (maxRadius * Math.max(0.05, rQuality - uncertainty)), y: center };
  const uncertaintyPath = `M ${ptUncertaintyRes.x} ${ptUncertaintyRes.y} L ${ptUncertaintyAuth.x} ${ptUncertaintyAuth.y} L ${ptUncertaintyHarm.x} ${ptUncertaintyHarm.y} L ${ptUncertaintyQual.x} ${ptUncertaintyQual.y} Z`;

  const levels = [0.25, 0.5, 0.75, 1.0];

  const axisDescriptions: Record<string, { label: string; value: string; rule: string; color: string }> = {
    resemblance: {
      label: 'Identity Resemblance',
      value: `${(resemblance * 100).toFixed(0)}%`,
      rule: 'Visual & lexical similarity to official baseline. Similarity alone never proves malicious intent.',
      color: '#d8f57b',
    },
    auth: {
      label: 'Authorization Conflict',
      value: `${(authorizationConflict * 100).toFixed(0)}%`,
      rule: 'Conflict between observed identity and registered official assets (unknown != authorized).',
      color: '#e9ad71',
    },
    harm: {
      label: 'Observed Harm',
      value: `${(observedHarm * 100).toFixed(0)}%`,
      rule: 'Direct exploitation signals (credential theft, payment diversion, emergency impersonation claims).',
      color: '#ef8c8c',
    },
    quality: {
      label: 'Evidence Quality',
      value: `${(evidenceQuality * 100).toFixed(0)}%`,
      rule: 'Integrity and completeness of connector observation. Low quality triggers mandatory abstention.',
      color: '#9cc4d9',
    },
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative inline-block">
        <svg
          width={size}
          height={size}
          className="overflow-visible select-none"
        >
          <defs>
            {/* Linear & Radial Gradients */}
            <linearGradient id="signalGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#d8f57b" stopOpacity="0.4" />
              <stop offset="50%" stopColor="#e9ad71" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#ef8c8c" stopOpacity="0.35" />
            </linearGradient>

            <radialGradient id="radarCenterGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#d8f57b" stopOpacity="0.25" />
              <stop offset="100%" stopColor="transparent" stopOpacity="0" />
            </radialGradient>

            <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Center ambient glow */}
          <circle cx={center} cy={center} r={maxRadius * 0.45} fill="url(#radarCenterGlow)" />

          {/* Concentric Reference Levels (Grid) */}
          {levels.map((lvl) => {
            const rad = maxRadius * lvl;
            return (
              <g key={lvl}>
                <polygon
                  points={`${center},${center - rad} ${center + rad},${center} ${center},${center + rad} ${center - rad},${center}`}
                  fill="none"
                  stroke="rgba(236, 233, 223, 0.08)"
                  strokeWidth="1"
                  strokeDasharray={lvl === 1 ? 'none' : '3 3'}
                />
                <text
                  x={center + 4}
                  y={center - rad + 9}
                  fill="#69756d"
                  fontSize="8"
                  fontFamily="var(--font-mono)"
                >
                  {(lvl * 100).toFixed(0)}%
                </text>
              </g>
            );
          })}

          {/* Cross Axes Lines */}
          <line
            x1={center}
            y1={center - maxRadius}
            x2={center}
            y2={center + maxRadius}
            stroke="rgba(236, 233, 223, 0.15)"
            strokeWidth="1"
          />
          <line
            x1={center - maxRadius}
            y1={center}
            x2={center + maxRadius}
            y2={center}
            stroke="rgba(236, 233, 223, 0.15)"
            strokeWidth="1"
          />

          {/* Uncertainty Margin (Confidence Ellipse / Abstention Zone) */}
          {evidenceQuality < 0.75 && (
            <g className="transition-opacity duration-300">
              <path
                d={uncertaintyPath}
                fill="rgba(233, 173, 113, 0.08)"
                stroke="#e9ad71"
                strokeWidth="1.2"
                strokeDasharray="4 4"
                opacity="0.8"
              />
            </g>
          )}

          {/* Primary 4D Signal Polygon */}
          <path
            d={polygonPath}
            fill="url(#signalGradient)"
            stroke="#d8f57b"
            strokeWidth="2"
            filter="url(#neonGlow)"
            className="transition-all duration-500 ease-out"
          />

          {/* Vertex Point 1: Resemblance (Top) */}
          <circle
            cx={ptResemblance.x}
            cy={ptResemblance.y}
            r="4.5"
            fill="#d8f57b"
            stroke="#080a0a"
            strokeWidth="1.5"
            className="cursor-pointer hover:scale-125 transition-transform"
            onMouseEnter={() => setHoveredAxis('resemblance')}
            onMouseLeave={() => setHoveredAxis(null)}
          />

          {/* Vertex Point 2: Auth Conflict (Right) */}
          <circle
            cx={ptAuth.x}
            cy={ptAuth.y}
            r="4.5"
            fill="#e9ad71"
            stroke="#080a0a"
            strokeWidth="1.5"
            className="cursor-pointer hover:scale-125 transition-transform"
            onMouseEnter={() => setHoveredAxis('auth')}
            onMouseLeave={() => setHoveredAxis(null)}
          />

          {/* Vertex Point 3: Observed Harm (Bottom) */}
          <circle
            cx={ptHarm.x}
            cy={ptHarm.y}
            r="4.5"
            fill="#ef8c8c"
            stroke="#080a0a"
            strokeWidth="1.5"
            className="cursor-pointer hover:scale-125 transition-transform"
            onMouseEnter={() => setHoveredAxis('harm')}
            onMouseLeave={() => setHoveredAxis(null)}
          />

          {/* Vertex Point 4: Evidence Quality (Left) */}
          <circle
            cx={ptQuality.x}
            cy={ptQuality.y}
            r="4.5"
            fill="#9cc4d9"
            stroke="#080a0a"
            strokeWidth="1.5"
            className="cursor-pointer hover:scale-125 transition-transform"
            onMouseEnter={() => setHoveredAxis('quality')}
            onMouseLeave={() => setHoveredAxis(null)}
          />

          {/* Outer Labels */}
          {/* North: Resemblance */}
          <text
            x={center}
            y={center - maxRadius - 12}
            textAnchor="middle"
            fill={hoveredAxis === 'resemblance' ? '#d8f57b' : '#ece9df'}
            fontSize="9.5"
            fontFamily="var(--font-mono)"
            fontWeight="600"
            className="cursor-pointer transition-colors"
            onMouseEnter={() => setHoveredAxis('resemblance')}
            onMouseLeave={() => setHoveredAxis(null)}
          >
            RESEMBLANCE {(resemblance * 100).toFixed(0)}%
          </text>

          {/* East: Authorization Conflict */}
          <text
            x={center + maxRadius + 10}
            y={center + 3}
            textAnchor="start"
            fill={hoveredAxis === 'auth' ? '#e9ad71' : '#ece9df'}
            fontSize="9.5"
            fontFamily="var(--font-mono)"
            fontWeight="600"
            className="cursor-pointer transition-colors"
            onMouseEnter={() => setHoveredAxis('auth')}
            onMouseLeave={() => setHoveredAxis(null)}
          >
            AUTH CONFLICT {(authorizationConflict * 100).toFixed(0)}%
          </text>

          {/* South: Observed Harm */}
          <text
            x={center}
            y={center + maxRadius + 18}
            textAnchor="middle"
            fill={hoveredAxis === 'harm' ? '#ef8c8c' : '#ece9df'}
            fontSize="9.5"
            fontFamily="var(--font-mono)"
            fontWeight="600"
            className="cursor-pointer transition-colors"
            onMouseEnter={() => setHoveredAxis('harm')}
            onMouseLeave={() => setHoveredAxis(null)}
          >
            HARM {(observedHarm * 100).toFixed(0)}%
          </text>

          {/* West: Evidence Quality */}
          <text
            x={center - maxRadius - 10}
            y={center + 3}
            textAnchor="end"
            fill={hoveredAxis === 'quality' ? '#9cc4d9' : '#ece9df'}
            fontSize="9.5"
            fontFamily="var(--font-mono)"
            fontWeight="600"
            className="cursor-pointer transition-colors"
            onMouseEnter={() => setHoveredAxis('quality')}
            onMouseLeave={() => setHoveredAxis(null)}
          >
            QUALITY {(evidenceQuality * 100).toFixed(0)}%
          </text>
        </svg>
      </div>

      {/* Dynamic Truth-Boundary Explanation Banner */}
      <div className="w-full mt-3 p-2.5 rounded-lg bg-[rgba(14,20,17,0.7)] border border-[rgba(236,233,223,0.08)] text-[11px] font-mono leading-relaxed">
        {hoveredAxis ? (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold" style={{ color: axisDescriptions[hoveredAxis].color }}>
                {axisDescriptions[hoveredAxis].label} &bull; {axisDescriptions[hoveredAxis].value}
              </span>
              <span className="text-[10px] text-[#69756d]">SIGNAL WEIGHTED</span>
            </div>
            <p className="text-[#9ba69e] text-[10.5px]">{axisDescriptions[hoveredAxis].rule}</p>
          </div>
        ) : (
          <div className="flex items-center justify-between text-[#69756d]">
            <span>Hover any axis to inspect forensic weight</span>
            {evidenceQuality < 0.65 ? (
              <span className="text-[#e9ad71] font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#e9ad71] animate-pulse" />
                Abstention Margin Active ({((1 - evidenceQuality) * 100).toFixed(0)}% uncertainty)
              </span>
            ) : (
              <span className="text-[#d8f57b] font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#d8f57b]" />
                Evidence Complete (Certified Connector)
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
