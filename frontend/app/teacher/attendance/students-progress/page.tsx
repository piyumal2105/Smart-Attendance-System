"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
    ArrowLeft,
    AlertTriangle,
    Users,
    BookOpen,
    TrendingUp,
    TrendingDown,
    RefreshCw,
    ChevronDown,
    ChevronUp,
    Search,
    ShieldAlert,
    CheckCircle2,
    Clock,
    GraduationCap,
    Flame,
    Star,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

/* ─────────────── Types ─────────────── */
type StudentStat = {
    student_id: string;
    full_name: string;
    profile_picture_url: string | null;
    attended_sessions: number;
    total_sessions: number;
    attendance_percentage: number;
    at_risk: boolean;
    sessions_needed_for_80: number;
    last_attendance: string | null;
};

type ModuleProgress = {
    module_code: string;
    module_name: string;
    total_sessions: number;
    total_students: number;
    students_at_risk: number;
    average_attendance_percentage: number;
    students: StudentStat[];
};

type ProgressData = {
    teacher_id: number;
    modules: ModuleProgress[];
    total_modules: number;
    total_students_at_risk: number;
    message?: string;
};

/* ─────────────── Helpers ─────────────── */
function getRiskTier(pct: number): "critical" | "warning" | "safe" {
    if (pct < 60) return "critical";
    if (pct < 80) return "warning";
    return "safe";
}

function formatLastSeen(iso: string | null): string {
    if (!iso) return "Never";
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
}

/* ─────────────── Mini Arc Chart ─────────────── */
function ArcChart({ pct, size = 64 }: { pct: number; size?: number }) {
    const tier = getRiskTier(pct);
    const r = size / 2 - 6;
    const circ = 2 * Math.PI * r;
    const dash = (pct / 100) * circ;
    const color =
        tier === "critical"
            ? "#ef4444"
            : tier === "warning"
                ? "#f59e0b"
                : "#10b981";

    return (
        <svg width={size} height={size} className="rotate-[-90deg]">
            <circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke="rgba(255,255,255,0.07)"
                strokeWidth={5}
            />
            <circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={color}
                strokeWidth={5}
                strokeDasharray={`${dash} ${circ - dash}`}
                strokeLinecap="round"
                style={{ transition: "stroke-dasharray 0.6s ease" }}
            />
        </svg>
    );
}

/* ─────────────── Student Row ─────────────── */
function StudentRow({ s, api }: { s: StudentStat; api: string }) {
    const tier = getRiskTier(s.attendance_percentage);
    const barColor =
        tier === "critical"
            ? "bg-red-500"
            : tier === "warning"
                ? "bg-amber-400"
                : "bg-emerald-500";

    return (
        <div
            className={`
        relative flex items-center gap-4 px-4 py-3 rounded-xl border transition-all duration-200
        hover:scale-[1.01] hover:shadow-lg
        ${tier === "critical"
                    ? "bg-red-950/40 border-red-800/40 hover:border-red-600/50"
                    : tier === "warning"
                        ? "bg-amber-950/30 border-amber-700/30 hover:border-amber-500/40"
                        : "bg-gray-800/40 border-gray-700/30 hover:border-gray-600/40"
                }
      `}
        >
            {/* Avatar */}
            <div className="relative flex-shrink-0">
                <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-gray-700/60">
                    {s.profile_picture_url ? (
                        <img
                            src={`${api}${s.profile_picture_url}`}
                            alt={s.full_name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                                (e.target as HTMLImageElement).style.display = "none";
                            }}
                        />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center text-white font-bold text-sm">
                            {s.full_name?.charAt(0)?.toUpperCase() ?? "?"}
                        </div>
                    )}
                </div>
                {tier === "critical" && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-[8px] font-bold">!</span>
                    </div>
                )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-white truncate">{s.full_name}</p>
                    <span className="text-xs text-gray-500 font-mono shrink-0">{s.student_id}</span>
                </div>
                {/* Bar */}
                <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-700/60 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full ${barColor} transition-all duration-700`}
                            style={{ width: `${Math.min(100, s.attendance_percentage)}%` }}
                        />
                    </div>
                    <span className="text-xs text-gray-400 tabular-nums shrink-0">
                        {s.attended_sessions}/{s.total_sessions}
                    </span>
                </div>
            </div>

            {/* Percentage + last seen */}
            <div className="flex-shrink-0 text-right">
                <div
                    className={`text-lg font-bold tabular-nums ${tier === "critical"
                            ? "text-red-400"
                            : tier === "warning"
                                ? "text-amber-400"
                                : "text-emerald-400"
                        }`}
                >
                    {s.attendance_percentage.toFixed(0)}%
                </div>
                <div className="text-[10px] text-gray-500 mt-0.5">
                    {formatLastSeen(s.last_attendance)}
                </div>
            </div>

            {/* Risk badge */}
            {s.at_risk && (
                <div className="flex-shrink-0">
                    {tier === "critical" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-red-600/90 text-white px-2 py-0.5 rounded-full">
                            <Flame size={9} /> Critical
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-amber-500/90 text-black px-2 py-0.5 rounded-full">
                            <AlertTriangle size={9} /> At Risk
                        </span>
                    )}
                    <p className="text-[10px] text-gray-400 text-right mt-1">
                        Need {s.sessions_needed_for_80} more
                    </p>
                </div>
            )}

            {!s.at_risk && (
                <div className="flex-shrink-0">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-emerald-600/30 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-700/40">
                        <CheckCircle2 size={9} /> Good
                    </span>
                </div>
            )}
        </div>
    );
}

/* ─────────────── Module Card ─────────────── */
function ModuleCard({
    mod,
    api,
    defaultOpen,
}: {
    mod: ModuleProgress;
    api: string;
    defaultOpen: boolean;
}) {
    const [open, setOpen] = useState(defaultOpen);
    const [search, setSearch] = useState("");

    const filtered = useMemo(() => {
        const q = search.toLowerCase().trim();
        if (!q) return mod.students;
        return mod.students.filter(
            (s) =>
                s.full_name.toLowerCase().includes(q) ||
                s.student_id.toLowerCase().includes(q)
        );
    }, [mod.students, search]);

    const hasCritical = mod.students.some((s) => s.attendance_percentage < 60);
    const hasWarning = mod.students_at_risk > 0;
    const allGood = !hasWarning;

    const avgTier = getRiskTier(mod.average_attendance_percentage);

    const headerGrad =
        hasCritical
            ? "from-red-900/30 to-gray-900/10 border-red-700/30"
            : hasWarning
                ? "from-amber-900/20 to-gray-900/10 border-amber-700/20"
                : "from-emerald-900/15 to-gray-900/10 border-emerald-700/20";

    return (
        <div
            className={`rounded-2xl border bg-gradient-to-br ${headerGrad} overflow-hidden shadow-xl`}
        >
            {/* Header */}
            <button
                onClick={() => setOpen((v) => !v)}
                className="w-full text-left p-5 hover:bg-white/[0.03] transition-colors"
            >
                <div className="flex items-start gap-4">
                    {/* Arc */}
                    <div className="relative flex-shrink-0 flex items-center justify-center">
                        <ArcChart pct={mod.average_attendance_percentage} size={64} />
                        <span
                            className={`absolute text-xs font-bold tabular-nums ${avgTier === "critical"
                                    ? "text-red-400"
                                    : avgTier === "warning"
                                        ? "text-amber-400"
                                        : "text-emerald-400"
                                }`}
                        >
                            {mod.average_attendance_percentage.toFixed(0)}%
                        </span>
                    </div>

                    {/* Module info */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-lg font-black text-white tracking-tight">
                                {mod.module_code}
                            </span>
                            {hasCritical && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase bg-red-600 text-white px-2 py-0.5 rounded-full animate-pulse">
                                    <Flame size={9} /> Critical Students
                                </span>
                            )}
                            {!hasCritical && hasWarning && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase bg-amber-500 text-black px-2 py-0.5 rounded-full">
                                    <AlertTriangle size={9} /> {mod.students_at_risk} At Risk
                                </span>
                            )}
                            {allGood && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase bg-emerald-600/40 text-emerald-300 border border-emerald-600/40 px-2 py-0.5 rounded-full">
                                    <Star size={9} /> All Good
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-gray-400 truncate mb-2">{mod.module_name}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                                <BookOpen size={11} />
                                {mod.total_sessions} sessions
                            </span>
                            <span className="flex items-center gap-1">
                                <Users size={11} />
                                {mod.total_students} students
                            </span>
                            {mod.students_at_risk > 0 && (
                                <span className="flex items-center gap-1 text-amber-500">
                                    <ShieldAlert size={11} />
                                    {mod.students_at_risk} below 80%
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Chevron */}
                    <div className="flex-shrink-0 mt-1 text-gray-500">
                        {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                </div>
            </button>

            {/* Expandable student list */}
            {open && (
                <div className="border-t border-white/[0.06] px-5 pb-5 pt-4">
                    {/* Alert Banner */}
                    {mod.students_at_risk > 0 && (
                        <div
                            className={`mb-4 rounded-xl p-3.5 flex items-start gap-3 ${hasCritical
                                    ? "bg-red-950/60 border border-red-700/40"
                                    : "bg-amber-950/50 border border-amber-700/30"
                                }`}
                        >
                            <AlertTriangle
                                size={16}
                                className={hasCritical ? "text-red-400 mt-0.5 shrink-0" : "text-amber-400 mt-0.5 shrink-0"}
                            />
                            <div>
                                <p
                                    className={`text-xs font-semibold ${hasCritical ? "text-red-300" : "text-amber-300"
                                        }`}
                                >
                                    {hasCritical
                                        ? `${mod.students.filter((s) => s.attendance_percentage < 60).length} student(s) are critically low — below 60% attendance`
                                        : `${mod.students_at_risk} student(s) are below the required 80% attendance threshold`}
                                </p>
                                <p className="text-[11px] text-gray-400 mt-0.5">
                                    These students may face academic penalties if attendance does not improve.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Search */}
                    {mod.total_students > 5 && (
                        <div className="relative mb-3">
                            <Search
                                size={13}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                            />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search students…"
                                className="w-full bg-gray-900/60 border border-gray-700/60 rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-gray-600 outline-none focus:border-gray-500 transition-colors"
                            />
                        </div>
                    )}

                    {/* Summary strip */}
                    <div className="grid grid-cols-3 gap-2 mb-4">
                        <div className="bg-gray-900/40 rounded-lg p-2.5 text-center border border-gray-700/30">
                            <div className="text-lg font-bold text-white">{mod.total_students}</div>
                            <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">
                                Total
                            </div>
                        </div>
                        <div className="bg-emerald-950/40 rounded-lg p-2.5 text-center border border-emerald-700/20">
                            <div className="text-lg font-bold text-emerald-400">
                                {mod.total_students - mod.students_at_risk}
                            </div>
                            <div className="text-[10px] text-emerald-600 uppercase tracking-wider mt-0.5">
                                On Track
                            </div>
                        </div>
                        <div
                            className={`rounded-lg p-2.5 text-center border ${mod.students_at_risk > 0
                                    ? "bg-red-950/40 border-red-700/20"
                                    : "bg-gray-900/40 border-gray-700/30"
                                }`}
                        >
                            <div
                                className={`text-lg font-bold ${mod.students_at_risk > 0 ? "text-red-400" : "text-gray-500"
                                    }`}
                            >
                                {mod.students_at_risk}
                            </div>
                            <div
                                className={`text-[10px] uppercase tracking-wider mt-0.5 ${mod.students_at_risk > 0 ? "text-red-600" : "text-gray-600"
                                    }`}
                            >
                                At Risk
                            </div>
                        </div>
                    </div>

                    {/* Student rows */}
                    <div className="space-y-2">
                        {filtered.length === 0 ? (
                            <p className="text-center text-sm text-gray-600 py-4">
                                No students match your search
                            </p>
                        ) : (
                            filtered.map((s) => <StudentRow key={s.student_id} s={s} api={api} />)
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

/* ─────────────── Main Page ─────────────── */
export default function TeacherStudentsProgressPage() {
    const [data, setData] = useState<ProgressData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [globalSearch, setGlobalSearch] = useState("");
    const [filterMode, setFilterMode] = useState<"all" | "at_risk" | "good">("all");

    const fetchProgress = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API}/api/attendance/teacher/students-progress`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            setData(json);
        } catch (e: any) {
            setError(e.message || "Failed to load data");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchProgress();
    }, [fetchProgress]);

    // Filter modules based on search + mode
    const filteredModules = useMemo(() => {
        if (!data) return [];
        let mods = data.modules;

        if (filterMode === "at_risk") mods = mods.filter((m) => m.students_at_risk > 0);
        else if (filterMode === "good") mods = mods.filter((m) => m.students_at_risk === 0);

        if (globalSearch.trim()) {
            const q = globalSearch.toLowerCase();
            mods = mods.filter(
                (m) =>
                    m.module_code.toLowerCase().includes(q) ||
                    m.module_name.toLowerCase().includes(q) ||
                    m.students.some(
                        (s) =>
                            s.full_name.toLowerCase().includes(q) ||
                            s.student_id.toLowerCase().includes(q)
                    )
            );
        }
        return mods;
    }, [data, filterMode, globalSearch]);

    const totalAtRisk = data?.total_students_at_risk ?? 0;
    const totalModules = data?.total_modules ?? 0;

    return (
        <div className="min-h-screen bg-gray-950 text-white">
            {/* Header */}
            <header className="h-16 bg-gray-900/90 backdrop-blur border-b border-gray-800/80 flex items-center justify-between px-6 sticky top-0 z-20">
                <div className="flex items-center gap-4">
                    <Link
                        href="/teacher/attendance"
                        className="text-gray-400 hover:text-white transition-colors p-2 rounded-full hover:bg-gray-800"
                    >
                        <ArrowLeft size={20} />
                    </Link>
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center">
                            <GraduationCap size={16} className="text-indigo-400" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-white leading-none">
                                Student Attendance Progress
                            </h2>
                            <p className="text-[10px] text-gray-500 mt-0.5">Across all your modules</p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {totalAtRisk > 0 && (
                        <div className="flex items-center gap-2 bg-red-950/60 border border-red-700/40 px-3 py-1.5 rounded-full">
                            <ShieldAlert size={14} className="text-red-400" />
                            <span className="text-xs font-semibold text-red-300">
                                {totalAtRisk} student{totalAtRisk !== 1 ? "s" : ""} at risk
                            </span>
                        </div>
                    )}
                    <button
                        onClick={fetchProgress}
                        disabled={loading}
                        className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-gray-800 transition-colors disabled:opacity-40"
                    >
                        <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                    </button>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-6 py-8">
                {/* Top alert banner */}
                {!loading && totalAtRisk > 0 && (
                    <div className="mb-8 rounded-2xl border border-red-700/30 bg-gradient-to-r from-red-950/60 to-gray-900/40 p-5 flex items-start gap-4 shadow-xl shadow-red-950/20">
                        <div className="w-12 h-12 rounded-xl bg-red-600/20 border border-red-600/30 flex items-center justify-center shrink-0 mt-0.5">
                            <TrendingDown size={24} className="text-red-400" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-red-200 text-base mb-1 flex items-center gap-2">
                                <Flame size={16} className="text-red-400" />
                                Attendance Alert — Immediate Attention Required
                            </h3>
                            <p className="text-sm text-red-300/80">
                                <span className="font-bold text-red-200">{totalAtRisk}</span> student
                                {totalAtRisk !== 1 ? "s are" : " is"} currently below the 80% attendance threshold
                                across{" "}
                                <span className="font-bold text-red-200">
                                    {data?.modules.filter((m) => m.students_at_risk > 0).length}
                                </span>{" "}
                                module{data?.modules.filter((m) => m.students_at_risk > 0).length !== 1 ? "s" : ""}
                                . These students risk academic penalties or exam ineligibility.
                            </p>
                            <div className="mt-3 flex gap-2 flex-wrap">
                                {data?.modules
                                    .filter((m) => m.students_at_risk > 0)
                                    .map((m) => (
                                        <span
                                            key={m.module_code}
                                            className="text-xs bg-red-900/50 border border-red-700/40 text-red-300 px-2.5 py-1 rounded-full"
                                        >
                                            {m.module_code} — {m.students_at_risk} student{m.students_at_risk !== 1 ? "s" : ""}
                                        </span>
                                    ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Summary cards */}
                {!loading && data && data.total_modules > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
                        <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
                            <div className="text-2xl font-black text-white">{totalModules}</div>
                            <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                <BookOpen size={11} /> Modules
                            </div>
                        </div>
                        <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
                            <div className="text-2xl font-black text-white">
                                {data.modules.reduce((acc, m) => acc + m.total_students, 0)}
                            </div>
                            <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                <Users size={11} /> Total Students
                            </div>
                        </div>
                        <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
                            <div className="text-2xl font-black text-emerald-400">
                                {data.modules.reduce((acc, m) => acc + m.total_students, 0) - totalAtRisk}
                            </div>
                            <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                <TrendingUp size={11} className="text-emerald-500" /> On Track
                            </div>
                        </div>
                        <div
                            className={`rounded-xl border p-4 ${totalAtRisk > 0
                                    ? "bg-red-950/40 border-red-800/50"
                                    : "bg-gray-900 border-gray-800"
                                }`}
                        >
                            <div
                                className={`text-2xl font-black ${totalAtRisk > 0 ? "text-red-400" : "text-gray-600"
                                    }`}
                            >
                                {totalAtRisk}
                            </div>
                            <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                <ShieldAlert size={11} className={totalAtRisk > 0 ? "text-red-500" : ""} />
                                At Risk
                            </div>
                        </div>
                    </div>
                )}

                {/* Controls */}
                {!loading && data && data.total_modules > 0 && (
                    <div className="flex items-center gap-3 flex-wrap mb-6">
                        {/* Filter tabs */}
                        <div className="flex bg-gray-900 border border-gray-800 rounded-xl p-1 gap-1">
                            {(["all", "at_risk", "good"] as const).map((mode) => (
                                <button
                                    key={mode}
                                    onClick={() => setFilterMode(mode)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${filterMode === mode
                                            ? "bg-gray-700 text-white shadow"
                                            : "text-gray-500 hover:text-gray-300"
                                        }`}
                                >
                                    {mode === "all"
                                        ? "All Modules"
                                        : mode === "at_risk"
                                            ? `⚠ At Risk (${data.modules.filter((m) => m.students_at_risk > 0).length})`
                                            : `✓ All Good (${data.modules.filter((m) => m.students_at_risk === 0).length})`}
                                </button>
                            ))}
                        </div>

                        {/* Global search */}
                        <div className="relative flex-1 max-w-xs">
                            <Search
                                size={13}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600"
                            />
                            <input
                                value={globalSearch}
                                onChange={(e) => setGlobalSearch(e.target.value)}
                                placeholder="Search module or student…"
                                className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-gray-600 outline-none focus:border-gray-600 transition-colors"
                            />
                        </div>
                    </div>
                )}

                {/* Loading */}
                {loading && (
                    <div className="flex flex-col items-center justify-center py-24">
                        <div className="w-12 h-12 rounded-full border-2 border-indigo-500/40 border-t-indigo-500 animate-spin mb-4" />
                        <p className="text-sm text-gray-500">Loading student progress…</p>
                    </div>
                )}

                {/* Error */}
                {!loading && error && (
                    <div className="rounded-2xl border border-red-700/40 bg-red-950/30 p-6 text-center">
                        <AlertTriangle size={32} className="text-red-400 mx-auto mb-2" />
                        <p className="text-sm text-red-300">{error}</p>
                        <button
                            onClick={fetchProgress}
                            className="mt-4 px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-500"
                        >
                            Retry
                        </button>
                    </div>
                )}

                {/* Empty state */}
                {!loading && !error && data && data.total_modules === 0 && (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                        <div className="w-20 h-20 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-5">
                            <GraduationCap size={36} className="text-indigo-400" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-200 mb-2">No sessions yet</h3>
                        <p className="text-sm text-gray-500 max-w-sm">
                            Once you create attendance sessions, student progress will appear here per module.
                        </p>
                        <Link
                            href="/teacher/attendance"
                            className="mt-6 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 transition-colors"
                        >
                            Create a Session
                        </Link>
                    </div>
                )}

                {/* No results from filter */}
                {!loading && !error && data && data.total_modules > 0 && filteredModules.length === 0 && (
                    <div className="text-center py-16 text-gray-600 text-sm">
                        No modules match your current filter or search.
                    </div>
                )}

                {/* Module cards */}
                {!loading && !error && filteredModules.length > 0 && (
                    <div className="space-y-4">
                        {filteredModules.map((mod, i) => (
                            <ModuleCard
                                key={mod.module_code}
                                mod={mod}
                                api={API}
                                defaultOpen={i === 0 || mod.students_at_risk > 0}
                            />
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}