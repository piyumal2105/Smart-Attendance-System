"use client";

import { useAuth } from "@/context/AuthContext";
import { Users, GraduationCap, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import UserProfileMenu from "../UserProfileMenu";

export default function TeacherHeader() {
    const { user } = useAuth();

    return (
        <header className="bg-gray-800 border-b border-gray-700 px-8 py-4 flex justify-between items-center sticky top-0 z-40 shadow-sm">
            <div className="flex items-center gap-3">
                <Link href="/teacher/dashboard" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-2.5 rounded-xl text-white">
                        <Users size={22} />
                    </div>
                    <div>
                        <h1 className="font-bold text-lg text-white">Teacher Portal</h1>
                        <p className="text-xs text-gray-400">Classroom Management</p>
                    </div>
                </Link>
            </div>

            <div className="flex items-center gap-6">
                {/* Navigation Links can go here */}

                <UserProfileMenu />
            </div>
        </header>
    );
}
