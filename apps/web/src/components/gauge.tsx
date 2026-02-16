'use client';

interface GaugeProps {
  value: number;
  label: string;
  color: string;
}

export function Gauge({ value, label, color }: GaugeProps) {
  const clampedValue = Math.max(0, Math.min(100, value));
  const radius = 40;
  const strokeWidth = 8;
  const cx = 50;
  const cy = 50;
  const startAngle = Math.PI;
  const endAngle = 0;
  const sweep = startAngle - endAngle;
  const filledAngle = startAngle - (clampedValue / 100) * sweep;

  const describeArc = (startA: number, endA: number) => {
    const x1 = cx + radius * Math.cos(startA);
    const y1 = cy - radius * Math.sin(startA);
    const x2 = cx + radius * Math.cos(endA);
    const y2 = cy - radius * Math.sin(endA);
    const largeArc = Math.abs(startA - endA) > Math.PI ? 1 : 0;
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 0 ${x2} ${y2}`;
  };

  return (
    <div className="flex flex-col items-center">
      <svg width="80" height="55" viewBox="0 0 100 65">
        {/* Background arc */}
        <path
          d={describeArc(startAngle, endAngle)}
          fill="none"
          stroke="currentColor"
          className="text-border/30"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Filled arc with glow */}
        {clampedValue > 0 && (
          <>
            <path
              d={describeArc(startAngle, filledAngle)}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 6px ${color}40)` }}
            />
          </>
        )}
        {/* Value text */}
        <text
          x={cx}
          y={cy - 2}
          textAnchor="middle"
          className="fill-foreground text-sm font-bold"
          fontSize="14"
        >
          {clampedValue}%
        </text>
      </svg>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
    </div>
  );
}
