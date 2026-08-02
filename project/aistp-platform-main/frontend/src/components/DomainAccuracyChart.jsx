import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const WEAK_THRESHOLD = 60;
const COLOR_OK = "#16a34a"; // green-600 -- reads as "good" alongside the red weak-domain flag
const COLOR_WEAK = "#dc2626"; // red-600 -- flags domains below the weak threshold (FR-05 weakest domains)

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { domain, accuracy_percent: accuracy, correct_count: correct, total_count: total } = payload[0].payload;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-md">
      <p className="font-medium text-gray-900">{domain}</p>
      <p className="text-gray-600">
        {accuracy}% correct ({correct}/{total})
      </p>
    </div>
  );
}

export default function DomainAccuracyChart({ domains }) {
  if (!domains?.length) {
    return (
      <div className="flex h-72 items-center justify-center text-sm text-gray-400">
        No domain data yet — complete a practice session to see this chart.
      </div>
    );
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={288}>
        <BarChart data={domains} margin={{ top: 16, right: 8, left: -16, bottom: 32 }}>
          <CartesianGrid vertical={false} stroke="#e5e7eb" />
          <XAxis
            dataKey="domain"
            tick={{ fontSize: 11, fill: "#6b7280" }}
            angle={-25}
            textAnchor="end"
            interval={0}
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
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f9fafb" }} />
          <Bar dataKey="accuracy_percent" radius={[4, 4, 0, 0]} maxBarSize={48}>
            {domains.map((entry) => (
              <Cell key={entry.domain} fill={entry.accuracy_percent < WEAK_THRESHOLD ? COLOR_WEAK : COLOR_OK} />
            ))}
            <LabelList
              dataKey="accuracy_percent"
              position="top"
              formatter={(v) => `${v}%`}
              style={{ fontSize: 11, fill: "#374151" }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLOR_OK }} />
          On target (≥{WEAK_THRESHOLD}%)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLOR_WEAK }} />
          Needs practice
        </span>
      </div>
    </div>
  );
}
