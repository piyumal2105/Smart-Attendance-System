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
  MapPin,
  Maximize2,
  Minimize2,
  ShieldCheck,
  History,
  ChevronDown,
  ChevronUp,
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

type AttendanceItem = {
  student_id: string;
  student_name?: string;
  full_name?: string;
  profile_picture_url?: string;
  selfie_base64?: string;
  marked_at: string;
  module_code?: string;
};

type SessionDetailRes = SessionRes & {
  attendance_count: number;
  attendance: AttendanceItem[];
};

type PastSession = {
  session_id: string;
  module_code: string;
  module_name: string;
  year: string;
  faculty: string;
  batch: string;
  location: string;
  start_time: string;
  end_time: string;
  hours: number;
  max_students: number;
  attendance_count: number;
  attendance_percentage: number;
  created_at: string;
  attendees: {
    student_id: string;
    full_name: string;
    profile_picture_url: string;
    marked_at: string;
  }[];
};

/** ---------------- Page ---------------- */
export default function AttendancePage() {
  useEffect(() => {
    console.log("=== TEACHER ATTENDANCE PAGE MOUNTED ===");
    return () => console.log("=== TEACHER ATTENDANCE PAGE UNMOUNTED ===");
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

  const [isMapExpanded, setIsMapExpanded] = useState(false);

  // NEW: Past sessions state
  const [pastSessions, setPastSessions] = useState<PastSession[]>([]);
  const [loadingPastSessions, setLoadingPastSessions] = useState(false);
  const [showPastSessions, setShowPastSessions] = useState(false);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  // ────────────────────────────────────────────────
  // Load Detail
  // ────────────────────────────────────────────────
  const loadDetail = useCallback(async (sessionId: string) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/api/attendance/sessions/${sessionId}`, {
        cache: "no-store",
        headers: {
          Accept: "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = (await res.json()) as SessionDetailRes;
      setDetail(data);
      setSession(data);

      const count = Number(data.attendance_count ?? 0);
      if (count !== lastCountRef.current) {
        lastCountRef.current = count;
        setLiveCounts((prev) => [...prev, count].slice(-12));
      }
    } catch (err: any) {
      // silent
    }
  }, []);

  // ────────────────────────────────────────────────
  // NEW: Load Past Sessions
  // ────────────────────────────────────────────────
  const loadPastSessions = useCallback(async () => {
    setLoadingPastSessions(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/api/attendance/teacher/sessions?limit=50`, {
        headers: {
          Accept: "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      setPastSessions(data.sessions || []);
    } catch (err) {
      console.error("Failed to load past sessions:", err);
    } finally {
      setLoadingPastSessions(false);
    }
  }, []);

  // Load past sessions on mount
  useEffect(() => {
    loadPastSessions();
  }, [loadPastSessions]);

  // ────────────────────────────────────────────────
  // WebSocket
  // ────────────────────────────────────────────────
  useEffect(() => {
    if (!activeSessionId) return;
    const wsUrl = API.replace("http", "ws") + `/api/attendance/ws/${activeSessionId}`;
    const ws = new WebSocket(wsUrl);
    ws.onmessage = (e) => { if (e.data === "update" && activeSessionId) loadDetail(activeSessionId); };
    wsRef.current = ws;
    return () => ws.close();
  }, [activeSessionId, loadDetail]);

  // ────────────────────────────────────────────────
  // Polling
  // ────────────────────────────────────────────────
  const startPolling = useCallback((sessionId: string) => {
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    loadDetail(sessionId);
    pollingIntervalRef.current = setInterval(() => loadDetail(sessionId), 3000);
  }, [loadDetail]);

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) { clearInterval(pollingIntervalRef.current); pollingIntervalRef.current = null; }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  // Recover active session
  useEffect(() => {
    const savedId = localStorage.getItem("activeAttendanceSessionId");
    if (savedId && !activeSessionId) {
      setActiveSessionId(savedId);
      loadDetail(savedId);
      startPolling(savedId);
    }
  }, [loadDetail, startPolling, activeSessionId]);

  useEffect(() => {
    if (activeSessionId) localStorage.setItem("activeAttendanceSessionId", activeSessionId);
    else localStorage.removeItem("activeAttendanceSessionId");
  }, [activeSessionId]);

  // ────────────────────────────────────────────────
  // Create Session
  // ────────────────────────────────────────────────
  async function createSession() {
    setLoading(true);
    setMsg(null);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/api/attendance/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) },
        body: JSON.stringify({
          module_code: moduleCode, module_name: moduleName, year, faculty, batch,
          start_time: startTime || "now", end_time: endTime || "later", hours,
          location, max_students: maxStudents, expiry_minutes: expiryMinutes, regen_limit: regenLimit,
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || `HTTP ${res.status}`); }

      const data = (await res.json()) as SessionRes;
      setActiveSessionId(data.session_id);
      setSession(data);
      setDetail(null);
      setSavedSessions((prev) => prev.some((s) => s.session_id === data.session_id) ? prev : [data, ...prev].slice(0, 8));
      startPolling(data.session_id);
      setMsg(`✅ Session created! PIN: ${data.pin}`);
      setTimeout(() => setMsg(null), 7000);

      // Reload past sessions
      loadPastSessions();
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
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/api/attendance/sessions/${session.session_id}/regenerate-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) },
        body: JSON.stringify({ expiry_minutes: expiryMinutes }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || "Failed"); }
      const data = (await res.json()) as SessionRes;
      setSession(data);
      setSavedSessions((prev) => prev.map((s) => s.session_id === data.session_id ? data : s));
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
    return Math.max(0, Math.ceil((new Date(session.pin_expires_at).getTime() - Date.now()) / 1000));
  }, [session]);

  const presentMap = useMemo(() => {
    const map = new Map<string, AttendanceItem>();
    detail?.attendance?.forEach((a) => map.set(a.student_id, a));
    return map;
  }, [detail]);

  const presentCount = detail?.attendance_count ?? 0;

  const attendedStudents = useMemo(() =>
    detail?.attendance?.map((a) => ({
      student_id: a.student_id,
      student_name: a.full_name || a.student_name || a.student_id,
      profile_picture_url: a.profile_picture_url,
      selfie_base64: a.selfie_base64,
      module_code: a.module_code || detail.module_code,
    })) ?? [], [detail]);

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return attendedStudents;
    return attendedStudents.filter(
      (s) => s.student_id.toLowerCase().includes(q) || s.student_name.toLowerCase().includes(q)
    );
  }, [attendedStudents, search]);

  // ────────────────────────────────────────────────
  // Helpers
  // ────────────────────────────────────────────────
  const getProfilePictureUrl = (a: AttendanceItem) =>
    a.profile_picture_url ? `${API}${a.profile_picture_url}` : null;

  function formatDT(dt: string) {
    try { return new Date(dt).toLocaleString(); } catch { return dt; }
  }

  function formatDate(dt: string) {
    try { return new Date(dt).toLocaleDateString(); } catch { return dt; }
  }

  function formatTime(dt: string) {
    try { return new Date(dt).toLocaleTimeString(); } catch { return dt; }
  }

  // ────────────────────────────────────────────────
  // Classroom Seating Map
  // ────────────────────────────────────────────────
  const classroomSeats = useMemo(() => {
    const rows = 6;
    const cols = 10;
    const totalSeats = session?.max_students ?? maxStudents;
    const seats = [];

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const seatIndex = row * cols + col;
        if (seatIndex < totalSeats) {
          const student = attendedStudents[seatIndex] || null;
          const isPresent = student ? presentMap.has(student.student_id) : false;
          seats.push({ row, col, seatIndex, student, isPresent, isEmpty: !student });
        }
      }
    }
    return seats;
  }, [session, maxStudents, attendedStudents, presentMap]);

  function exportCSV() {
    if (!session || !detail) { setMsg("No active session to export"); return; }
    const rows = attendedStudents.map((s) => {
      const entry = presentMap.get(s.student_id);
      return {
        student_id: s.student_id, student_name: s.student_name, status: "PRESENT",
        marked_at: formatDT(entry?.marked_at || ""), module_code: s.module_code || session.module_code,
        module_name: session.module_name, batch: session.batch, faculty: session.faculty, year: session.year,
      };
    });
    const headers = Object.keys(rows[0] || {});
    const csv = [
      headers.join(","),
      ...rows.map((row) => headers.map((h) => `"${String((row as any)[h] ?? "").replace(/"/g, '""')}"`).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance_${session.module_code}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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

          {/* Top bar */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div />
            <div className="flex items-center gap-3 flex-wrap">
              {savedSessions.length > 0 && (
                <select
                  className="rounded-lg bg-gray-900 border border-gray-700 px-3 py-2 text-sm outline-none"
                  value={activeSessionId ?? ""}
                  onChange={(e) => {
                    const id = e.target.value;
                    if (id) { setActiveSessionId(id); loadDetail(id); startPolling(id); }
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
              <button
                onClick={() => setShowPastSessions(!showPastSessions)}
                className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-3 py-2 text-sm font-semibold hover:bg-purple-500"
              >
                <History size={16} />
                {showPastSessions ? "Hide" : "View"} Past Sessions
              </button>
              <Link href="/teacher/attendance/planner"
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold hover:bg-indigo-500">
                <CalendarClock size={16} /> Session Planner
              </Link>
              <button onClick={() => activeSessionId && loadDetail(activeSessionId)} disabled={!activeSessionId}
                className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm hover:bg-white/15 disabled:opacity-50">
                <RefreshCw size={16} /> Refresh Now
              </button>
              <button onClick={exportCSV} disabled={!session}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold hover:bg-emerald-500 disabled:opacity-50">
                <Download size={16} /> Export CSV
              </button>
            </div>
          </div>

          {msg && (
            <div className={`rounded-lg border px-4 py-3 text-sm ${msg.includes("✅") ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200" : "border-red-500/40 bg-red-500/10 text-red-200"}`}>
              {msg}
            </div>
          )}

          {/* NEW: Past Sessions Section */}
          {showPastSessions && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <History size={20} className="text-purple-400" />
                  Past Conducted Sessions
                </h2>
                <button
                  onClick={loadPastSessions}
                  disabled={loadingPastSessions}
                  className="text-sm text-gray-400 hover:text-gray-200 flex items-center gap-1"
                >
                  <RefreshCw size={14} className={loadingPastSessions ? "animate-spin" : ""} />
                  {loadingPastSessions ? "Loading..." : "Refresh"}
                </button>
              </div>

              {loadingPastSessions ? (
                <div className="text-center py-8 text-gray-500">Loading past sessions...</div>
              ) : pastSessions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No past sessions found</div>
              ) : (
                <div className="space-y-3">
                  {pastSessions.map((ps) => (
                    <div key={ps.session_id} className="rounded-xl border border-gray-700 bg-gray-800/50 overflow-hidden">
                      <div
                        className="p-4 cursor-pointer hover:bg-gray-700/30 transition-colors"
                        onClick={() => setExpandedSession(expandedSession === ps.session_id ? null : ps.session_id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="text-lg font-bold text-white">{ps.module_code}</span>
                              <span className="text-gray-400">•</span>
                              <span className="text-sm text-gray-300">{ps.module_name}</span>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-gray-400">
                              <span>{formatDate(ps.created_at)}</span>
                              <span>•</span>
                              <span>{ps.batch}</span>
                              <span>•</span>
                              <span>{ps.location}</span>
                              <span>•</span>
                              <span>{ps.hours}h</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <div className="text-2xl font-bold text-white">{ps.attendance_count}</div>
                              <div className="text-xs text-gray-400">/{ps.max_students} students</div>
                            </div>
                            <div className="text-right">
                              <div className={`text-xl font-bold ${ps.attendance_percentage >= 80 ? 'text-emerald-400' : ps.attendance_percentage >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
                                {ps.attendance_percentage.toFixed(0)}%
                              </div>
                              <div className="text-xs text-gray-400">attendance</div>
                            </div>
                            {expandedSession === ps.session_id ? (
                              <ChevronUp size={20} className="text-gray-400" />
                            ) : (
                              <ChevronDown size={20} className="text-gray-400" />
                            )}
                          </div>
                        </div>
                      </div>

                      {expandedSession === ps.session_id && (
                        <div className="border-t border-gray-700 p-4 bg-gray-900/50">
                          <h4 className="text-sm font-semibold text-gray-300 mb-3">
                            Students Attended ({ps.attendees.length})
                          </h4>
                          {ps.attendees.length === 0 ? (
                            <div className="text-sm text-gray-500 text-center py-4">
                              No students attended this session
                            </div>
                          ) : (
                            <div className="max-h-60 overflow-auto">
                              <table className="w-full text-sm">
                                <thead className="text-gray-400 border-b border-gray-700 sticky top-0 bg-gray-900">
                                  <tr>
                                    <th className="text-left py-2 px-3">Photo</th>
                                    <th className="text-left py-2 px-3">Student ID</th>
                                    <th className="text-left py-2 px-3">Name</th>
                                    <th className="text-left py-2 px-3">Marked At</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {ps.attendees.map((att) => (
                                    <tr key={att.student_id} className="border-b border-gray-800 hover:bg-gray-800/30">
                                      <td className="py-2 px-3">
                                        <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-700">
                                          {att.profile_picture_url ? (
                                            <img
                                              src={`${API}${att.profile_picture_url}`}
                                              alt={att.full_name}
                                              className="w-full h-full object-cover"
                                              onError={(e) => {
                                                (e.target as HTMLImageElement).src = "https://via.placeholder.com/40?text=?";
                                              }}
                                            />
                                          ) : (
                                            <div className="w-full h-full bg-gray-700 flex items-center justify-center text-gray-400 font-medium">
                                              {att.full_name.charAt(0).toUpperCase()}
                                            </div>
                                          )}
                                        </div>
                                      </td>
                                      <td className="py-2 px-3 text-gray-300">{att.student_id}</td>
                                      <td className="py-2 px-3 text-gray-300">{att.full_name}</td>
                                      <td className="py-2 px-3 text-gray-400 text-xs">{formatDT(att.marked_at)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm text-gray-300 flex items-center gap-2"><Users size={16} className="opacity-80" /> Today Check-ins</div>
              <div className="mt-1 text-3xl font-bold">{presentCount}</div>
              <div className="text-xs text-gray-400 mt-1">Out of {session?.max_students ?? maxStudents} students</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm text-gray-300 flex items-center gap-2"><Clock size={16} className="opacity-80" /> PIN Expires In</div>
              <div className="mt-1 text-3xl font-bold">{session ? `${expiresIn ?? "-"}s` : "-"}</div>
              <div className="text-xs text-gray-400 mt-1">Remaining slots: {session?.remaining_slots ?? "-"}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm text-gray-300 flex items-center gap-2"><AlertTriangle size={16} className="opacity-80" /> Absent Students</div>
              <div className="mt-1 text-3xl font-bold">{session ? session.max_students - presentCount : "-"}</div>
              <div className="text-xs text-gray-400 mt-1">Based on check-ins only</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm text-gray-300 flex items-center gap-2"><TrendingUp size={16} className="opacity-80" /> Live Trend</div>
              <div className="mt-2 flex items-end gap-1 h-10">
                {(liveCounts.length ? liveCounts : [0, 0, 0, 0]).map((v, i) => (
                  <div key={i} className="w-full rounded-t bg-white/20"
                    style={{ height: `${Math.min(100, (v / Math.max(1, session?.max_students ?? 1)) * 100)}%` }} />
                ))}
              </div>
              <div className="text-xs text-gray-400 mt-2">Last {liveCounts.length} updates</div>
            </div>
          </div>

          {/* Classroom Seating Map */}
          {session && (
            <div className={`rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-pink-500/10 backdrop-blur transition-all duration-300 ${isMapExpanded ? "p-12" : "p-8"}`}>
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 shadow-lg shadow-indigo-500/10">
                    <MapPin size={24} className="text-indigo-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                      Classroom Seating Map
                    </h2>
                    <p className="text-sm text-gray-400 mt-1">{session.location} • Real-time occupancy view</p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-6 text-sm bg-black/20 rounded-2xl px-6 py-3 border border-white/5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded-full bg-emerald-500/80 border-2 border-emerald-400 shadow-lg shadow-emerald-500/30"></div>
                      <span className="text-gray-300 font-medium">Present (selfie)</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded-full bg-gray-700 border-2 border-gray-600"></div>
                      <span className="text-gray-300 font-medium">Empty</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <ShieldCheck size={16} className="text-blue-400" />
                      <span className="text-gray-400 text-xs">Hover to verify identity</span>
                    </div>
                  </div>

                  <button onClick={() => setIsMapExpanded(!isMapExpanded)}
                    className="p-3 rounded-xl bg-white/10 hover:bg-white/15 transition-all hover:scale-105 border border-white/5"
                    title={isMapExpanded ? "Minimize" : "Expand"}>
                    {isMapExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                  </button>
                </div>
              </div>

              <div className="mb-10 px-4">
                <div className="h-1.5 bg-gradient-to-r from-transparent via-white/30 to-transparent rounded-full mb-3"></div>
                <div className="text-center text-sm text-gray-400 font-semibold tracking-widest">FRONT • INSTRUCTOR AREA</div>
              </div>

              <div className={`grid ${isMapExpanded ? "gap-6 grid-cols-10 px-8 pt-8" : "gap-5 grid-cols-10 px-4 pt-6"} mx-auto max-w-full overflow-x-auto overflow-y-visible pb-2`}>
                {classroomSeats.map((seat) => {
                  const attendanceData = seat.student
                    ? detail?.attendance?.find((a) => a.student_id === seat.student?.student_id)
                    : null;
                  const profilePicUrl = attendanceData ? getProfilePictureUrl(attendanceData) : null;
                  const primaryImage = attendanceData?.selfie_base64 ?? null;
                  const fallbackImage = profilePicUrl;

                  return (
                    <div
                      key={`${seat.row}-${seat.col}`}
                      className={`
                        relative group aspect-square rounded-2xl transition-all duration-300
                        ${seat.isPresent
                          ? "bg-emerald-500/15 border-[3px] border-emerald-400/70 shadow-xl shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-110 hover:-translate-y-1 hover:z-50"
                          : seat.isEmpty
                            ? "bg-gray-800/30 border-[3px] border-gray-700/40 hover:bg-gray-800/50 hover:border-gray-600/60"
                            : "bg-gray-800/30 border-[3px] border-gray-700/40"
                        }
                        cursor-pointer backdrop-blur-sm
                      `}
                      title={seat.student ? `${seat.student.student_id} - ${seat.student.student_name}` : "Empty seat"}
                    >
                      {seat.isPresent && seat.student ? (
                        <div className="relative w-full h-full p-1 overflow-hidden rounded-2xl">
                          <div className="absolute inset-0 bg-emerald-400/20 animate-pulse rounded-xl -z-10"></div>
                          <div className="relative w-full h-full rounded-xl overflow-hidden">
                            {primaryImage ? (
                              <img
                                src={primaryImage}
                                alt="Check-in selfie"
                                className="w-full h-full object-cover transition-opacity duration-300 group-hover:opacity-0"
                              />
                            ) : fallbackImage ? (
                              <img
                                src={fallbackImage}
                                alt={seat.student.student_name}
                                className="w-full h-full object-cover transition-opacity duration-300 group-hover:opacity-0"
                                onError={(e) => { (e.target as HTMLImageElement).src = "https://via.placeholder.com/100?text=?"; }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-500/30 to-emerald-600/30 text-emerald-200 font-bold text-xl transition-opacity duration-300 group-hover:opacity-0">
                                {seat.student.student_name.charAt(0).toUpperCase()}
                              </div>
                            )}

                            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                              {fallbackImage ? (
                                <img
                                  src={fallbackImage}
                                  alt="Profile picture"
                                  className="w-full h-full object-cover"
                                  onError={(e) => { (e.target as HTMLImageElement).src = "https://via.placeholder.com/100?text=?"; }}
                                />
                              ) : primaryImage ? (
                                <img src={primaryImage} alt="selfie" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500/30 to-blue-600/30 text-blue-200 font-bold text-xl">
                                  {seat.student.student_name.charAt(0).toUpperCase()}
                                </div>
                              )}

                              <div className="absolute top-1.5 left-1.5 bg-blue-600/90 backdrop-blur-sm text-[9px] text-white px-1.5 py-0.5 rounded-md font-semibold z-20 flex items-center gap-1">
                                <ShieldCheck size={9} />
                                ID Photo
                              </div>
                            </div>

                            <div className="absolute top-1.5 left-1.5 bg-emerald-600/90 backdrop-blur-sm text-[9px] text-white px-1.5 py-0.5 rounded-md font-semibold z-20 flex items-center gap-1 group-hover:opacity-0 transition-opacity duration-300">
                              <span>📷</span> Live
                            </div>

                            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-end pb-2 px-1">
                              <p className="text-[9px] font-bold text-emerald-300 text-center line-clamp-1 drop-shadow-lg mb-0.5">
                                {seat.student.student_id}
                              </p>
                              <p className="text-[10px] font-bold text-white text-center line-clamp-1 drop-shadow-lg mb-0.5">
                                {seat.student.student_name}
                              </p>
                              <div className="px-2 py-0.5 rounded-full bg-blue-500 text-[8px] font-semibold text-white shadow-lg">
                                ✓ VERIFIED
                              </div>
                            </div>
                          </div>

                          <div className="absolute top-2 right-2 z-10 pointer-events-none">
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-white shadow-lg shadow-emerald-500/50 animate-pulse"></div>
                          </div>
                        </div>
                      ) : seat.isEmpty ? (
                        <div className="w-full h-full flex items-center justify-center p-2">
                          <div className="w-10 h-10 rounded-xl border-[3px] border-dashed border-gray-600/40"></div>
                        </div>
                      ) : null}

                      <div className="absolute bottom-1.5 right-1.5 bg-black/60 backdrop-blur-sm text-[10px] text-gray-300 px-2 py-0.5 rounded-md font-medium pointer-events-none z-20">
                        {seat.seatIndex + 1}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-10 px-4">
                <div className="text-center text-sm text-gray-400 font-semibold tracking-widest mb-3">BACK • EXIT</div>
                <div className="h-1.5 bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-full"></div>
              </div>

              <div className="mt-8 pt-6 border-t border-white/10 flex items-center justify-between text-sm flex-wrap gap-4">
                <div className="flex items-center gap-8 flex-wrap">
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2.5">
                    <span className="text-gray-400 text-xs uppercase tracking-wider">Occupied</span>
                    <div className="mt-0.5 font-bold text-emerald-400 text-lg">{presentCount} seats</div>
                  </div>
                  <div className="bg-gray-700/10 border border-gray-600/20 rounded-xl px-4 py-2.5">
                    <span className="text-gray-400 text-xs uppercase tracking-wider">Vacancy</span>
                    <div className="mt-0.5 font-bold text-gray-300 text-lg">{session.max_students - presentCount} seats</div>
                  </div>
                  <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-4 py-2.5">
                    <span className="text-gray-400 text-xs uppercase tracking-wider">Occupancy Rate</span>
                    <div className="mt-0.5 font-bold text-indigo-400 text-lg">
                      {session.max_students > 0 ? Math.round((presentCount / session.max_students) * 100) : 0}%
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-gray-400 bg-black/20 rounded-xl px-4 py-2.5 border border-white/5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-lg shadow-emerald-500/50"></span>
                  <span className="font-medium">Live updates every 3s</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Lecture Setup */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="mb-4 text-lg font-semibold">Lecture Setup</h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="text-sm text-gray-300">
                Module Code
                <select className="mt-1 w-full rounded-lg bg-gray-900 border border-gray-700 p-2 text-white outline-none"
                  value={moduleCode} onChange={(e) => setModuleCode(e.target.value)}>
                  {["IT3071", "IT3061", "IT3041", "IT3021", "IT3011", "IT4010", "IT4030", "IT4041", "IT4011", "IT4031"].map((code) => (
                    <option key={code} value={code}>{code}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-gray-300">
                Module Name (auto)
                <input className="mt-1 w-full rounded-lg bg-black/20 border border-white/10 p-2 text-white outline-none" value={moduleName} readOnly />
              </label>
              <label className="text-sm text-gray-300">Year
                <input className="mt-1 w-full rounded-lg bg-black/20 border border-white/10 p-2 text-white outline-none" value={year} onChange={(e) => setYear(e.target.value)} />
              </label>
              <label className="text-sm text-gray-300">Faculty
                <input className="mt-1 w-full rounded-lg bg-black/20 border border-white/10 p-2 text-white outline-none" value={faculty} onChange={(e) => setFaculty(e.target.value)} />
              </label>
              <label className="text-sm text-gray-300">Batch
                <input className="mt-1 w-full rounded-lg bg-black/20 border border-white/10 p-2 text-white outline-none" value={batch} onChange={(e) => setBatch(e.target.value)} />
              </label>
              <label className="text-sm text-gray-300">Location
                <input className="mt-1 w-full rounded-lg bg-black/20 border border-white/10 p-2 text-white outline-none" value={location} onChange={(e) => setLocation(e.target.value)} />
              </label>
              <label className="text-sm text-gray-300">Start Time
                <input type="datetime-local" className="mt-1 w-full rounded-lg bg-black/20 border border-white/10 p-2 text-white outline-none" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </label>
              <label className="text-sm text-gray-300">End Time
                <input type="datetime-local" className="mt-1 w-full rounded-lg bg-black/20 border border-white/10 p-2 text-white outline-none" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </label>
              <label className="text-sm text-gray-300">Hours
                <input type="number" step="0.5" className="mt-1 w-full rounded-lg bg-black/20 border border-white/10 p-2 text-white outline-none" value={hours} onChange={(e) => setHours(Number(e.target.value))} />
              </label>
              <label className="text-sm text-gray-300">Max Students
                <input type="number" className="mt-1 w-full rounded-lg bg-black/20 border border-white/10 p-2 text-white outline-none" value={maxStudents} onChange={(e) => setMaxStudents(Number(e.target.value))} />
              </label>
              <label className="text-sm text-gray-300">PIN Expiry (minutes)
                <input type="number" className="mt-1 w-full rounded-lg bg-black/20 border border-white/10 p-2 text-white outline-none" value={expiryMinutes} onChange={(e) => setExpiryMinutes(Number(e.target.value))} />
              </label>
              <label className="text-sm text-gray-300">PIN Regen Limit
                <input type="number" className="mt-1 w-full rounded-lg bg-black/20 border border-white/10 p-2 text-white outline-none" value={regenLimit} onChange={(e) => setRegenLimit(Number(e.target.value))} />
              </label>
            </div>
            <button onClick={createSession} disabled={loading}
              className="mt-5 w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors">
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
                        <div className="text-4xl font-bold tracking-widest font-mono">{session.pin}</div>
                        <div className="mt-1 text-sm text-gray-400">Expires in: <span className="text-white font-medium">{expiresIn ?? "-"}s</span></div>
                        <div className="mt-1 text-xs text-gray-400">{session.module_code} • {session.batch} • {session.location}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-gray-300 text-sm">Remaining Slots</div>
                        <div className="text-3xl font-bold">{session.remaining_slots}</div>
                        <div className="mt-1 text-sm text-gray-400">Regen left: <span className="text-white">{session.regen_left}</span></div>
                      </div>
                    </div>
                    <button onClick={regeneratePin} disabled={session.regen_left <= 0}
                      className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-2 font-semibold hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                      {session.regen_left <= 0 ? "Regeneration Limit Reached" : "Regenerate PIN"}
                    </button>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="font-semibold">Live Check Ins ({presentCount})</div>
                      <div className="flex items-center gap-2">
                        {pollingIntervalRef.current && (
                          <span className="text-xs text-emerald-400 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>Live
                          </span>
                        )}
                        <button onClick={() => activeSessionId && loadDetail(activeSessionId)}
                          className="rounded-lg bg-white/10 px-3 py-1 text-sm hover:bg-white/15 transition-colors">
                          Refresh
                        </button>
                      </div>
                    </div>

                    <div className="max-h-[280px] overflow-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="text-gray-300 sticky top-0 bg-gray-900 z-10">
                          <tr className="border-b border-white/10">
                            <th className="py-2 px-2">Photo</th>
                            <th className="py-2 px-2">ID Number</th>
                            <th className="py-2 px-2">Name</th>
                            <th className="py-2 px-2">Module</th>
                            <th className="py-2 px-2">Marked At</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail?.attendance?.length ? (
                            detail.attendance.map((a) => {
                              const profilePicUrl = getProfilePictureUrl(a);
                              return (
                                <tr key={a.student_id} className="border-b border-white/5 hover:bg-white/5">
                                  <td className="py-2 px-2">
                                    <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-700">
                                      {profilePicUrl ? (
                                        <img src={profilePicUrl} alt="profile"
                                          className="w-full h-full object-cover"
                                          onError={(e) => { (e.target as HTMLImageElement).src = "https://via.placeholder.com/40?text=?"; }} />
                                      ) : (
                                        <div className="w-full h-full bg-gray-700 flex items-center justify-center text-gray-400 font-medium">
                                          {(a.full_name || a.student_id).charAt(0).toUpperCase()}
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-2 px-2">{a.student_id}</td>
                                  <td className="py-2 px-2">{a.full_name || a.student_name || "-"}</td>
                                  <td className="py-2 px-2 font-mono text-xs text-emerald-400">{a.module_code || session.module_code}</td>
                                  <td className="py-2 px-2 text-xs">{formatTime(a.marked_at)}</td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={5} className="py-8 text-center text-gray-500">No check-ins yet...</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Student Attendance Lookup */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="mb-4 flex items-center justify-between gap-4 flex-wrap">
                <h2 className="text-lg font-semibold">Student Attendance Lookup</h2>
                <div className="relative w-full max-w-[360px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input value={search} onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by ID or name..."
                    className="w-full bg-black/30 border border-gray-700 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-emerald-500/50 transition-colors" />
                </div>
              </div>

              <div className="max-h-[400px] overflow-auto rounded-xl border border-gray-700 bg-black/30">
                <table className="w-full text-left text-sm">
                  <thead className="text-gray-300 sticky top-0 bg-gray-900 z-10">
                    <tr className="border-b border-gray-700">
                      <th className="py-3 px-4">Photo</th>
                      <th className="py-3 px-4">Student</th>
                      <th className="py-3 px-4">ID Number</th>
                      <th className="py-3 px-4">Module</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {session ? (
                      filteredStudents.length > 0 ? (
                        filteredStudents.map((s) => {
                          const entry = presentMap.get(s.student_id);
                          const profilePicUrl = s.profile_picture_url ? `${API}${s.profile_picture_url}` : null;

                          return (
                            <tr key={s.student_id} className="border-b border-gray-800 hover:bg-gray-800/50">
                              <td className="py-3 px-4">
                                <div className="w-12 h-12 rounded-full overflow-hidden border border-gray-700">
                                  {profilePicUrl ? (
                                    <img src={profilePicUrl} alt={s.student_name}
                                      className="w-full h-full object-cover"
                                      onError={(e) => { (e.target as HTMLImageElement).src = "https://via.placeholder.com/48?text=?"; }} />
                                  ) : (
                                    <div className="w-full h-full bg-gray-700 flex items-center justify-center text-gray-400 font-medium">
                                      {s.student_name.charAt(0).toUpperCase()}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-4 font-medium">{s.student_name}</td>
                              <td className="py-3 px-4">{s.student_id}</td>
                              <td className="py-3 px-4 font-mono text-xs text-emerald-400">{s.module_code}</td>
                              <td className="py-3 px-4">
                                <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-900/40 text-emerald-300 border border-emerald-700/50">
                                  PRESENT
                                </span>
                              </td>
                              <td className="py-3 px-4 text-gray-400 text-xs">{entry ? formatTime(entry.marked_at) : "-"}</td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={6} className="py-16 text-center text-gray-500">No students have checked in yet</td>
                        </tr>
                      )
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-16 text-center text-gray-500">Create a session to view attendance</td>
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