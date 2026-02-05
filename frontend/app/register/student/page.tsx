"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function StudentRegister() {
    const router = useRouter();
    const [formData, setFormData] = useState({
        email: "",
        username: "",
        password: "",
        student_id: "",
        full_name: "",
        age: "",
        gender: "",
        phone_number: "",
        major: "",
    });
    const [file, setFile] = useState<File | null>(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        const data = new FormData();
        Object.entries(formData).forEach(([key, value]) => {
            data.append(key, value);
        });
        if (file) {
            data.append("profile_picture", file);
        }

        try {
            const res = await fetch("http://localhost:8000/api/auth/register/student", {
                method: "POST",
                body: data,
            });

            if (!res.ok) {
                const json = await res.json();
                throw new Error(json.detail || "Registration failed");
            }

            alert("Registration successful! Your account is pending admin approval.");
            router.push("/login");
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
            <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-full max-w-2xl">
                <h2 className="text-3xl font-bold text-white mb-6 text-center">Student Registration</h2>

                {error && (
                    <div className="bg-red-500 text-white p-3 rounded mb-4 text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* User Account Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-gray-400 mb-1">Username</label>
                            <input name="username" required onChange={handleChange} className="w-full bg-gray-700 text-white p-2 rounded" />
                        </div>
                        <div>
                            <label className="block text-gray-400 mb-1">Email</label>
                            <input name="email" type="email" required onChange={handleChange} className="w-full bg-gray-700 text-white p-2 rounded" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-gray-400 mb-1">Password</label>
                        <input name="password" type="password" required onChange={handleChange} className="w-full bg-gray-700 text-white p-2 rounded" />
                    </div>

                    <hr className="border-gray-700 my-4" />

                    {/* Student Profile Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-gray-400 mb-1">Student ID</label>
                            <input name="student_id" required onChange={handleChange} className="w-full bg-gray-700 text-white p-2 rounded" />
                        </div>
                        <div>
                            <label className="block text-gray-400 mb-1">Full Name</label>
                            <input name="full_name" required onChange={handleChange} className="w-full bg-gray-700 text-white p-2 rounded" />
                        </div>
                        <div>
                            <label className="block text-gray-400 mb-1">Age</label>
                            <input name="age" type="number" required onChange={handleChange} className="w-full bg-gray-700 text-white p-2 rounded" />
                        </div>
                        <div>
                            <label className="block text-gray-400 mb-1">Gender</label>
                            <select name="gender" required onChange={handleChange} className="w-full bg-gray-700 text-white p-2 rounded">
                                <option value="">Select Gender</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-gray-400 mb-1">Phone Number</label>
                            <input name="phone_number" required onChange={handleChange} className="w-full bg-gray-700 text-white p-2 rounded" />
                        </div>
                        <div>
                            <label className="block text-gray-400 mb-1">Major</label>
                            <input name="major" required onChange={handleChange} className="w-full bg-gray-700 text-white p-2 rounded" />
                        </div>
                    </div>

                    {/* Profile Picture */}
                    <div>
                        <label className="block text-gray-400 mb-1">Profile Picture</label>
                        <input type="file" accept="image/*" onChange={handleFileChange} className="w-full bg-gray-700 text-white p-2 rounded" />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded transition duration-200 mt-6 disabled:opacity-50"
                    >
                        {loading ? "Registering..." : "Register"}
                    </button>
                </form>

                <p className="text-gray-400 text-center mt-4">
                    Already have an account? <Link href="/login" className="text-blue-400 hover:underline">Login</Link>
                </p>
            </div>
        </div>
    );
}
