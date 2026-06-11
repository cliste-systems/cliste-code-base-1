import type { CallActivityPoint } from "@/lib/dashboard-call-activity-series";

const VIEW_W = 720;
const VIEW_H = 248;
const PAD = { top: 16, right: 14, bottom: 34, left: 38 };

function labelStep(count: number): number {
  if (count <= 8) return 1;
  if (count <= 14) return 2;
  return Math.ceil(count / 6);
}

export function DashboardCallVolumeChart({
  points,
}: {
  points: CallActivityPoint[];
}) {
  const innerW = VIEW_W - PAD.left - PAD.right;
  const innerH = VIEW_H - PAD.top - PAD.bottom;
  const maxY = Math.max(1, ...points.map((p) => p.callsAnswered));
  const gridLines = 3;
  const step = labelStep(points.length);
  const slotW = points.length > 0 ? innerW / points.length : innerW;
  const barW = Math.min(Math.max(slotW * 0.55, 8), points.length <= 8 ? 40 : 26);
  const barRx = 4;

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Call volume bar chart"
      className="block overflow-visible"
      shapeRendering="geometricPrecision"
    >
      {Array.from({ length: gridLines + 1 }, (_, i) => {
        const y = PAD.top + (i / gridLines) * innerH;
        return (
          <line
            key={i}
            x1={PAD.left}
            y1={y}
            x2={PAD.left + innerW}
            y2={y}
            stroke="#eef2f6"
            strokeWidth={1}
          />
        );
      })}

      {[0, maxY].map((tick) => (
        <text
          key={tick}
          x={PAD.left - 6}
          y={PAD.top + innerH - (tick / maxY) * innerH + 3.5}
          textAnchor="end"
          fill="#94a3b8"
          fontSize={12}
          fontFamily="ui-sans-serif, system-ui, sans-serif"
        >
          {tick}
        </text>
      ))}

      {points.map((point, index) => {
        if (point.callsAnswered <= 0) return null;
        const barHeight = Math.max(2, (point.callsAnswered / maxY) * innerH);
        const x = PAD.left + index * slotW + (slotW - barW) / 2;
        const y = PAD.top + innerH - barHeight;
        return (
          <rect
            key={point.key}
            x={x}
            y={y}
            width={barW}
            height={barHeight}
            rx={barRx}
            fill="#0b1220"
            opacity={0.88}
          />
        );
      })}

      {points.map((point, index) => {
        if (index % step !== 0 && index !== points.length - 1) return null;
        const x = PAD.left + index * slotW + slotW / 2;
        return (
          <text
            key={`${point.key}-label`}
            x={x}
            y={VIEW_H - 8}
            textAnchor="middle"
            fill="#94a3b8"
            fontSize={12}
            fontFamily="ui-sans-serif, system-ui, sans-serif"
          >
            {point.label}
          </text>
        );
      })}
    </svg>
  );
}
