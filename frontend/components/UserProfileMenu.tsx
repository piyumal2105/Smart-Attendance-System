"use client";

import { useAuth } from "@/context/AuthContext";
import { LogOut, User as UserIcon, Settings } from "lucide-react";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";

export default function UserProfileMenu() {
    const { user, logout } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close menu when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    if (!user) return null;

    // Get display name based on role and profile
    const displayName = user.student_profile?.full_name || user.teacher_profile?.full_name || user.username;
    const initial = displayName.charAt(0).toUpperCase();

    // Profile picture URL
    const profilePicUrl = `http://localhost:8000/api/auth/users/${user.id}/profile-picture`;

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-3 focus:outline-none"
            >
                <div className="text-right hidden sm:block">
                    <p className="text-sm font-medium text-white">{displayName}</p>
                    <p className="text-xs text-gray-400 capitalize">{user.role}</p>
                </div>
                <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-700 border-2 border-gray-600 hover:border-blue-500 transition-colors">
                    <img
                        src={profilePicUrl}
                        alt={displayName}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                            // Fallback to initial if image fails to load
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                        }}
                    />
                    {/* Fallback Initial */}
                    <div className="hidden w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-600 to-purple-600 text-white font-bold text-lg">
                        {initial}
                    </div>
                </div>
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-gray-800 rounded-xl shadow-lg border border-gray-700 py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-4 py-3 border-b border-gray-700 sm:hidden">
                        <p className="text-sm font-medium text-white">{displayName}</p>
                        <p className="text-xs text-gray-400 capitalize">{user.role}</p>
                    </div>

                    <Link
                        href="/profile"
                        onClick={() => setIsOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                    >
                        <UserIcon size={16} />
                        My Profile
                    </Link>

                    <button
                        onClick={() => {
                            setIsOpen(false);
                            logout();
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-gray-700 hover:text-red-300 transition-colors"
                    >
                        <LogOut size={16} />
                        Logout
                    </button>
                </div>
            )}
        </div>
    );
}
