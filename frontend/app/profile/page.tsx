"use client";

import { useAuth, UserRole } from "@/context/AuthContext";
import { User, Mail, Shield, School, Hash, Calendar, Phone, Briefcase, Award } from "lucide-react";
import RoleGuard from "@/components/RoleGuard";

export default function ProfilePage() {
    const { user } = useAuth();

    // Fallback if no user loaded (though RoleGuard should handle protection)
    if (!user) {
        return <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">Loading profile...</div>;
    }

    const ProfileField = ({ icon, label, value }: { icon: any, label: string, value: string | number | undefined }) => (
        <div className="flex items-start gap-4 p-4 bg-gray-800/50 rounded-xl border border-gray-700/50">
            <div className="p-2 bg-gray-900 rounded-lg text-blue-400">
                {icon}
            </div>
            <div>
                <p className="text-sm text-gray-400">{label}</p>
                <p className="font-medium text-white">{value || "N/A"}</p>
            </div>
        </div>
    );

    return (
        <RoleGuard allowedRoles={[UserRole.STUDENT, UserRole.TEACHER, UserRole.ADMIN]}>
            <div className="min-h-screen bg-gray-900 text-white p-8">
                <div className="max-w-4xl mx-auto">

                    {/* Header Card */}
                    <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 border border-blue-500/30 rounded-2xl p-8 mb-8 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10 bg-blue-500 blur-3xl w-64 h-64 rounded-full -mr-20 -mt-20"></div>

                        {/* Avatar */}
                        <div className="relative z-10 w-32 h-32 rounded-full ring-4 ring-blue-500/30 bg-gray-800 overflow-hidden shadow-2xl">
                            <img
                                src={`http://localhost:8000/api/auth/users/${user.id}/profile-picture`}
                                alt={user.username}
                                className="w-full h-full object-cover"
                                onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150?text=User'; }}
                            />
                        </div>

                        {/* Basic Info */}
                        <div className="relative z-10 text-center md:text-left flex-1">
                            <h1 className="text-3xl font-bold mb-2">{user.student_profile?.full_name || user.teacher_profile?.full_name || user.username}</h1>
                            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${user.role === UserRole.STUDENT ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                                        user.role === UserRole.TEACHER ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                                            'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                                    }`}>
                                    {user.role}
                                </span>
                                <span className="flex items-center gap-1.5 text-gray-400 text-sm">
                                    <Mail size={14} /> {user.email}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Detailed Info Grid */}
                    <div className="bg-gray-800 rounded-2xl border border-gray-700 p-8 shadow-xl">
                        <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                            <User className="text-blue-400" size={24} />
                            Profile Details
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Common Fields */}
                            <ProfileField icon={<Shield size={20} />} label="Username" value={user.username} />

                            {/* Student Specific Fields */}
                            {user.role === UserRole.STUDENT && user.student_profile && (
                                <>
                                    <ProfileField icon={<Hash size={20} />} label="Student ID" value={user.student_profile.student_id} />
                                    <ProfileField icon={<Calendar size={20} />} label="Age" value={user.student_profile.age} />
                                    <ProfileField icon={<User size={20} />} label="Gender" value={user.student_profile.gender} />
                                    <ProfileField icon={<Phone size={20} />} label="Phone" value={user.student_profile.phone_number} />
                                    <ProfileField icon={<School size={20} />} label="Major" value={user.student_profile.major} />
                                </>
                            )}

                            {/* Teacher Specific Fields */}
                            {user.role === UserRole.TEACHER && user.teacher_profile && (
                                <>
                                    <ProfileField icon={<Hash size={20} />} label="Teacher ID" value={user.teacher_profile.teacher_id} />
                                    <ProfileField icon={<Briefcase size={20} />} label="Position" value={user.teacher_profile.position} />
                                    <ProfileField icon={<School size={20} />} label="Department" value={user.teacher_profile.department} />
                                    <ProfileField icon={<Award size={20} />} label="Specialization" value={user.teacher_profile.specialization} />
                                    <ProfileField icon={<Calendar size={20} />} label="Experience" value={`${user.teacher_profile.years_of_experience} Years`} />
                                    <ProfileField icon={<Phone size={20} />} label="Phone" value={user.teacher_profile.phone_number} />
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </RoleGuard>
    );
}
