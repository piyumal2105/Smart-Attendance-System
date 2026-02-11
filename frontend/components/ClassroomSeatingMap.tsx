"use client";

import { useMemo } from "react";
import { User, UserCheck, UserX } from "lucide-react";

type AttendanceItem = {
    student_id: string;
    student_name?: string;
    full_name?: string;
    profile_picture_url?: string;
    selfie_base64?: string;
    marked_at: string;
};

type ClassroomSeatingMapProps = {
    totalStudents: number;
    attendedStudents: AttendanceItem[];
    rows?: number;
    columns?: number;
    apiBaseUrl?: string;
};

export default function ClassroomSeatingMap({
    totalStudents,
    attendedStudents,
    rows = 6,
    columns = 10,
    apiBaseUrl = "http://localhost:8000",
}: ClassroomSeatingMapProps) {

    // Calculate total seats
    const totalSeats = rows * columns;

    // Create a map of attended student IDs for quick lookup
    const attendedMap = useMemo(() => {
        const map = new Map<string, AttendanceItem>();
        attendedStudents.forEach((student) => {
            map.set(student.student_id, student);
        });
        return map;
    }, [attendedStudents]);

    // Generate seat grid
    const seats = useMemo(() => {
        const seatGrid: (AttendanceItem | null)[] = [];

        // Fill attended students first
        attendedStudents.forEach((student) => {
            seatGrid.push(student);
        });

        // Fill remaining seats with null (empty seats)
        const remainingSeats = Math.min(totalSeats, totalStudents) - attendedStudents.length;
        for (let i = 0; i < remainingSeats; i++) {
            seatGrid.push(null);
        }

        return seatGrid;
    }, [attendedStudents, totalSeats, totalStudents]);

    // Get profile picture URL
    const getProfilePictureUrl = (student: AttendanceItem | null) => {
        if (!student) return null;
        if (student.profile_picture_url) {
            return `${apiBaseUrl}${student.profile_picture_url}`;
        }
        if (student.selfie_base64) {
            return student.selfie_base64;
        }
        return null;
    };

    // Render individual seat
    const renderSeat = (student: AttendanceItem | null, index: number) => {
        const isPresent = student !== null;
        const profilePicUrl = getProfilePictureUrl(student);
        const studentName = student?.full_name || student?.student_name || student?.student_id || "";

        return (
            <div
                key={index}
                className={`
          relative aspect-square rounded-lg border-2 transition-all duration-300
          ${isPresent
                        ? 'border-emerald-500/50 bg-emerald-500/20 hover:border-emerald-400 hover:scale-105'
                        : 'border-gray-700/50 bg-gray-800/30 hover:border-gray-600'
                    }
          group cursor-pointer
        `}
                title={isPresent ? studentName : "Empty seat"}
            >
                {/* Seat content */}
                <div className="absolute inset-0 flex items-center justify-center p-1">
                    {isPresent ? (
                        <>
                            {profilePicUrl ? (
                                <img
                                    src={profilePicUrl}
                                    alt={studentName}
                                    className="w-full h-full rounded-md object-cover"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = 'https://via.placeholder.com/40?text=?';
                                    }}
                                />
                            ) : (
                                <div className="w-full h-full rounded-md bg-emerald-600 flex items-center justify-center text-white font-bold text-xs">
                                    {studentName.charAt(0).toUpperCase()}
                                </div>
                            )}
                            {/* Present indicator */}
                            <div className="absolute -top-1 -right-1 bg-emerald-500 rounded-full p-0.5">
                                <UserCheck size={8} className="text-white" />
                            </div>
                        </>
                    ) : (
                        <div className="w-full h-full rounded-md bg-gray-700/20 flex items-center justify-center">
                            <UserX size={12} className="text-gray-500" />
                        </div>
                    )}
                </div>

                {/* Tooltip on hover */}
                {isPresent && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                        {studentName}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                    </div>
                )}
            </div>
        );
    };

    // Calculate stats
    const presentCount = attendedStudents.length;
    const absentCount = totalStudents - presentCount;
    const attendanceRate = totalStudents > 0 ? ((presentCount / totalStudents) * 100).toFixed(1) : 0;

    return (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            {/* Header */}
            <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <User size={18} className="text-emerald-400" />
                    Classroom Seating Map
                </h3>
                <div className="text-sm text-gray-400">
                    {presentCount}/{totalStudents} Present ({attendanceRate}%)
                </div>
            </div>

            {/* Legend */}
            <div className="mb-4 flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded border-2 border-emerald-500/50 bg-emerald-500/20"></div>
                    <span className="text-gray-400">Present ({presentCount})</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded border-2 border-gray-700/50 bg-gray-800/30"></div>
                    <span className="text-gray-400">Absent ({absentCount})</span>
                </div>
            </div>

            {/* Classroom layout */}
            <div className="relative">
                {/* Teacher's desk indicator */}
                <div className="mb-3 flex justify-center">
                    <div className="px-4 py-1.5 bg-blue-600/20 border border-blue-500/50 rounded-lg text-xs text-blue-300 font-medium">
                        Teacher's Desk
                    </div>
                </div>

                {/* Seating grid */}
                <div
                    className="grid gap-2"
                    style={{
                        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                        gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`
                    }}
                >
                    {seats.slice(0, totalSeats).map((student, index) => renderSeat(student, index))}
                </div>

                {/* Bottom info */}
                <div className="mt-3 text-center text-xs text-gray-500">
                    {rows} rows × {columns} columns = {totalSeats} seats
                </div>
            </div>

            {/* Stats bar */}
            <div className="mt-4 pt-4 border-t border-white/10">
                <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span className="text-gray-400">Real-time updates</span>
                    </div>
                    <div className="text-gray-400">
                        Last updated: {new Date().toLocaleTimeString()}
                    </div>
                </div>
            </div>
        </div>
    );
}