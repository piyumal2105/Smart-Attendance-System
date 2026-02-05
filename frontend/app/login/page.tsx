"use client";

import { useState, useEffect } from "react";
import { useAuth, UserRole } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BookOpen, KeyRound, Mail, AlertCircle } from "lucide-react";

export default function LoginPage() {
    const { login } = useAuth();
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const { user } = useAuth();

    // Auto-redirect if already logged in
    useEffect(() => {
        if (user) {
            if (user.role === UserRole.TEACHER) {
                router.push("/teacher/dashboard");
            } else if (user.role === UserRole.STUDENT) {
                router.push("/student/dashboard");
            } else if (user.role === UserRole.ADMIN) {
                router.push("/admin/dashboard");
            }
        }
    }, [user, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const params = new URLSearchParams();
            // Note: Backend expects username field for OAuth2 form, but we use email as username in our logical flow
            // or we just map email to username field if backend handles it that way.
            // Based on our route implementation: user = db.query(models.User).filter(models.User.username == form_data.username).first()
            // So we need to send the username (or email if they are same).
            // Let's assume username for now, or user enters username.
            // Wait, the UI asks for Email. Let's send email as username.
            params.append("username", email);
            params.append("password", password);

            const res = await fetch("http://localhost:8000/api/auth/token", {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: params,
            });

            if (!res.ok) {
                throw new Error("Invalid credentials");
            }

            const data = await res.json();
            login(data.access_token);

            // We need to decode token or fetch user to know where to redirect.
            // AuthContext fetches user after login. We can listen to user state or
            // simplest: fetch user here immediately to decide redirect.
            const userRes = await fetch("http://localhost:8000/api/auth/users/me", {
                headers: { Authorization: `Bearer ${data.access_token}` },
            });
            const userData = await userRes.json();

            if (userData.role === UserRole.TEACHER) {
                router.push("/teacher/dashboard");
            } else if (userData.role === UserRole.STUDENT) {
                router.push("/student/dashboard");
            } else if (userData.role === UserRole.ADMIN) {
                router.push("/admin/dashboard");
            } else {
                router.push("/");
            }

        } catch (err: any) {
            setError(err.message || "Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <div className="bg-slate-800 p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-700">
                <div className="flex flex-col items-center mb-8">
                    <div className="bg-blue-600 p-3 rounded-xl mb-4">
                        <BookOpen className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-white">Welcome Back</h1>
                    <p className="text-slate-400 mt-2">Sign in to EduMonitor</p>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded-lg flex items-center gap-2 mb-6">
                        <AlertCircle className="w-5 h-5" />
                        <span className="text-sm">{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300 ml-1">Username / Email</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                            <input
                                type="text"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg py-3 pl-10 pr-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                                placeholder="Enter your username"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300 ml-1">Password</label>
                        <div className="relative">
                            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg py-3 pl-10 pr-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                                placeholder="••••••••"
                                required
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? "Signing in..." : "Sign In"}
                    </button>
                </form>

                <div className="mt-8 pt-6 border-t border-slate-700">
                    <p className="text-slate-400 text-center text-sm mb-4">Don't have an account?</p>
                    <div className="flex flex-col gap-2 items-center">
                        <Link
                            href="/register/student"
                            className="text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors"
                        >
                            Register as Student
                        </Link>
                        <Link
                            href="/register/teacher"
                            className="text-sm font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
                        >
                            Register as Teacher
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
