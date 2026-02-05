"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Search,
  Download,
  AlertTriangle,
  TrendingUp,
  Users,
  Clock,
  RefreshCw,
  CalendarClock,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

/** ---------------- Types ---------------- */
type SessionRes = {
  session_id: string;
  module_code: string;
  module_name: string;
  year: string;
  faculty: string;
  batch: string;
  start_time: string;
  end_time: string;
  hours: number;
  location: string;

  pin: string;
  pin_expires_at: string;
  max_students: number;
  remaining_slots: number;
  regen_left: number;
};

type SessionDetailRes = SessionRes & {
  attendance_count: number;
  attendance: {
    student_id: string;
    student_name?: string;
    selfie_base64?: string;
    marked_at: string;
  }[];
};

/** ---------------- Data ---------------- */
const MODULES = [
  { code: "IT3071", name: "Machine Learning and Optimization Methods" },
  { code: "IT3061", name: "Massive Data Processing and Cloud Computing" },
  { code: "IT3041", name: "Information Retrieval and Web Analytics" },
  { code: "IT3021", name: "Data Warehousing and Business Intelligence" },
  { code: "IT3011", name: "Theory and Practices in Statistical Modelling" },
  { code: "IT4010", name: "Research Project (Comprehensive Design and Analysis Project)" },
  { code: "IT4030", name: "Internet of Things" },
  { code: "IT4041", name: "Introduction to Information Security Analytics" },
  { code: "IT4011", name: "Database Administration and Storage Systems" },
  { code: "IT4031", name: "Visual Analytics and User Experience Design" },
];

// sample roster (UI demo only)
const ROSTER: { student_id: string; student_name: string }[] = [
  { student_id: "IT20230012", student_name: "Chamika Deemantha" },
  { student_id: "IT20230018", student_name: "Sahan Jayasinghe" },
  { student_id: "IT20230021", student_name: "Isuru Bandara" },
  { student_id: "IT20230029", student_name: "Nethmi Sewwandi" },
  { student_id: "IT20230033", student_name: "Dulani Perera" },
  { student_id: "IT20230044", student_name: "Tharindu Lakshan" },
  { student_id: "IT20230051", student_name: "Kasun Madushanka" },
  { student_id: "IT20230063", student_name: "Dinithi Abeysekara" },
  { student_id: "IT20230077", student_name: "Harsha Wijesinghe" },
  { student_id: "IT20230084", student_name: "Pavithra Fernando" },
  { student_id: "IT20230091", student_name: "Shehan Pathirana" },
  { student_id: "IT20230103", student_name: "Himali Rathnayake" },
];

function formatDT(dt: string) {
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return dt;
  }
}

/** ---------------- Page ---------------- */
export default function AttendancePage() {
  // setup
  const [moduleCode, setModuleCode] = useState(MODULES[0].code);
  const moduleName = useMemo(
    () => MODULES.find((m) => m.code === moduleCode)?.name ?? "",
    [moduleCode]
  );

  const [year, setYear] = useState("2025");
  const [faculty, setFaculty] = useState("Computing");
  const [batch, setBatch] = useState("Batch 20");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [hours, setHours] = useState(2);
  const [location, setLocation] = useState("Lab 01");
  const [maxStudents, setMaxStudents] = useState(60);
  const [expiryMinutes, setExpiryMinutes] = useState(10);
  const [regenLimit, setRegenLimit] = useState(3);

  // sessions
  const [savedSessions, setSavedSessions] = useState<SessionRes[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const [session, setSession] = useState<SessionRes | null>(null);
  const [detail, setDetail] = useState<SessionDetailRes | null>(null);

  // ui
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pollOn, setPollOn] = useState(false);
  const [search, setSearch] = useState("");

  // trend chart
  const [liveCounts, setLiveCounts] = useState<number[]>([]);
  const lastCountRef = useRef<number>(0);

  async function createSession() {
    setLoading(true);
    setMsg(null);

    try {
      const res = await fetch(`${API}/api/attendance/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module_code: moduleCode,
          module_name: moduleName,
          year,
          faculty,
          batch,
          start_time: startTime || "now",
          end_time: endTime || "later",
          hours,
          location,
          max_students: maxStudents,
          expiry_minutes: expiryMinutes,
          regen_limit: regenLimit,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any)?.detail || `Failed to create session (${res.status})`);

      setSession(data as SessionRes);
      setActiveSessionId((data as SessionRes).session_id);
      setPollOn(true);
      setLiveCounts([]);

      setSavedSessions((prev) => {
        const exists = prev.some((s) => s.session_id === (data as SessionRes).session_id);
        if (exists) return prev;
        return [data as SessionRes, ...prev].slice(0, 8);
      });

      await loadDetail((data as SessionRes).session_id);
    } catch (e: any) {
      // This helps when browser shows "Failed to fetch"
      setMsg(e?.message || "Failed to fetch. Check backend is running on http://localhost:8000 and CORS is enabled.");
    } finally {
      setLoading(false);
    }
  }

  async function switchSession(sessionId: string) {
    const found = savedSessions.find((s) => s.session_id === sessionId);
    if (!found) return;

    setMsg(null);
    setSession(found);
    setActiveSessionId(found.session_id);
    setPollOn(true);
    setLiveCounts([]);
    await loadDetail(found.session_id);
  }

  async function regeneratePin() {
    if (!session) return;

    setMsg(null);
    try {
      const res = await fetch(`${API}/api/attendance/sessions/${session.session_id}/regenerate-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expiry_minutes: expiryMinutes }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any)?.detail || `Failed to regenerate PIN (${res.status})`);

      setSession(data as SessionRes);
      setSavedSessions((prev) => prev.map((s) => (s.session_id === (data as SessionRes).session_id ? (data as SessionRes) : s)));
    } catch (e: any) {
      setMsg(e?.message || "Error");
    }
  }

  async function loadDetail(forcedSessionId?: string) {
    const sid = forcedSessionId || session?.session_id;
    if (!sid) return;

    const res = await fetch(`${API}/api/attendance/sessions/${sid}`);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setMsg((data as any)?.detail || `Request failed (${res.status})`);
      return;
    }

    setDetail(data as SessionDetailRes);

    const countNow = Number((data as any)?.attendance_count ?? 0);
    if (countNow !== lastCountRef.current) {
      lastCountRef.current = countNow;
      setLiveCounts((prev) => [...prev, countNow].slice(-12));
    }
  }

  useEffect(() => {
    if (!pollOn || !session) return;
    loadDetail();
    const t = setInterval(() => loadDetail(), 2000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollOn, session?.session_id]);

  const expiresIn = useMemo(() => {
    if (!session) return null;
    const exp = new Date(session.pin_expires_at).getTime();
    const diff = Math.max(0, exp - Date.now());
    return Math.ceil(diff / 1000);
  }, [session, detail]);

  const presentMap = useMemo(() => {
    const map = new Map<string, { marked_at: string; selfie_base64?: string }>();
    for (const a of detail?.attendance ?? []) {
      map.set(a.student_id, { marked_at: a.marked_at, selfie_base64: a.selfie_base64 });
    }
    return map;
  }, [detail]);

  const presentCount = detail?.attendance_count ?? 0;

  const remainingSlots = useMemo(() => {
    return detail?.remaining_slots ?? session?.remaining_slots ?? 0;
  }, [detail, session]);

  const absentStudents = useMemo(() => {
    return ROSTER.filter((s) => !presentMap.has(s.student_id));
  }, [presentMap]);

  const filteredRoster = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ROSTER;
    return ROSTER.filter(
      (s) => s.student_id.toLowerCase().includes(q) || s.student_name.toLowerCase().includes(q)
    );
  }, [search]);

  const weeklyTrend = useMemo(() => {
    const base = 40 + (moduleCode.charCodeAt(moduleCode.length - 1) % 15);
    const arr = [base, base + 5, base + 2, base + 10, base + 6, base + 12, base + 8];
    const day = new Date().getDay(); // 0 Sun
    const idx = day === 0 ? 6 : day - 1; // Mon=0
    arr[idx] = Math.max(10, Math.min(100, Math.round((presentCount / Math.max(1, maxStudents)) * 100)));
    return arr;
  }, [moduleCode, presentCount, maxStudents]);

  function exportCSV() {
    const rows = ROSTER.map((s) => {
      const present = presentMap.has(s.student_id);
      const mark = present ? presentMap.get(s.student_id)!.marked_at : "";
      return {
        student_id: s.student_id,
        student_name: s.student_name,
        status: present ? "PRESENT" : "ABSENT",
        marked_at: mark ? formatDT(mark) : "",
        module_code: session?.module_code ?? "",
        module_name: session?.module_name ?? "",
        batch,
        faculty,
        year,
      };
    });

    const headers = Object.keys(rows[0] || {});
    const csv =
      headers.join(",") +
      "\n" +
      rows
        .map((r) => headers.map((h) => `"${String((r as any)[h] ?? "").replaceAll('"', '""')}"`).join(","))
        .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance_${session?.module_code ?? "module"}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white overflow-hidden">
      {/* Sticky Header */}
      <header className="h-16 bg-gray-800/50 backdrop-blur border-b border-gray-700 flex items-center justify-between px-8 sticky top-0 z-10 shrink-0">
        <h2 className="text-lg font-semibold text-gray-200">
          Student Attendance
        </h2>
        <div className="flex items-center gap-4">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-sm text-emerald-400">System Online</span>
        </div>
      </header>

      {/* Main Scrollable Content */}
      <main className="flex-1 overflow-auto p-8">
        <div className="mb-6 flex flex-col gap-3">
          <div className="flex items-start justify-end gap-4">
            {/* Controls moved to align right, removed duplicate H1 */}
            <div className="flex items-center gap-3">
              {savedSessions.length > 0 && (
                <select
                  className="rounded-lg bg-gray-900 border border-gray-700 px-3 py-2 text-sm outline-none"
                  value={activeSessionId ?? ""}
                  onChange={(e) => switchSession(e.target.value)}
                >
                  <option value="" disabled>
                    Switch session...
                  </option>
                  {savedSessions.map((s) => (
                    <option key={s.session_id} value={s.session_id}>
                      {s.module_code} • {s.batch} • {new Date(s.pin_expires_at).toLocaleTimeString()}
                    </option>
                  ))}
                </select>
              )}

              <Link
                href="/teacher/attendance/planner"
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold hover:bg-indigo-500"
                title="Prototype: predicts best time slots for higher attendance"
              >
                <CalendarClock size={16} />
                Session Planner
              </Link>

              <button
                onClick={() => loadDetail()}
                className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
              >
                <RefreshCw size={16} />
                Refresh
              </button>

              <button
                onClick={exportCSV}
                disabled={!session}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold hover:bg-emerald-500 disabled:opacity-50"
                title={!session ? "Create or select a session first" : "Download CSV report"}
              >
                <Download size={16} />
                Export CSV
              </button>
            </div>
          </div>

          {msg && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-200">
              {msg}
            </div>
          )}

          {/* Stats row */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm text-gray-300 flex items-center gap-2">
                <Users size={16} className="opacity-80" />
                Today Check-ins
              </div>
              <div className="mt-1 text-3xl font-bold">{presentCount}</div>
              <div className="text-xs text-gray-400 mt-1">Out of {maxStudents} students</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm text-gray-300 flex items-center gap-2">
                <Clock size={16} className="opacity-80" />
                PIN Expires In
              </div>
              <div className="mt-1 text-3xl font-bold">{session ? `${expiresIn ?? "-"}s` : "-"}</div>
              <div className="text-xs text-gray-400 mt-1">Remaining slots: {session ? remainingSlots : "-"}</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm text-gray-300 flex items-center gap-2">
                <AlertTriangle size={16} className="opacity-80" />
                Absent Students
              </div>
              <div className="mt-1 text-3xl font-bold">{session ? absentStudents.length : "-"}</div>
              <div className="text-xs text-gray-400 mt-1">From sample roster</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm text-gray-300 flex items-center gap-2">
                <TrendingUp size={16} className="opacity-80" />
                Live Trend
              </div>
              <div className="mt-2 flex items-end gap-1 h-10">
                {(liveCounts.length ? liveCounts : [0, 0, 0, 0]).map((v, i) => (
                  <div
                    key={i}
                    className="w-full rounded-t bg-white/20"
                    style={{ height: `${Math.min(100, (v / Math.max(1, maxStudents)) * 100)}%` }}
                    title={`${v}`}
                  />
                ))}
              </div>
              <div className="text-xs text-gray-400 mt-2">Last updates</div>
            </div>
          </div>
        </div>

        {/* Main layout */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Lecture Setup */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="mb-4 text-lg font-semibold">Lecture Setup</h2>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="text-sm text-gray-300">
                Module Code
                <select
                  className="mt-1 w-full rounded-lg bg-gray-900 border border-gray-700 p-2 text-white outline-none"
                  value={moduleCode}
                  onChange={(e) => setModuleCode(e.target.value)}
                >
                  {MODULES.map((m) => (
                    <option key={m.code} value={m.code} className="bg-gray-900 text-white">
                      {m.code}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm text-gray-300">
                Module Name (auto)
                <input
                  className="mt-1 w-full rounded-lg bg-black/20 border border-white/10 p-2 text-white outline-none"
                  value={moduleName}
                  readOnly
                />
              </label>

              <label className="text-sm text-gray-300">
                Year
                <input
                  className="mt-1 w-full rounded-lg bg-black/20 border border-white/10 p-2 text-white outline-none"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                />
              </label>

              <label className="text-sm text-gray-300">
                Faculty
                <input
                  className="mt-1 w-full rounded-lg bg-black/20 border border-white/10 p-2 text-white outline-none"
                  value={faculty}
                  onChange={(e) => setFaculty(e.target.value)}
                />
              </label>

              <label className="text-sm text-gray-300">
                Batch
                <input
                  className="mt-1 w-full rounded-lg bg-black/20 border border-white/10 p-2 text-white outline-none"
                  value={batch}
                  onChange={(e) => setBatch(e.target.value)}
                />
              </label>

              <label className="text-sm text-gray-300">
                Location
                <input
                  className="mt-1 w-full rounded-lg bg-black/20 border border-white/10 p-2 text-white outline-none"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </label>

              <label className="text-sm text-gray-300">
                Start Time
                <input
                  type="datetime-local"
                  className="mt-1 w-full rounded-lg bg-black/20 border border-white/10 p-2 text-white outline-none"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </label>

              <label className="text-sm text-gray-300">
                End Time
                <input
                  type="datetime-local"
                  className="mt-1 w-full rounded-lg bg-black/20 border border-white/10 p-2 text-white outline-none"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </label>

              <label className="text-sm text-gray-300">
                Hours
                <input
                  type="number"
                  step="0.5"
                  className="mt-1 w-full rounded-lg bg-black/20 border border-white/10 p-2 text-white outline-none"
                  value={hours}
                  onChange={(e) => setHours(Number(e.target.value))}
                />
              </label>

              <label className="text-sm text-gray-300">
                Student Count (max check-ins)
                <input
                  type="number"
                  className="mt-1 w-full rounded-lg bg-black/20 border border-white/10 p-2 text-white outline-none"
                  value={maxStudents}
                  onChange={(e) => setMaxStudents(Number(e.target.value))}
                />
              </label>

              <label className="text-sm text-gray-300">
                PIN Expiry (minutes)
                <input
                  type="number"
                  className="mt-1 w-full rounded-lg bg-black/20 border border-white/10 p-2 text-white outline-none"
                  value={expiryMinutes}
                  onChange={(e) => setExpiryMinutes(Number(e.target.value))}
                />
              </label>

              <label className="text-sm text-gray-300">
                PIN Regenerate Limit
                <input
                  type="number"
                  className="mt-1 w-full rounded-lg bg-black/20 border border-white/10 p-2 text-white outline-none"
                  value={regenLimit}
                  onChange={(e) => setRegenLimit(Number(e.target.value))}
                />
              </label>
            </div>

            <button
              onClick={createSession}
              disabled={loading}
              className="mt-5 w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold hover:bg-blue-500 disabled:opacity-60"
            >
              {loading ? "Generating..." : "Generate PIN"}
            </button>

            {/* Weekly Trend */}
            <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="font-semibold">Weekly Trend</div>
                <div className="text-xs text-gray-400">Mon → Sun (percent)</div>
              </div>

              <div className="h-32 flex items-end gap-2">
                {weeklyTrend.map((v, i) => (
                  <div key={i} className="w-full">
                    <div className="w-full rounded-t bg-white/20" style={{ height: `${v}%` }} title={`${v}%`} />
                    <div className="mt-2 text-center text-xs text-gray-400">
                      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i]}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Live + Lookup */}
          <div className="space-y-6">
            {/* Live Session */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h2 className="mb-4 text-lg font-semibold">Live Session</h2>

              {!session ? (
                <div className="text-gray-400">No active session yet.</div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-gray-300 text-sm">PIN</div>
                        <div className="text-4xl font-bold tracking-widest">{session.pin}</div>
                        <div className="mt-1 text-sm text-gray-400">
                          Expires in: <span className="text-white">{expiresIn ?? "-"}s</span>
                        </div>
                        <div className="mt-1 text-xs text-gray-400">
                          {session.module_code} • {session.batch} • {session.location}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-gray-300 text-sm">Remaining Slots</div>
                        <div className="text-3xl font-bold">{detail?.remaining_slots ?? session.remaining_slots}</div>
                        <div className="mt-1 text-sm text-gray-400">
                          Regen left: <span className="text-white">{session.regen_left}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={regeneratePin}
                      className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-2 font-semibold hover:bg-emerald-500"
                    >
                      Regenerate PIN
                    </button>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="font-semibold">Live Check-ins ({detail?.attendance_count ?? 0})</div>
                      <button
                        onClick={() => loadDetail()}
                        className="rounded-lg bg-white/10 px-3 py-1 text-sm hover:bg-white/15"
                      >
                        Refresh
                      </button>
                    </div>

                    <div className="max-h-[280px] overflow-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="text-gray-300">
                          <tr className="border-b border-white/10">
                            <th className="py-2">Face</th>
                            <th className="py-2">Student ID</th>
                            <th className="py-2">Name</th>
                            <th className="py-2">Marked At</th>
                          </tr>
                        </thead>
                        <tbody className="text-gray-200">
                          {(detail?.attendance ?? []).map((a) => (
                            <tr key={a.student_id} className="border-b border-white/5">
                              <td className="py-2">
                                {a.selfie_base64 ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img alt="selfie" className="h-10 w-10 rounded-full object-cover" src={a.selfie_base64} />
                                ) : (
                                  <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center">🙂</div>
                                )}
                              </td>
                              <td className="py-2">{a.student_id}</td>
                              <td className="py-2">{a.student_name ?? "-"}</td>
                              <td className="py-2">{formatDT(a.marked_at)}</td>
                            </tr>
                          ))}

                          {(detail?.attendance ?? []).length === 0 && (
                            <tr>
                              <td className="py-4 text-gray-400" colSpan={4}>
                                No check-ins yet.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Lookup */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Student Attendance Lookup</h2>

                <div className="relative w-[320px] max-w-full">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full rounded-xl bg-black/20 border border-white/10 pl-9 pr-3 py-2 text-sm text-white outline-none"
                    placeholder="Search by ID or name..."
                  />
                </div>
              </div>

              <div className="max-h-[360px] overflow-auto rounded-xl border border-white/10 bg-black/20">
                <table className="w-full text-left text-sm">
                  <thead className="text-gray-300">
                    <tr className="border-b border-white/10">
                      <th className="py-3 px-4">Student</th>
                      <th className="py-3 px-4">ID</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Time</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-200">
                    {filteredRoster.map((s) => {
                      const mark = presentMap.get(s.student_id);
                      const present = !!mark;

                      return (
                        <tr key={s.student_id} className="border-b border-white/5">
                          <td className="py-3 px-4 font-medium">{s.student_name}</td>
                          <td className="py-3 px-4">{s.student_id}</td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${present ? "bg-emerald-500/15 text-emerald-200" : "bg-yellow-500/15 text-yellow-200"
                                }`}
                            >
                              {present ? "PRESENT" : "ABSENT"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-gray-300">{present ? formatDT(mark!.marked_at) : "-"}</td>
                        </tr>
                      );
                    })}

                    {filteredRoster.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-6 px-4 text-gray-400">
                          No students match your search.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 text-xs text-gray-400">
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
