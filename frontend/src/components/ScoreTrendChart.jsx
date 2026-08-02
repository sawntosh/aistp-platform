import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const LINE_COLOR = "#4f46e5"; // indigo-600 -- keeps the trend line on-brand with the rest of the app

function formatSessionDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { started_at: startedAt, accuracy_percent: accuracy, score, question_count: questionCount } = payload[0].payload;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-md">
      <p className="font-medium text-gray-900">{formatSessionDate(startedAt)}</p>
      <p className="text-gray-600">
        {accuracy}% accuracy · {score}/{questionCount} correct
      </p>
    </div>
  );
}

export default function ScoreTrendChart({ sessions }) {
  const completed = sessions?.filter((s) => s.finished_at) ?? [];

  if (completed.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center text-sm text-gray-400">
        No completed sessions yet — your accuracy trend will appear here.
      </div>
    );
  }

  const data = [...completed]
    .sort((a, b) => new Date(a.started_at) - new Date(b.started_at))
    .map((s, i) => ({ ...s, sessionLabel: `#${i + 1}` }));

  return (
    <ResponsiveContainer width="100%" height={288}>
      <AreaChart data={data} margin={{ top: 16, right: 16, left: -16, bottom: 8 }}>
        <defs>
          <linearGradient id="scoreTrendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={LINE_COLOR} stopOpacity={0.35} />
            <stop offset="100%" stopColor={LINE_COLOR} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="#e5e7eb" />
        <XAxis
          dataKey="sessionLabel"
          tick={{ fontSize: 11, fill: "#6b7280" }}
          axisLine={{ stroke: "#d1d5db" }}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 11, fill: "#6b7280" }}
          tickFormatter={(v) => `${v}%`}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#d1d5db", strokeDasharray: 4 }} />
        <Area
          type="monotone"
          dataKey="accuracy_percent"
          stroke={LINE_COLOR}
          strokeWidth={2}
          fill="url(#scoreTrendFill)"
          dot={{ r: 4, fill: LINE_COLOR, strokeWidth: 0 }}
          activeDot={{ r: 6 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
