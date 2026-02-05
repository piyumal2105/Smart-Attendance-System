import Link from "next/link";
import { GraduationCap, Users, ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gradient-to-br from-gray-900 to-gray-800 text-white">


      <div className="text-center mb-16">
        <h1 className="text-5xl font-bold tracking-tight mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
          Smart Classroom Analytics
        </h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto">
          Advanced multi-module monitoring system for student engagement, attendance, and performance tracking.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
        {/* Teacher Card */}
        <Link
          href="/login"
          className="group relative flex flex-col items-center p-8 rounded-2xl border border-gray-700 bg-gray-800/50 hover:bg-gray-800 hover:border-blue-500 transition-all duration-300"
        >
          <div className="p-4 rounded-full bg-blue-500/10 text-blue-400 mb-6 group-hover:scale-110 transition-transform">
            <Users size={48} />
          </div>
          <h2 className="text-2xl font-semibold mb-2">Teacher Portal</h2>
          <p className="text-gray-400 text-center mb-6">
            Monitor student engagement, view class performance metrics, and track attendance.
          </p>
          <span className="flex items-center text-blue-400 font-medium group-hover:translate-x-1 transition-transform">
            Teacher Login <ArrowRight className="ml-2 w-4 h-4" />
          </span>
        </Link>

        {/* Student Card */}
        <Link
          href="/login"
          className="group relative flex flex-col items-center p-8 rounded-2xl border border-gray-700 bg-gray-800/50 hover:bg-gray-800 hover:border-emerald-500 transition-all duration-300"
        >
          <div className="p-4 rounded-full bg-emerald-500/10 text-emerald-400 mb-6 group-hover:scale-110 transition-transform">
            <GraduationCap size={48} />
          </div>
          <h2 className="text-2xl font-semibold mb-2">Student Portal</h2>
          <p className="text-gray-400 text-center mb-6">
            Access your quizzes, view personal performance summaries, and track learning progress.
          </p>
          <span className="flex items-center text-emerald-400 font-medium group-hover:translate-x-1 transition-transform">
            Student Login <ArrowRight className="ml-2 w-4 h-4" />
          </span>
        </Link>
      </div>
    </main>
  );
}
