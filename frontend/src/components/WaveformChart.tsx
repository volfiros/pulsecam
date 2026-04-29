import { useId } from "react";
import { AreaChart, Area, YAxis, ResponsiveContainer } from "recharts";

interface WaveformChartProps {
  data: number[];
}

export default function WaveformChart({ data }: WaveformChartProps) {
  const gradientId = useId();
  const chartData = data.map((value, index) => ({ index, value }));

  return (
    <div className="w-full h-32 opacity-80">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.6} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis domain={["auto", "auto"]} hide />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#10b981"
            strokeWidth={1.5}
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
