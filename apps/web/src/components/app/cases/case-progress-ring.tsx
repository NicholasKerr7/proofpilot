import { useId } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import styles from "./case-progress-ring.module.css";

const orbParticles = Array.from({ length: 11 }, (_, index) => index);

interface CaseProgressRingProps {
  className?: string;
  label?: string;
  size?: "compact" | "default" | "responsive";
  value: number;
}

export function CaseProgressRing({
  className,
  label = "Progress",
  size = "default",
  value
}: CaseProgressRingProps) {
  const safeValue = Math.min(100, Math.max(0, Math.round(value)));
  const isComplete = safeValue === 100;
  const svgId = useId().replaceAll(":", "");

  return (
    <div
      aria-label={`${label}: ${safeValue}%`}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={safeValue}
      className={cn(
        "proof-progress-orb",
        styles.orb,
        isComplete ? styles.complete : styles.progress,
        size === "compact"
          ? styles.compact
          : size === "responsive"
            ? styles.responsive
            : styles.default,
        className
      )}
      role="progressbar"
    >
      <span className={styles.atmosphere} aria-hidden="true" />
      <span className={styles.innerAura} aria-hidden="true" />
      <span className={styles.particles} aria-hidden="true">
        {orbParticles.map((particle) => (
          <span className={styles.particle} key={particle} />
        ))}
      </span>
      <span className={styles.core} aria-hidden="true" />
      <span className={styles.coreInner} aria-hidden="true" />

      {isComplete ? (
        <CompleteOrbRings svgId={svgId} />
      ) : (
        <ProgressOrbRings safeValue={safeValue} svgId={svgId} />
      )}

      <span className={styles.readout}>
        {isComplete ? (
          <span className={styles.completeMark} aria-hidden="true">
            <Check className={styles.completeCheck} strokeWidth={3} />
          </span>
        ) : null}
        <span className={styles.valueLine}>
          <span className={styles.value}>{safeValue}</span>
          <span className={styles.percent}>%</span>
        </span>
        <span className={styles.valueLabel}>{isComplete ? "Complete" : label}</span>
      </span>
    </div>
  );
}

function ProgressOrbRings({ safeValue, svgId }: { safeValue: number; svgId: string }) {
  const gradientId = `progress-gradient-${svgId}`;
  const glowId = `progress-glow-${svgId}`;
  const highlightValue = Math.max(0, safeValue - 1.5);
  const endpointAngle = (safeValue / 100) * Math.PI * 2;
  const endpointX = 110 + Math.cos(endpointAngle) * 83;
  const endpointY = 110 + Math.sin(endpointAngle) * 83;

  return (
    <svg
      className={styles.rings}
      viewBox="0 0 220 220"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="22" y1="170" x2="188" y2="28">
          <stop offset="0%" stopColor="#ff6b00" />
          <stop offset="52%" stopColor="#ff850e" />
          <stop offset="100%" stopColor="#ffb13d" />
        </linearGradient>
        <filter id={glowId} x="-70%" y="-70%" width="240%" height="240%">
          <feGaussianBlur stdDeviation="4.2" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="1 0 0 0 0.95  0 0.55 0 0 0.26  0 0 0.12 0 0  0 0 0 0.82 0"
            result="orangeBlur"
          />
          <feMerge>
            <feMergeNode in="orangeBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle
        cx="110"
        cy="110"
        r="83"
        fill="none"
        stroke="#2b1f14"
        strokeWidth="13"
        strokeLinecap="round"
        opacity="0.94"
      />
      <circle
        cx="110"
        cy="110"
        r="96"
        fill="none"
        stroke="#2a1b10"
        strokeWidth="2"
        opacity="0.34"
      />
      {safeValue > 0 ? (
        <>
          <circle
            cx="193"
            cy="110"
            r="10"
            fill="#ff7a00"
            opacity="0.42"
            filter={`url(#${glowId})`}
          />
          <circle
            cx={endpointX}
            cy={endpointY}
            r="10"
            fill="#ff7600"
            opacity="0.42"
            filter={`url(#${glowId})`}
          />
        </>
      ) : null}
      <circle
        cx="110"
        cy="110"
        r="83"
        fill="none"
        stroke="#ff6a00"
        strokeWidth="20"
        strokeLinecap="round"
        pathLength="100"
        strokeDasharray={`${safeValue} 100`}
        opacity="0.18"
        filter={`url(#${glowId})`}
      />
      <circle
        cx="110"
        cy="110"
        r="83"
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="11"
        strokeLinecap="round"
        pathLength="100"
        strokeDasharray={`${safeValue} 100`}
        filter={`url(#${glowId})`}
      />
      <circle
        cx="110"
        cy="110"
        r="77"
        fill="none"
        stroke="#ffa12a"
        strokeWidth="2"
        strokeLinecap="round"
        pathLength="100"
        strokeDasharray={`${highlightValue} 100`}
        strokeDashoffset="0.75"
        opacity="0.74"
      />
      <circle
        cx="110"
        cy="110"
        r="66"
        fill="none"
        stroke="#05080a"
        strokeWidth="3"
        opacity="0.8"
      />
    </svg>
  );
}

function CompleteOrbRings({ svgId }: { svgId: string }) {
  const gradientId = `complete-gradient-${svgId}`;
  const glowId = `complete-glow-${svgId}`;
  const sheenId = `complete-sheen-${svgId}`;

  return (
    <svg
      className={styles.rings}
      viewBox="0 0 240 240"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="32" y1="190" x2="206" y2="38">
          <stop offset="0%" stopColor="#6fe22e" />
          <stop offset="48%" stopColor="#84f33b" />
          <stop offset="100%" stopColor="#bcff63" />
        </linearGradient>
        <linearGradient id={sheenId} x1="64" y1="24" x2="206" y2="174">
          <stop offset="0%" stopColor="#f3ffdc" stopOpacity="0.95" />
          <stop offset="42%" stopColor="#d0ff8a" stopOpacity="0.56" />
          <stop offset="100%" stopColor="#83ef3a" stopOpacity="0" />
        </linearGradient>
        <filter id={glowId} x="-70%" y="-70%" width="240%" height="240%">
          <feGaussianBlur stdDeviation="4.5" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="0.42 0 0 0 0.13  0 1 0 0 0.95  0 0 0.28 0 0.06  0 0 0 0.9 0"
            result="greenGlow"
          />
          <feMerge>
            <feMergeNode in="greenGlow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle
        cx="120"
        cy="120"
        r="91"
        fill="none"
        stroke="#152514"
        strokeWidth="14"
        strokeLinecap="round"
        opacity="0.95"
      />
      <circle
        cx="120"
        cy="120"
        r="91"
        fill="none"
        stroke="#82f23b"
        strokeWidth="21"
        strokeLinecap="round"
        opacity="0.2"
        filter={`url(#${glowId})`}
      />
      <circle
        cx="120"
        cy="120"
        r="91"
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="13"
        strokeLinecap="round"
        filter={`url(#${glowId})`}
      />
      <circle
        cx="120"
        cy="120"
        r="87"
        fill="none"
        stroke={`url(#${sheenId})`}
        strokeWidth="2.25"
        strokeLinecap="round"
        pathLength="100"
        strokeDasharray="19 81"
        strokeDashoffset="94"
        opacity="0.82"
      />
      <circle
        cx="120"
        cy="120"
        r="91"
        fill="none"
        stroke="#162914"
        strokeWidth="15"
        strokeLinecap="round"
        pathLength="100"
        strokeDasharray="6 94"
        strokeDashoffset="90"
        opacity="0.85"
      />
      <circle
        cx="120"
        cy="120"
        r="91"
        fill="none"
        stroke="#b8ff5a"
        strokeWidth="13"
        strokeLinecap="round"
        pathLength="100"
        strokeDasharray="3.5 96.5"
        strokeDashoffset="88.8"
        filter={`url(#${glowId})`}
      />
      <circle
        cx="120"
        cy="120"
        r="84"
        fill="none"
        stroke="#baff63"
        strokeWidth="2"
        opacity="0.55"
      />
      <circle
        cx="120"
        cy="120"
        r="72"
        fill="none"
        stroke="#05080a"
        strokeWidth="3"
        opacity="0.82"
      />
      <circle
        cx="120"
        cy="120"
        r="103"
        fill="none"
        stroke="#6cff26"
        strokeWidth="1"
        opacity="0.13"
      />
      <circle
        cx="205.5"
        cy="151"
        r="2.4"
        fill="#efffd5"
        opacity="0.84"
        filter={`url(#${glowId})`}
      />
    </svg>
  );
}
