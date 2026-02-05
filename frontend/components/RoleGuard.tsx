"use client";

import { useAuth, UserRole } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface RoleGuardProps {
    children: React.ReactNode;
    allowedRoles: UserRole[];
}

export default function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
    const { user, isLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading) {
            if (!user) {
                router.push("/login");
            } else if (!allowedRoles.includes(user.role)) {
                // Redirect to their own dashboard if they try to access another role's page
                if (user.role === UserRole.TEACHER) {
                    router.push("/teacher/dashboard");
                } else if (user.role === UserRole.STUDENT) {
                    router.push("/student/dashboard");
                } else if (user.role === UserRole.ADMIN) {
                    router.push("/admin/dashboard");
                } else {
                    router.push("/");
                }
            }
        }
    }, [user, isLoading, router, allowedRoles]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="text-white text-lg animate-pulse">Checking permissions...</div>
            </div>
        );
    }

    if (!user || !allowedRoles.includes(user.role)) {
        return null; // Don't render anything while redirecting
    }

    return <>{children}</>;
}
