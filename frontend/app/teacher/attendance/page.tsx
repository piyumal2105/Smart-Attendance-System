"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
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

/** ---------------- Page ---------------- */
export default function AttendancePage() {
  // ── Debug mount/unmount ────────────────────────────────────────
  useEffect(() => {
    console.log("=== TEACHER ATTENDANCE PAGE MOUNTED ===");
    return () => {
      console.log("=== TEACHER ATTENDANCE PAGE UNMOUNTED ===");
    };
  }, []);

  const [moduleCode, setModuleCode] = useState("IT3071");
  const moduleName = useMemo(
    () =>
      [
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
      ].find((m) => m.code === moduleCode)?.name ?? "",
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

  const [savedSessions, setSavedSessions] = useState<SessionRes[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<SessionRes | null>(null);
  const [detail, setDetail] = useState<SessionDetailRes | null>(null);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [liveCounts, setLiveCounts] = useState<number[]>([]);
  const lastCountRef = useRef<number>(0);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // ────────────────────────────────────────────────
  // Load Detail Function
  // ────────────────────────────────────────────────
  const loadDetail = useCallback(async (sessionId: string) => {
    console.log(`[loadDetail] Fetching session: ${sessionId}`);

    try {
      const url = `${API}/api/attendance/sessions/${sessionId}`;

      const res = await fetch(url, {
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = (await res.json()) as SessionDetailRes;
      console.log(`[loadDetail] ✅ SUCCESS - Count: ${data.attendance_count}`);

      setDetail(data);
      setSession(data);

      const count = Number(data.attendance_count ?? 0);
      if (count !== lastCountRef.current) {
        console.log(`[loadDetail] 📊 Count changed: ${lastCountRef.current} → ${count}`);
        lastCountRef.current = count;
        setLiveCounts((prev) => [...prev, count].slice(-12));
      }
    } catch (err: any) {
      // console.error("[loadDetail] ❌ FAILED:", err.message);
    }
  }, []);

  // ────────────────────────────────────────────────
  // WebSocket for Real-Time Updates
  // ────────────────────────────────────────────────
  useEffect(() => {
    if (!activeSessionId) return;

    const wsUrl = API.replace("http", "ws") + `/api/attendance/ws/${activeSessionId}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => console.log("[WS] Connected");
    ws.onmessage = (event) => {
      if (event.data === "update" && activeSessionId) {
        loadDetail(activeSessionId);
      }
    };
    ws.onclose = () => console.log("[WS] Closed");
    ws.onerror = (err) => console.error("[WS] Error:", err);

    wsRef.current = ws;

    return () => ws.close();
  }, [activeSessionId, loadDetail]);

  // ────────────────────────────────────────────────
  // Polling
  // ────────────────────────────────────────────────
  const startPolling = useCallback((sessionId: string) => {
    if (!sessionId) return;

    console.log(`[POLLING] 🟢 Starting for session: ${sessionId}`);

    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    loadDetail(sessionId); // immediate
    pollingIntervalRef.current = setInterval(() => {
      loadDetail(sessionId);
    }, 3000);
  }, [loadDetail]);

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      console.log("[POLLING] 🔴 Stopped");
    }
  }, []);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  // ── Recover active session ───────────────────────
  useEffect(() => {
    const savedId = localStorage.getItem("activeAttendanceSessionId");
    if (savedId && !activeSessionId) {
      console.log("♻️ Restoring session:", savedId);
      setActiveSessionId(savedId);
      loadDetail(savedId);
      startPolling(savedId);
    }
  }, [loadDetail, startPolling, activeSessionId]);

  useEffect(() => {
    if (activeSessionId) {
      localStorage.setItem("activeAttendanceSessionId", activeSessionId);
    } else {
      localStorage.removeItem("activeAttendanceSessionId");
    }
  }, [activeSessionId]);

  // ────────────────────────────────────────────────
  // Create Session
  // ────────────────────────────────────────────────
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

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || `HTTP ${res.status}`);
      }

      const data = (await res.json()) as SessionRes;
      setActiveSessionId(data.session_id);
      setSession(data);
      setDetail(null);

      setSavedSessions((prev) => {
        if (prev.some((s) => s.session_id === data.session_id)) return prev;
        return [data, ...prev].slice(0, 8);
      });

      startPolling(data.session_id);

      setMsg(`✅ Session created! PIN: ${data.pin}`);
      setTimeout(() => setMsg(null), 7000);
    } catch (err: any) {
      setMsg(`❌ Failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  // ────────────────────────────────────────────────
  // Regenerate PIN
  // ────────────────────────────────────────────────
  async function regeneratePin() {
    if (!session?.session_id) return;

    try {
      const res = await fetch(
        `${API}/api/attendance/sessions/${session.session_id}/regenerate-pin`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expiry_minutes: expiryMinutes }),
        }
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to regenerate PIN");
      }

      const data = (await res.json()) as SessionRes;
      setSession(data);
      setSavedSessions((prev) =>
        prev.map((s) => (s.session_id === data.session_id ? data : s))
      );

      setMsg(`✅ PIN regenerated! New PIN: ${data.pin}`);
      setTimeout(() => setMsg(null), 5000);
    } catch (err: any) {
      setMsg(`❌ ${err.message}`);
    }
  }

  // ────────────────────────────────────────────────
  // Computed values
  // ────────────────────────────────────────────────
  const expiresIn = useMemo(() => {
    if (!session) return null;
    const exp = new Date(session.pin_expires_at).getTime();
    return Math.max(0, Math.ceil((exp - Date.now()) / 1000));
  }, [session]);

  const presentMap = useMemo(() => {
    const map = new Map<string, { marked_at: string; selfie_base64?: string }>();
    detail?.attendance?.forEach((a) => {
      map.set(a.student_id, {
        marked_at: a.marked_at,
        selfie_base64: a.selfie_base64,
      });
    });
    return map;
  }, [detail]);

  const presentCount = detail?.attendance_count ?? 0;

  // Only students who have actually attended (no hardcoded roster)
  const attendedStudents = useMemo(() => {
    return detail?.attendance?.map((a) => ({
      student_id: a.student_id,
      student_name: a.student_name || a.student_id,
    })) ?? [];
  }, [detail]);

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return attendedStudents;
    return attendedStudents.filter(
      (s) =>
        s.student_id.toLowerCase().includes(q) ||
        s.student_name.toLowerCase().includes(q)
    );
  }, [attendedStudents, search]);

  function exportCSV() {
    if (!session || !detail) {
      setMsg("No active session to export");
      return;
    }

    const rows = attendedStudents.map((s) => {
      const entry = presentMap.get(s.student_id);
      return {
        student_id: s.student_id,
        student_name: s.student_name,
        status: "PRESENT",
        marked_at: formatDT(entry?.marked_at || ""),
        module_code: session.module_code,
        module_name: session.module_name,
        batch: session.batch,
        faculty: session.faculty,
        year: session.year,
      };
    });

    const headers = Object.keys(rows[0] || {});
    const csv = [
      headers.join(","),
      ...rows.map((row) =>
        headers
          .map((h) => `"${String((row as any)[h] ?? "").replace(/"/g, '""')}"`)
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance_${session.module_code}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function formatDT(dt: string) {
    try {
      return new Date(dt).toLocaleString();
    } catch {
      return dt;
    }
  }

  // ────────────────────────────────────────────────
  // JSX
  // ────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-gray-900 text-white overflow-hidden">
      <header className="h-16 bg-gray-800/50 backdrop-blur border-b border-gray-700 flex items-center justify-between px-8 sticky top-0 z-10 shrink-0">
        <h2 className="text-lg font-semibold text-gray-200">Student Attendance</h2>
        <div className="flex items-center gap-4">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-sm text-emerald-400">System Online</span>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-8">
        

        <div className="mb-6 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="text-sm text-gray-400">
              {/* Backend API: <code className="bg-gray-800 px-2 py-1 rounded">{API}</code> */}
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {savedSessions.length > 0 && (
                <select
                  className="rounded-lg bg-gray-900 border border-gray-700 px-3 py-2 text-sm outline-none"
                  value={activeSessionId ?? ""}
                  onChange={(e) => {
                    const id = e.target.value;
                    if (id) {
                      setActiveSessionId(id);
                      loadDetail(id);
                      startPolling(id);
                    }
                  }}
                >
                  <option value="" disabled>Switch session...</option>
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
              >
                <CalendarClock size={16} />
                Session Planner
              </Link>

              <button
                onClick={() => activeSessionId && loadDetail(activeSessionId)}
                disabled={!activeSessionId}
                className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm hover:bg-white/15 disabled:opacity-50"
              >
                <RefreshCw size={16} />
                Refresh Now
              </button>

              <button
                onClick={exportCSV}
                disabled={!session}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold hover:bg-emerald-500 disabled:opacity-50"
              >
                <Download size={16} />
                Export CSV
              </button>
            </div>
          </div>

          {msg && (
            <div
              className={`rounded-lg border px-4 py-3 text-sm ${msg.includes("✅")
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                  : "border-red-500/40 bg-red-500/10 text-red-200"
                }`}
            >
              {msg}
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm text-gray-300 flex items-center gap-2">
                <Users size={16} className="opacity-80" />
                Today Check-ins
              </div>
              <div className="mt-1 text-3xl font-bold">{presentCount}</div>
              <div className="text-xs text-gray-400 mt-1">
                Out of {session?.max_students ?? maxStudents} students
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm text-gray-300 flex items-center gap-2">
                <Clock size={16} className="opacity-80" />
                PIN Expires In
              </div>
              <div className="mt-1 text-3xl font-bold">
                {session ? `${expiresIn ?? "-"}s` : "-"}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Remaining slots: {session?.remaining_slots ?? "-"}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm text-gray-300 flex items-center gap-2">
                <AlertTriangle size={16} className="opacity-80" />
                Absent Students
              </div>
              <div className="mt-1 text-3xl font-bold">-</div>
              <div className="text-xs text-gray-400 mt-1">Based on check-ins only</div>
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
                    style={{
                      height: `${Math.min(100, (v / Math.max(1, session?.max_students ?? 1)) * 100)}%`,
                    }}
                  />
                ))}
              </div>
              <div className="text-xs text-gray-400 mt-2">
                Last {liveCounts.length} updates
              </div>
            </div>
          </div>
        </div>

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
                  {["IT3071", "IT3061", "IT3041", "IT3021", "IT3011", "IT4010", "IT4030", "IT4041", "IT4011", "IT4031"].map((code) => (
                    <option key={code} value={code}>
                      {code}
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
                Max Students
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
                PIN Regen Limit
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
              className="mt-5 w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Generating..." : "Generate PIN"}
            </button>
          </div>

          {/* Live Session + Lookup */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h2 className="mb-4 text-lg font-semibold">Live Session</h2>

              {!session ? (
                <div className="text-gray-400 text-center py-8">
                  <p>No active session yet.</p>
                  <p className="text-sm mt-2">Click "Generate PIN" to start a session</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div>
                        <div className="text-gray-300 text-sm">PIN</div>
                        <div className="text-4xl font-bold tracking-widest font-mono">
                          {session.pin}
                        </div>
                        <div className="mt-1 text-sm text-gray-400">
                          Expires in: <span className="text-white font-medium">{expiresIn ?? "-"}s</span>
                        </div>
                        <div className="mt-1 text-xs text-gray-400">
                          {session.module_code} • {session.batch} • {session.location}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-gray-300 text-sm">Remaining Slots</div>
                        <div className="text-3xl font-bold">{session.remaining_slots}</div>
                        <div className="mt-1 text-sm text-gray-400">
                          Regen left: <span className="text-white">{session.regen_left}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={regeneratePin}
                      disabled={session.regen_left <= 0}
                      className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-2 font-semibold hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {session.regen_left <= 0 ? "Regeneration Limit Reached" : "Regenerate PIN"}
                    </button>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="font-semibold">Live Check-ins ({presentCount})</div>
                      <div className="flex items-center gap-2">
                        {pollingIntervalRef.current && (
                          <span className="text-xs text-emerald-400 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                            Live
                          </span>
                        )}
                        <button
                          onClick={() => activeSessionId && loadDetail(activeSessionId)}
                          className="rounded-lg bg-white/10 px-3 py-1 text-sm hover:bg-white/15 transition-colors"
                        >
                          Refresh
                        </button>
                      </div>
                    </div>

                    <div className="max-h-[280px] overflow-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="text-gray-300 sticky top-0 bg-gray-900 z-10">
                          <tr className="border-b border-white/10">
                            <th className="py-2 px-2">Face</th>
                            <th className="py-2 px-2">ID</th>
                            <th className="py-2 px-2">Name</th>
                            <th className="py-2 px-2">Marked At</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail?.attendance?.length ? (
                            detail.attendance.map((a) => (
                              <tr key={a.student_id} className="border-b border-white/5 hover:bg-white/5">
                                <td className="py-2 px-2">
                                  {a.selfie_base64 ? (
                                    <img
                                      src={a.selfie_base64}
                                      alt="selfie"
                                      className="h-10 w-10 rounded-full object-cover border border-gray-700"
                                    />
                                  ) : (
                                    <div className="h-10 w-10 rounded-full bg-gray-700 flex items-center justify-center text-gray-400">
                                      ?
                                    </div>
                                  )}
                                </td>
                                <td className="py-2 px-2">{a.student_id}</td>
                                <td className="py-2 px-2">{a.student_name || "-"}</td>
                                <td className="py-2 px-2">{formatDT(a.marked_at)}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={4} className="py-8 text-center text-gray-500">
                                No check-ins yet...
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

            {/* Student Attendance Lookup – now only shows real attended students */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="mb-4 flex items-center justify-between gap-4 flex-wrap">
                <h2 className="text-lg font-semibold">Student Attendance Lookup</h2>

                <div className="relative w-full max-w-[360px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by ID or name..."
                    className="w-full bg-black/30 border border-gray-700 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-emerald-500/50 transition-colors"
                  />
                </div>
              </div>

              <div className="max-h-[400px] overflow-auto rounded-xl border border-gray-700 bg-black/30">
                <table className="w-full text-left text-sm">
                  <thead className="text-gray-300 sticky top-0 bg-gray-900 z-10">
                    <tr className="border-b border-gray-700">
                      <th className="py-3 px-4">Student</th>
                      <th className="py-3 px-4">ID</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {session ? (
                      filteredStudents.length > 0 ? (
                        filteredStudents.map((s) => {
                          const entry = presentMap.get(s.student_id);
                          return (
                            <tr key={s.student_id} className="border-b border-gray-800 hover:bg-gray-800/50">
                              <td className="py-3 px-4 font-medium">{s.student_name}</td>
                              <td className="py-3 px-4">{s.student_id}</td>
                              <td className="py-3 px-4">
                                <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-900/40 text-emerald-300 border border-emerald-700/50">
                                  PRESENT
                                </span>
                              </td>
                              <td className="py-3 px-4 text-gray-400">
                                {entry ? formatDT(entry.marked_at) : "-"}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={4} className="py-16 text-center text-gray-500">
                            No students have checked in yet
                          </td>
                        </tr>
                      )
                    ) : (
                      <tr>
                        <td colSpan={4} className="py-16 text-center text-gray-500">
                          Create a session to view attendance
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 text-xs text-gray-500">
                {session
                  ? `Showing real-time check-ins • ${presentCount} present • updates every ~3s`
                  : "Create a session to start tracking attendance"}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}