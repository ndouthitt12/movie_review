import type { ReactNode } from "react";

export type ChartDatum = {
  label: string;
  value: number;
  detail?: string;
  href?: string;
};

export function BarChart({
  data,
  valueSuffix = "",
  height = 260,
}: {
  data: readonly ChartDatum[];
  valueSuffix?: string;
  height?: number;
}) {
  if (!data.length) return <ChartEmpty />;
  const width = 760;
  const margin = { top: 24, right: 12, bottom: 62, left: 36 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const maximum = Math.max(1, ...data.map(({ value }) => value));
  const slot = innerWidth / data.length;
  const barWidth = Math.max(2, Math.min(42, slot * 0.7));
  const labelStep = Math.max(1, Math.ceil(data.length / 10));
  return (
    <ChartFrame height={height} label="Bar chart">
      <line
        x1={margin.left}
        x2={width - margin.right}
        y1={margin.top + innerHeight}
        y2={margin.top + innerHeight}
        className="stroke-ink-700"
      />
      {data.map((datum, index) => {
        const barHeight = (datum.value / maximum) * innerHeight;
        const x = margin.left + index * slot + (slot - barWidth) / 2;
        const content = (
          <g className={datum.href ? "group cursor-pointer" : undefined}>
            <rect
              x={x}
              y={margin.top + innerHeight - barHeight}
              width={barWidth}
              height={barHeight}
              rx={1}
              className="fill-accent-400 group-hover:fill-positive"
            >
              <title>{`${datum.label}: ${datum.detail ?? `${formatValue(datum.value)}${valueSuffix}`}`}</title>
            </rect>
            {index % labelStep === 0 || data.length <= 12 ? (
              <text
                x={x + barWidth / 2}
                y={height - 34}
                textAnchor="middle"
                className="fill-paper-500 text-[10px]"
              >
                {shortLabel(datum.label)}
              </text>
            ) : null}
            {(data.length <= 12 || index === data.length - 1) &&
            barHeight > 14 ? (
              <text
                x={x + barWidth / 2}
                y={margin.top + innerHeight - barHeight - 6}
                textAnchor="middle"
                className="fill-paper-300 text-[10px] tabular-nums"
              >
                {formatValue(datum.value)}
                {valueSuffix}
              </text>
            ) : null}
          </g>
        );
        return datum.href ? (
          <a
            key={`${datum.label}-${index}`}
            href={datum.href}
            aria-label={`${datum.label}: ${datum.detail ?? datum.value}`}
          >
            {content}
          </a>
        ) : (
          <g key={`${datum.label}-${index}`}>{content}</g>
        );
      })}
    </ChartFrame>
  );
}

export function HistogramChart({
  data,
}: {
  data: readonly {
    label: string;
    count: number;
    expected: number;
    href?: string;
  }[];
}) {
  if (!data.length || data.every(({ count }) => count === 0))
    return <ChartEmpty />;
  const width = 760;
  const height = 270;
  const margin = { top: 28, right: 16, bottom: 52, left: 34 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const maximum = Math.max(
    1,
    ...data.flatMap(({ count, expected }) => [count, expected]),
  );
  const slot = innerWidth / data.length;
  const points = data
    .map(({ expected }, index) => {
      const x = margin.left + index * slot + slot / 2;
      const y = margin.top + innerHeight - (expected / maximum) * innerHeight;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <ChartFrame height={height} label="Overall rating distribution histogram">
      <text x={margin.left} y={13} className="fill-accent-300 text-[10px]">
        Actual bars
      </text>
      <text x={margin.left + 78} y={13} className="fill-sky text-[10px]">
        Expected curve
      </text>
      {data.map((datum, index) => {
        const barHeight = (datum.count / maximum) * innerHeight;
        const barWidth = Math.max(2, slot - 3);
        const content = (
          <g className={datum.href ? "group cursor-pointer" : undefined}>
            <rect
              x={margin.left + index * slot + 1.5}
              y={margin.top + innerHeight - barHeight}
              width={barWidth}
              height={barHeight}
              className="fill-accent-400 group-hover:fill-positive"
            >
              <title>{`${datum.label}: ${datum.count} actual, ${datum.expected.toFixed(1)} expected`}</title>
            </rect>
            {index % 4 === 0 ? (
              <text
                x={margin.left + index * slot + slot / 2}
                y={height - 26}
                textAnchor="middle"
                className="fill-paper-500 text-[9px]"
              >
                {datum.label.split("–")[0]}
              </text>
            ) : null}
          </g>
        );
        return datum.href ? (
          <a
            key={datum.label}
            href={datum.href}
            aria-label={`${datum.label}: ${datum.count} ratings`}
          >
            {content}
          </a>
        ) : (
          <g key={datum.label}>{content}</g>
        );
      })}
      <polyline
        points={points}
        fill="none"
        className="stroke-sky"
        strokeWidth={2}
      />
      {data.map((datum, index) => {
        const [x, y] = points.split(" ")[index].split(",").map(Number);
        return (
          <circle
            key={datum.label}
            cx={x}
            cy={y}
            r={2.2}
            className="fill-sky"
          />
        );
      })}
    </ChartFrame>
  );
}

export function TrendChart({
  data,
}: {
  data: readonly { period: string; count: number; rollingAverage: number }[];
}) {
  if (!data.length) return <ChartEmpty />;
  const width = 760;
  const height = 270;
  const margin = { top: 28, right: 16, bottom: 52, left: 34 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const maximum = Math.max(
    1,
    ...data.flatMap(({ count, rollingAverage }) => [count, rollingAverage]),
  );
  const slot = innerWidth / data.length;
  const points = data
    .map(
      ({ rollingAverage }, index) =>
        `${margin.left + index * slot + slot / 2},${margin.top + innerHeight - (rollingAverage / maximum) * innerHeight}`,
    )
    .join(" ");
  const labelStep = Math.max(1, Math.ceil(data.length / 8));
  return (
    <ChartFrame
      height={height}
      label="Monthly watches with trailing rolling average"
    >
      <text x={margin.left} y={13} className="fill-accent-300 text-[10px]">
        Watches
      </text>
      <text x={margin.left + 56} y={13} className="fill-sky text-[10px]">
        3-month average
      </text>
      {data.map((datum, index) => {
        const barHeight = (datum.count / maximum) * innerHeight;
        return (
          <g key={datum.period}>
            <rect
              x={margin.left + index * slot + slot * 0.15}
              y={margin.top + innerHeight - barHeight}
              width={Math.max(2, slot * 0.7)}
              height={barHeight}
              className="fill-accent-400"
            >
              <title>{`${datum.period}: ${datum.count} watches; ${datum.rollingAverage.toFixed(1)} rolling average`}</title>
            </rect>
            {index % labelStep === 0 ? (
              <text
                x={margin.left + index * slot + slot / 2}
                y={height - 25}
                textAnchor="middle"
                className="fill-paper-500 text-[9px]"
              >
                {datum.period}
              </text>
            ) : null}
          </g>
        );
      })}
      <polyline
        points={points}
        fill="none"
        className="stroke-sky"
        strokeWidth={2}
      />
    </ChartFrame>
  );
}

export function RadarChart({ data }: { data: readonly ChartDatum[] }) {
  if (
    !data.length ||
    data.every(({ value }) => !Number.isFinite(value) || value === 0)
  )
    return <ChartEmpty />;
  const width = 520;
  const height = 380;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = 125;
  const point = (index: number, value: number) => {
    const angle = (index / data.length) * Math.PI * 2 - Math.PI / 2;
    return [
      centerX + Math.cos(angle) * radius * value,
      centerY + Math.sin(angle) * radius * value,
    ];
  };
  const polygon = data
    .map(({ value }, index) =>
      point(index, Math.max(0, Math.min(100, value)) / 100).join(","),
    )
    .join(" ");
  return (
    <ChartFrame
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      label="Average attribute profile radar chart"
    >
      {[0.25, 0.5, 0.75, 1].map((level) => (
        <polygon
          key={level}
          points={data
            .map((_, index) => point(index, level).join(","))
            .join(" ")}
          fill="none"
          className="stroke-ink-700"
        />
      ))}
      {data.map((datum, index) => {
        const [x, y] = point(index, 1.18);
        return (
          <g key={datum.label}>
            <line
              x1={centerX}
              y1={centerY}
              x2={point(index, 1)[0]}
              y2={point(index, 1)[1]}
              className="stroke-ink-700"
            />
            <text
              x={x}
              y={y}
              textAnchor={
                x < centerX - 20 ? "end" : x > centerX + 20 ? "start" : "middle"
              }
              className="fill-paper-300 text-[10px]"
            >
              {datum.label} {datum.value.toFixed(0)}
            </text>
          </g>
        );
      })}
      <polygon
        points={polygon}
        className="fill-accent-400/20 stroke-accent-300"
        strokeWidth={2}
      />
    </ChartFrame>
  );
}

export function Sparkline({
  values,
  label,
}: {
  values: readonly number[];
  label: string;
}) {
  if (!values.length) return null;
  const width = 180;
  const height = 42;
  const maximum = Math.max(1, ...values);
  const points = values
    .map(
      (value, index) =>
        `${(index / Math.max(1, values.length - 1)) * width},${height - (value / maximum) * (height - 4) - 2}`,
    )
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
      className="h-11 w-full"
    >
      <polyline
        points={points}
        fill="none"
        className="stroke-accent-300"
        strokeWidth={2}
      />
    </svg>
  );
}

export type HeatmapDatum = { date: string; count: number; label: string };

export function HeatmapCellGrid({
  year,
  data,
}: {
  year: number;
  data: readonly HeatmapDatum[];
}) {
  const height = 132;
  const left = 25;
  const top = 20;
  const cell = 11;
  const gap = 2;
  const firstDay = new Date(Date.UTC(year, 0, 1));
  const offset = (firstDay.getUTCDay() + 6) % 7;
  const maximum = Math.max(1, ...data.map(({ count }) => count));
  return (
    <ChartFrame height={height} label={`Watch calendar for ${year}`}>
      {["M", "W", "F"].map((day, index) => (
        <text
          key={day}
          x={1}
          y={top + (index * 2 + 1) * (cell + gap) + 8}
          className="fill-paper-500 text-[8px]"
        >
          {day}
        </text>
      ))}
      {data.map((datum, index) => {
        const gridIndex = offset + index;
        const week = Math.floor(gridIndex / 7);
        const day = gridIndex % 7;
        return (
          <rect
            key={datum.date}
            x={left + week * (cell + gap)}
            y={top + day * (cell + gap)}
            width={cell}
            height={cell}
            rx={1}
            className={heatClass(datum.count, maximum)}
          >
            <title>{datum.label}</title>
          </rect>
        );
      })}
    </ChartFrame>
  );
}

function ChartFrame({
  children,
  height,
  label,
  viewBox = `0 0 760 ${height}`,
}: {
  children: ReactNode;
  height: number;
  label: string;
  viewBox?: string;
}) {
  return (
    <svg
      viewBox={viewBox}
      role="img"
      aria-label={label}
      className="h-auto w-full overflow-visible"
    >
      {children}
    </svg>
  );
}

function ChartEmpty() {
  return (
    <div className="border-hairline text-paper-500 flex min-h-48 items-center justify-center border border-dashed text-sm">
      No data yet
    </div>
  );
}

function formatValue(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function shortLabel(value: string) {
  return value.length > 11 ? `${value.slice(0, 10)}…` : value;
}

function heatClass(count: number, maximum: number) {
  if (count === 0) return "fill-ink-850 stroke-ink-800";
  const ratio = count / maximum;
  if (ratio <= 0.34) return "fill-accent-500 stroke-accent-500";
  if (ratio <= 0.67) return "fill-accent-400 stroke-accent-400";
  return "fill-accent-200 stroke-accent-200";
}
