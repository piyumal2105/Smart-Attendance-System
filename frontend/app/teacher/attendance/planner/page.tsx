"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";

const MODULES = [
  { code: "IT3071", name: "Machine Learning and Optimization Methods" },
  { code: "IT3061", name: "Massive Data Processing and Cloud Computing" },
  { code: "IT3041", name: "Information Retrieval and Web Analytics" },
  { code: "IT3021", name: "Data Warehousing and Business Intelligence" },
  { code: "IT3011", name: "Theory and Practices in Statistical Modelling" },
];

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const TIMES = ["08:00–10:00", "09:00–11:00", "11:00–13:00", "14:00–16:00", "16:00–18:00"];

function scoreSlot(day: string, time: string) {
  // Prototype logic (for PP1 demo): mimic patterns
  let score = 70;

  // Fridays evening usually lower
  if (day === "Friday" && (time.includes("16:00") || time.includes("14:00"))) score -= 25;

  // Early morning slightly lower
  if (time.includes("08:00")) score -= 10;

  // Mid-morning often best
  if (time.includes("09:00")) score += 10;

  // Mid-day ok
  if (time.includes("11:00")) score += 2;

  // clamp
  score = Math.max(25, Math.min(95, score));
  return score;
}

export default function SessionPlannerPage() {
  const [moduleCode, setModuleCode] = useState(MODULES[0].code);
  const [day, setDay] = useState(DAYS[1]);
  const [time, setTime] = useState(TIMES[1]);

  const moduleName = useMemo(
    () => MODULES.find((m) => m.code === moduleCode)?.name ?? "",
    [moduleCode]
  );

  const predicted = useMemo(() => scoreSlot(day, time), [day, time]);

  const recommendations = useMemo(() => {
    const all = DAYS.flatMap((d) => TIMES.map((t) => ({ day: d, time: t, score: scoreSlot(d, t) })));
    const best = [...all].sort((a, b) => b.score - a.score).slice(0, 3);
    const avoid = [...all].sort((a, b) => a.score - b.score).slice(0, 3);
    return { best, avoid, all };
  }, []);

  const bars = useMemo(() => {
    // show selected day scores across time slots
    return TIMES.map((t) => ({ time: t, score: scoreSlot(day, t) }));
  }, [day]);

  return (
    <div className="min-h-screen bg-gray-900 p-8 text-white">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarClock className="text-indigo-400" />
            Session Planning Assistant
          </h1>
          <p className="text-gray-400">
          </p>
        </div>

        <Link
          href="/teacher/attendance"
          className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
        >
          <ArrowLeft size={16} />
          Back to Attendance
        </Link>
      </div>

      {/* Controls */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-lg font-semibold mb-4">Plan a Session</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="text-sm text-gray-300">
            Module
            <select
              className="mt-1 w-full rounded-lg bg-gray-900 border border-gray-700 p-2 text-white outline-none"
              value={moduleCode}
              onChange={(e) => setModuleCode(e.target.value)}
            >
              {MODULES.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.code}
                </option>
              ))}
            </select>
            <div className="mt-1 text-xs text-gray-400">{moduleName}</div>
          </label>

          <label className="text-sm text-gray-300">
            Day
            <select
              className="mt-1 w-full rounded-lg bg-gray-900 border border-gray-700 p-2 text-white outline-none"
              value={day}
              onChange={(e) => setDay(e.target.value)}
            >
              {DAYS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-gray-300">
            Time
            <select
              className="mt-1 w-full rounded-lg bg-gray-900 border border-gray-700 p-2 text-white outline-none"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            >
              {TIMES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Predicted */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-sm text-gray-300 flex items-center gap-2">
              <TrendingUp size={16} className="opacity-80" />
              Predicted Attendance
            </div>
            <div className="mt-1 text-4xl font-bold">{predicted}%</div>
            <div className="text-xs text-gray-400 mt-1">
              Based on factor insights (prototype)
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-sm text-gray-300 flex items-center gap-2">
              <CheckCircle2 size={16} className="opacity-80" />
              Suggested Best
            </div>
            <div className="mt-2 space-y-2">
              {recommendations.best.map((b, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
                  <div className="text-sm">{b.day} • {b.time}</div>
                  <div className="text-sm font-semibold text-emerald-300">{b.score}%</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-sm text-gray-300 flex items-center gap-2">
              <AlertTriangle size={16} className="opacity-80" />
              Avoid Times
            </div>
            <div className="mt-2 space-y-2">
              {recommendations.avoid.map((b, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
                  <div className="text-sm">{b.day} • {b.time}</div>
                  <div className="text-sm font-semibold text-yellow-300">{b.score}%</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Simple chart */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="font-semibold">Attendance by Time (Selected Day)</div>
            <div className="text-xs text-gray-400">{day}</div>
          </div>

          <div className="h-36 flex items-end gap-2">
            {bars.map((b) => (
              <div key={b.time} className="w-full">
                <div
                  className="w-full rounded-t bg-white/20"
                  style={{ height: `${b.score}%` }}
                  title={`${b.score}%`}
                />
                <div className="mt-2 text-center text-[11px] text-gray-400">
                  {b.time}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 text-xs text-gray-400">
           
          </div>
        </div>
      </div>
    </div>
  );
}
