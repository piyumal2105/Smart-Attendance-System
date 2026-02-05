"use client";

import { useAuth } from "@/context/AuthContext";
import { GraduationCap, UserCheck, Brain, FileText } from "lucide-react";
import Link from "next/link";
import UserProfileMenu from "../UserProfileMenu";
import { useEffect, useState } from "react";

export default function StudentHeader() {
    const { user } = useAuth();
    const [contentCount, setContentCount] = useState<number | null>(null);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const response = await fetch("http://localhost:8000/api/performance/stats");
            if (response.ok) {
                const data = await response.json();
                setContentCount(data.data?.document_count ?? 0);
            }
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        }
    };

    return (
        <nav className="bg-gray-800 border-b border-gray-700 px-8 py-4 flex justify-between items-center sticky top-0 z-40 shadow-sm">
            <div className="flex items-center gap-3">
                <Link href="/student/dashboard" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
                    <div className="bg-gradient-to-r from-emerald-500 to-teal-500 p-2.5 rounded-xl text-white">
                        <GraduationCap size={22} />
                    </div>
                    <div>
                        <h1 className="font-bold text-lg text-white">Student Portal</h1>
                        <p className="text-xs text-gray-400">AI-Powered Learning</p>
                    </div>
                </Link>
            </div>

            <div className="flex items-center gap-4">
                <Link
                    href="/student/dashboard/attendance"
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium"
                >
                    <UserCheck size={16} />
                    <span className="hidden sm:inline">Attendance</span>
                </Link>

                <div className="hidden md:flex items-center gap-2 bg-gray-700/50 px-3 py-1.5 rounded-lg border border-gray-600/50">
                    <FileText size={14} className="text-emerald-400" />
                    <span className="text-sm text-gray-300">{contentCount ?? 0} content chunks</span>
                </div>

                <UserProfileMenu />
            </div>
        </nav>
    );
}
