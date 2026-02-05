"use client";

import React from "react";
import Sidebar from "@/components/teacher/Sidebar";
import RoleGuard from "@/components/RoleGuard";
import TeacherHeader from "@/components/teacher/TeacherHeader";
import { UserRole } from "@/context/AuthContext";

export default function TeacherLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <RoleGuard allowedRoles={[UserRole.TEACHER, UserRole.ADMIN]}>
            <div className="flex h-screen bg-gray-900 text-white overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col overflow-hidden bg-gray-900">
                    <TeacherHeader />
                    <div className="flex-1 overflow-auto">
                        {children}
                    </div>
                </div>
            </div>
        </RoleGuard>
    );
}
