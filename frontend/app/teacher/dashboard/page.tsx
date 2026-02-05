"use client";

import { useAuth, UserRole } from "@/context/AuthContext";
import Link from "next/link";
import { Users, ClipboardCheck, TrendingUp, Activity, ArrowRight, Video } from "lucide-react";

export default function TeacherDashboard() {
    const { user } = useAuth();

    const modules = [
        {
            title: "Classroom Engagement",
            description: "Real-time AI monitoring of student attention and behavior.",
            icon: <Users className="w-8 h-8 text-blue-400" />,
            href: "/teacher/engagement",
            color: "blue"
        },
        {
            title: "Smart Attendance",
            description: "Automated attendance tracking using face recognition.",
            icon: <ClipboardCheck className="w-8 h-8 text-green-400" />,
            href: "/teacher/attendance",
            color: "green"
        },
        {
            title: "Class Performance",
            description: "Analyze academic performance and engagement trends.",
            icon: <TrendingUp className="w-8 h-8 text-purple-400" />,
            href: "/teacher/performance",
            color: "purple"
        },
        {
            title: "Teacher Behavior",
            description: "Analyze your own teaching patterns and effectiveness.",
            icon: <Video className="w-8 h-8 text-amber-400" />,
            href: "/teacher/teacher_behavior",
            color: "amber"
        },
    ];

    return (
        <div className="p-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">
                    Welcome back, {user?.username || "Teacher"}
                </h1>
                <p className="text-slate-400">
                    Here is what's happening in your classroom today.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {modules.map((module) => (
                    <Link
                        key={module.href}
                        href={module.href}
                        className="group bg-slate-800 border border-slate-700 rounded-xl p-6 hover:bg-slate-750 hover:border-slate-600 transition-all duration-300 relative overflow-hidden"
                    >
                        <div className={`absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity bg-${module.color}-500 blur-2xl w-32 h-32 rounded-full -mr-10 -mt-10`}></div>

                        <div className="relative z-10">
                            <div className="bg-slate-900/50 p-3 rounded-lg w-fit mb-4">
                                {module.icon}
                            </div>

                            <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-blue-400 transition-colors">
                                {module.title}
                            </h3>

                            <p className="text-slate-400 mb-6 text-sm h-10">
                                {module.description}
                            </p>

                            <span className="flex items-center text-sm font-medium text-slate-300 group-hover:text-white transition-colors">
                                Launch Module <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </span>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
