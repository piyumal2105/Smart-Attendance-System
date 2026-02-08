"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, UserCheck, BarChart3, Calendar, Camera, X, CheckCircle, AlertCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

type MarkRes = {
  session_id: string;
  module_code: string;
  module_name: string;
  remaining_slots: number;
  pin_expires_at: string;
  marked_at?: string;
  max_students?: number;
};

type ModuleAttendance = {
  module_code: string;
  module_name: string;
  total_sessions: number;
  present_sessions: number;
  attendance_percentage: number;
};

type NotificationMessage = {
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
};

export default function StudentAttendancePage() {
  const { user } = useAuth();
  const [studentId, setStudentId] = useState("");
  const [pin, setPin] = useState("");

  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<NotificationMessage | null>(null);
  const [data, setData] = useState<MarkRes | null>(null);

  // Camera states
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    success: boolean;
    message: string;
    confidence?: number;
  } | null>(null);

  // Camera permission modal
  const [showPermissionModal, setShowPermissionModal] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Module attendance history
  const [moduleAttendance, setModuleAttendance] = useState<ModuleAttendance[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [history, setHistory] = useState<
    { module_code: string; module_name: string; marked_at: string }[]
  >([]);

  // Auto-fill student ID from auth context
  useEffect(() => {
    if (user?.student_profile?.student_id) {
      setStudentId(user.student_profile.student_id);
    }
  }, [user]);

  // Fetch module attendance history
  useEffect(() => {
    if (studentId) {
      fetchModuleAttendance();
    }
  }, [studentId]);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  // Ensure video plays when stream is set
  useEffect(() => {
    if (cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch(err => {
        console.error("Error playing video:", err);
        showNotification('error', 'Unable to start video preview. Please check your camera permissions and try again.');
        stopCamera();
      });
    }
  }, [cameraStream]);

  // Helper function to show notifications
  const showNotification = (type: NotificationMessage['type'], message: string) => {
    setNotification({ type, message });
  };

  // Clear notification
  const clearNotification = () => {
    setNotification(null);
  };

  async function fetchModuleAttendance() {
    if (!studentId.trim()) return;

    setLoadingHistory(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const res = await fetch(`${API}/api/attendance/student/${studentId}/summary`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        console.error("Failed to fetch module attendance");
        return;
      }

      const json = await res.json();

      const moduleMap = new Map<string, {
        module_code: string;
        module_name: string;
        total: number;
        present: number;
      }>();

      for (const record of json.records || []) {
        if (!record.present) continue;

        const key = record.module_code;
        const existing = moduleMap.get(key);

        if (!existing) {
          moduleMap.set(key, {
            module_code: record.module_code,
            module_name: record.module_name,
            total: 1,
            present: 1,
          });
        } else {
          existing.total += 1;
          existing.present += 1;
        }
      }

      const modules: ModuleAttendance[] = Array.from(moduleMap.values())
        .filter(m => m.present > 0)
        .map(m => ({
          module_code: m.module_code,
          module_name: m.module_name,
          total_sessions: m.total,
          present_sessions: m.present,
          attendance_percentage: 100,
        }))
        .sort((a, b) => b.total_sessions - a.total_sessions);

      setModuleAttendance(modules);
    } catch (err) {
      console.error("Error fetching module attendance:", err);
    } finally {
      setLoadingHistory(false);
    }
  }

  async function startCamera() {
    try {
      // Verify user authentication
      if (!user?.id) {
        showNotification('error', 'User authentication required. Please log in again.');
        return;
      }

      // Check if user has a profile picture
      const token = localStorage.getItem("token");
      if (!token) {
        showNotification('error', 'Authentication token not found. Please log in again.');
        return;
      }

      // Verify profile picture exists
      try {
        const profileCheckResponse = await fetch(`${API}/api/auth/users/${user.id}/profile-picture-base64`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!profileCheckResponse.ok) {
          showNotification('error', 'Profile picture not found. Please upload a profile picture in your account settings before using face verification.');
          return;
        }
      } catch (err) {
        showNotification('error', 'Unable to verify profile picture. Please ensure you have uploaded a profile picture.');
        return;
      }

      // Check if HTTPS or localhost (required for getUserMedia)
      if (typeof window !== 'undefined') {
        const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost';
        if (!isSecure) {
          showNotification('error', 'Camera access requires a secure HTTPS connection. Please use a secure connection to enable face verification.');
          return;
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      setCameraStream(stream);
      setShowCamera(true);
      setVerificationResult(null);
      clearNotification();
      setShowPermissionModal(false); // Close the modal

      // Small delay to ensure ref is ready
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.muted = true;
          videoRef.current.play().catch(err => {
            console.error("Video play error:", err);
            showNotification('error', 'Failed to start camera preview. Please check your camera permissions.');
            stopCamera();
          });
        }
      }, 100);

    } catch (err: any) {
      console.error("Camera error:", err);
      let errorMsg = "Unable to access camera. ";

      if (err.name === 'NotAllowedError') {
        errorMsg = "Camera access was denied. Please allow camera permissions in your browser settings and try again.";
      } else if (err.name === 'NotFoundError') {
        errorMsg = "No camera detected on this device. Please connect a camera or use a device with a camera.";
      } else if (err.name === 'NotReadableError') {
        errorMsg = "Camera is currently being used by another application. Please close other applications using the camera and try again.";
      } else if (err.name === 'OverconstrainedError') {
        errorMsg = "Your camera does not meet the required specifications. Please try using a different camera.";
      } else if (err.name === 'SecurityError') {
        errorMsg = "Camera access blocked due to security settings. Please check your browser security settings.";
      } else {
        errorMsg = "An unexpected error occurred while accessing the camera. Please check your device settings and try again.";
      }

      showNotification('error', errorMsg);
      stopCamera();
      setShowPermissionModal(false);
    }
  }

  function requestCameraAccess() {
    setShowPermissionModal(true);
  }

  function stopCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => {
        track.stop();
      });
      setCameraStream(null);
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.pause();
    }

    setShowCamera(false);
    setVerificationResult(null);
  }

  function capturePhoto() {
    if (!videoRef.current || !canvasRef.current) {
      showNotification('error', 'Camera preview is not ready. Please wait a moment and try again.');
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    if (!context) {
      showNotification('error', 'Unable to process camera image. Please refresh the page and try again.');
      return;
    }

    if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
      showNotification('warning', 'Camera is still loading. Please wait a moment and try again.');
      return;
    }

    try {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = canvas.toDataURL("image/jpeg", 0.92);
      setCapturedImage(imageData);

      setTimeout(() => {
        stopCamera();
      }, 100);

      showNotification('success', 'Photo captured successfully. Please verify your face to continue.');
    } catch (err) {
      console.error("Capture failed:", err);
      showNotification('error', 'Failed to capture photo. Please try again.');
    }
  }

  function retakePhoto() {
    setCapturedImage(null);
    setVerificationResult(null);
    clearNotification();
    startCamera();
  }

  async function verifyFace() {
    if (!capturedImage || !user?.id) {
      showNotification('error', 'Photo not captured or user not authenticated. Please try again.');
      return;
    }

    setVerifying(true);
    setVerificationResult(null);
    clearNotification();

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Authentication token not found. Please log in again.");
      }

      // Get profile picture
      const profilePicResponse = await fetch(`${API}/api/auth/users/${user.id}/profile-picture-base64`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!profilePicResponse.ok) {
        throw new Error("Unable to retrieve your profile picture. Please ensure you have uploaded a profile picture in your account settings.");
      }

      const { profile_picture_base64 } = await profilePicResponse.json();

      // Verify face
      const verifyResponse = await fetch(`${API}/api/attendance/verify-face`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          profile_picture_base64,
          selfie_base64: capturedImage,
        }),
      });

      const result = await verifyResponse.json();

      if (!verifyResponse.ok) {
        throw new Error(result.detail || "Face verification failed");
      }

      setVerificationResult({
        success: result.is_match,
        message: result.message,
        confidence: result.confidence,
      });

      if (result.is_match) {
        showNotification('success', 'Face verification successful. You can now mark your attendance.');
      } else {
        showNotification('error', 'Face verification failed. The captured image does not match your profile picture. Please ensure you are in a well-lit area, face the camera directly, and try again.');
      }
    } catch (err: any) {
      const errorMessage = err.message || "Face verification failed due to an unexpected error. Please try again.";
      setVerificationResult({
        success: false,
        message: errorMessage,
      });
      showNotification('error', errorMessage);
    } finally {
      setVerifying(false);
    }
  }

  async function submitAttendance() {
    setLoading(true);
    clearNotification();

    try {
      if (!studentId.trim()) {
        throw new Error("Student ID is required to mark attendance.");
      }

      if (!/^\d{6}$/.test(pin.trim())) {
        throw new Error("Please enter a valid 6-digit PIN.");
      }

      if (!capturedImage) {
        throw new Error("Face verification photo is required. Please capture your photo and verify your face.");
      }

      if (!verificationResult?.success) {
        throw new Error("Face verification must be completed successfully before marking attendance.");
      }

      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Authentication session expired. Please log in again.");
      }

      // Get profile picture base64
      const profilePicResponse = await fetch(`${API}/api/auth/users/${user?.id}/profile-picture-base64`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!profilePicResponse.ok) {
        throw new Error("Unable to retrieve profile picture. Please try again.");
      }

      const { profile_picture_base64 } = await profilePicResponse.json();

      const res = await fetch(`${API}/api/attendance/checkin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          student_id: studentId.trim(),
          pin: pin.trim(),
          selfie_base64: capturedImage,
          profile_picture_base64,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.detail || "Failed to mark attendance. Please verify your PIN and try again.");
      }

      const json = (await res.json()) as MarkRes;

      showNotification('success', `Attendance marked successfully for ${json.module_code} - ${json.module_name}`);
      setData(json);
      setPin("");
      setCapturedImage(null);
      setVerificationResult(null);

      if (json.module_code && json.module_name) {
        setHistory((prev) => [
          {
            module_code: json.module_code,
            module_name: json.module_name,
            marked_at: json.marked_at || new Date().toISOString(),
          },
          ...prev,
        ]);
      }

      setTimeout(() => fetchModuleAttendance(), 1000);
    } catch (err: any) {
      showNotification('error', err?.message || "An unexpected error occurred. Please try again.");
      console.error("Attendance error:", err);
    } finally {
      setLoading(false);
    }
  }

  const moduleStats = useMemo(() => {
    const map = new Map<string, { module_name: string; count: number }>();
    for (const h of history) {
      const key = h.module_code;
      const prev = map.get(key);
      if (!prev) {
        map.set(key, { module_name: h.module_name, count: 1 });
      } else {
        map.set(key, { module_name: prev.module_name, count: prev.count + 1 });
      }
    }
    return Array.from(map.entries()).map(([module_code, v]) => ({
      module_code,
      module_name: v.module_name,
      count: v.count,
    }));
  }, [history]);

  const maxStudents = data?.max_students ?? undefined;
  const remaining = typeof data?.remaining_slots === "number" ? data.remaining_slots : undefined;
  const markedCount = useMemo(() => {
    if (typeof maxStudents === "number" && typeof remaining === "number") {
      return Math.max(0, maxStudents - remaining);
    }
    return undefined;
  }, [maxStudents, remaining]);

  const progressPct = useMemo(() => {
    if (typeof maxStudents === "number" && typeof markedCount === "number" && maxStudents > 0) {
      return Math.min(100, Math.round((markedCount / maxStudents) * 100));
    }
    return undefined;
  }, [maxStudents, markedCount]);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="h-16 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-6 md:px-8 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Link
            href="/student/dashboard"
            className="text-gray-400 hover:text-white transition-colors p-2 rounded-full hover:bg-gray-800"
            title="Back to Dashboard"
          >
            <ArrowLeft size={20} />
          </Link>
          <h2 className="text-lg font-semibold text-gray-200">Student Attendance</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-sm text-emerald-400 hidden sm:inline">System Online</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 md:p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <UserCheck className="text-emerald-600" size={32} />
            Mark Attendance
          </h1>
          <p className="text-gray-400">
            Enter the 6-digit PIN and verify your identity using face recognition.
          </p>
        </header>

        {notification && (
          <div
            className={`mb-6 rounded-lg border px-4 py-3.5 text-sm flex items-start gap-3 ${notification.type === 'success'
                ? "border-emerald-700/30 bg-emerald-950/50 text-emerald-300"
                : notification.type === 'error'
                  ? "border-red-700/30 bg-red-950/50 text-red-300"
                  : notification.type === 'warning'
                    ? "border-yellow-700/30 bg-yellow-950/50 text-yellow-300"
                    : "border-blue-700/30 bg-blue-950/50 text-blue-300"
              }`}
          >
            {notification.type === 'success' && <CheckCircle size={20} className="flex-shrink-0 mt-0.5" />}
            {notification.type === 'error' && <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />}
            {notification.type === 'warning' && <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />}
            {notification.type === 'info' && <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />}
            <div className="flex-1">
              {notification.message}
            </div>
            <button
              onClick={clearNotification}
              className="text-current hover:opacity-70 transition-opacity"
            >
              <X size={18} />
            </button>
          </div>
        )}

        <div className="bg-gray-800/70 rounded-xl border border-gray-700 shadow-sm p-6 md:p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <label className="text-sm font-medium text-gray-300">
              Student ID
              <div className="relative mt-1.5">
                <input
                  className="w-full rounded-lg border border-gray-600 bg-gray-700/50 px-4 py-2.5 outline-none text-white cursor-not-allowed opacity-80"
                  value={studentId || "Loading..."}
                  readOnly
                  disabled
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded">
                  Auto-filled
                </div>
              </div>
            </label>

            <label className="text-sm font-medium text-gray-300">
              PIN (6 digits)
              <input
                className="mt-1.5 w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-2.5 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 tracking-widest text-white placeholder-gray-500"
                placeholder="123456"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                maxLength={6}
                disabled={!studentId || loading}
              />
            </label>
          </div>

          {/* Face Verification Section */}
          <div className="mt-6 p-5 rounded-lg bg-gray-700/40 border border-gray-600">
            <h3 className="text-sm font-semibold text-gray-200 mb-3 flex items-center gap-2">
              <Camera size={18} className="text-blue-400" />
              Face Verification {verificationResult?.success && <CheckCircle size={16} className="text-emerald-400" />}
            </h3>

            {!capturedImage && !showCamera && (
              <button
                onClick={requestCameraAccess}
                disabled={!studentId || loading}
                className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                <Camera size={20} />
                Open Camera
              </button>
            )}

            {showCamera && !capturedImage && (
              <div className="relative">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full rounded-lg bg-black"
                  style={{ transform: "scaleX(-1)" }}
                />
                <div className="mt-3 flex gap-3">
                  <button
                    onClick={capturePhoto}
                    disabled={loading}
                    className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-all"
                  >
                    Capture Photo
                  </button>
                  <button
                    onClick={stopCamera}
                    className="rounded-xl bg-red-600 px-4 py-2.5 font-semibold text-white hover:bg-red-700 transition-all"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
            )}

            {capturedImage && (
              <div className="space-y-3">
                <img
                  src={capturedImage}
                  alt="Captured"
                  className="w-full rounded-lg border border-gray-600"
                  style={{ transform: "scaleX(-1)" }}
                />

                {verificationResult && (
                  <div className={`p-3 rounded-lg border ${verificationResult.success
                    ? "border-emerald-700/30 bg-emerald-950/50 text-emerald-300"
                    : "border-red-700/30 bg-red-950/50 text-red-300"
                    }`}>
                    <div className="flex items-start gap-2">
                      {verificationResult.success ? (
                        <CheckCircle size={20} className="flex-shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
                      )}
                      <div>
                        <p className="font-medium">{verificationResult.message}</p>
                        {verificationResult.confidence && (
                          <p className="text-sm mt-1">Confidence: {verificationResult.confidence.toFixed(1)}%</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  {!verificationResult && (
                    <button
                      onClick={verifyFace}
                      disabled={verifying || loading}
                      className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-all"
                    >
                      {verifying ? "Verifying..." : "Verify Face"}
                    </button>
                  )}
                  <button
                    onClick={retakePhoto}
                    disabled={loading}
                    className="flex-1 rounded-xl bg-gray-600 px-4 py-2.5 font-semibold text-white hover:bg-gray-700 disabled:opacity-50 transition-all"
                  >
                    Retake Photo
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={submitAttendance}
            disabled={loading || !studentId || pin.length !== 6 || !verificationResult?.success || !capturedImage}
            className="mt-6 w-full rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg
                  className="animate-spin h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8z"
                  />
                </svg>
                Marking...
              </>
            ) : (
              "Mark Attendance"
            )}
          </button>

          {data?.module_code && (
            <div className="mt-6 p-5 rounded-lg bg-gray-700/40 border border-gray-600">
              <div className="text-sm text-gray-300">
                Marked for:{" "}
                <span className="font-semibold text-white">
                  {data.module_code} — {data.module_name}
                </span>
              </div>

              {data.marked_at && (
                <div className="text-sm text-gray-300 mt-1.5">
                  Time:{" "}
                  <span className="text-white">
                    {new Date(data.marked_at).toLocaleString()}
                  </span>
                </div>
              )}

              {typeof data.remaining_slots === "number" && (
                <div className="text-sm text-gray-300 mt-1.5">
                  Remaining slots:{" "}
                  <span className="font-medium text-white">{data.remaining_slots}</span>
                </div>
              )}

              {typeof progressPct === "number" && (
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                    <span>Progress: {markedCount}/{maxStudents}</span>
                    <span>{progressPct}%</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-gray-700 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Hidden canvas for photo capture */}
        <canvas ref={canvasRef} style={{ display: "none" }} />

        {/* Summary Cards & Charts */}
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <div className="text-sm text-gray-400">Last Module</div>
            <div className="mt-2 text-xl font-bold text-white">
              {data?.module_name ?? "—"}
            </div>
            <div className="text-sm text-gray-500 mt-1">{data?.module_code ?? ""}</div>
          </div>

          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <div className="text-sm text-gray-400">Attendance Records</div>
            <div className="mt-2 text-3xl font-bold text-white">{history.length}</div>
            <div className="text-sm text-gray-500 mt-1">This session</div>
          </div>

          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <div className="text-sm text-gray-400">Remaining Slots</div>
            <div className="mt-2 text-3xl font-bold text-white">
              {typeof remaining === "number" ? remaining : "—"}
            </div>
            <div className="text-sm text-gray-500 mt-1">Current session</div>
          </div>

          {/* Module Attendance Overview */}
          <div className="lg:col-span-3 bg-gray-800 rounded-xl border border-gray-700 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-gray-200 flex items-center gap-2">
                <Calendar size={18} className="text-gray-400" />
                My Module Attendance
              </h2>
              <button
                onClick={fetchModuleAttendance}
                disabled={loadingHistory}
                className="text-xs text-gray-400 hover:text-gray-200 flex items-center gap-1 disabled:opacity-50"
              >
                {loadingHistory ? "Loading..." : "Refresh"}
              </button>
            </div>

            {loadingHistory ? (
              <div className="text-sm text-gray-500 py-6 text-center">
                Loading attendance history...
              </div>
            ) : moduleAttendance.length === 0 ? (
              <div className="text-sm text-gray-500 py-6 text-center">
                No attendance records found. Mark attendance to see your progress.
              </div>
            ) : (
              <div className="space-y-4">
                {moduleAttendance.map((m) => (
                  <div key={m.module_code} className="bg-gray-700/40 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="font-medium text-gray-200">
                          {m.module_code}
                        </div>
                        <div className="text-sm text-gray-400 mt-0.5">
                          {m.module_name}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-white">
                          {m.attendance_percentage}%
                        </div>
                        <div className="text-xs text-gray-400">
                          {m.present_sessions}/{m.total_sessions} sessions
                        </div>
                      </div>
                    </div>
                    <div className="h-3 rounded-full bg-gray-700 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 transition-all duration-400"
                        style={{ width: `${m.attendance_percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Session Activity Chart */}
          <div className="lg:col-span-3 bg-gray-800 rounded-xl border border-gray-700 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-gray-200 flex items-center gap-2">
                <BarChart3 size={18} className="text-gray-400" />
                Session Activity
              </h2>
              <div className="text-xs text-gray-500">Current session records</div>
            </div>

            {moduleStats.length === 0 ? (
              <div className="text-sm text-gray-500 py-6 text-center">
                No session activity yet. Mark once to see stats.
              </div>
            ) : (
              <div className="space-y-4">
                {moduleStats.map((m) => {
                  const max = Math.max(...moduleStats.map((x) => x.count), 1);
                  const width = Math.round((m.count / max) * 100);
                  return (
                    <div key={m.module_code}>
                      <div className="flex justify-between text-sm mb-1.5">
                        <div className="font-medium text-gray-200">
                          {m.module_code} — <span className="text-gray-400">{m.module_name}</span>
                        </div>
                        <div className="font-semibold text-white">{m.count}</div>
                      </div>
                      <div className="h-3 rounded-full bg-gray-700 overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 transition-all duration-400"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Camera Permission Modal */}
      {showPermissionModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl border border-gray-700 max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-blue-600/20 flex items-center justify-center flex-shrink-0">
                <Camera size={24} className="text-blue-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-white mb-2">
                  Camera Access Required
                </h3>
                <p className="text-sm text-gray-300 leading-relaxed">
                  We need access to your camera to verify your identity and ensure secure attendance marking.
                </p>
              </div>
            </div>

            <div className="bg-gray-700/40 rounded-lg p-4 mb-5">
              <h4 className="text-sm font-semibold text-gray-200 mb-3">Why we need camera access:</h4>
              <ul className="space-y-2 text-sm text-gray-300">
                <li className="flex items-start gap-2">
                  <CheckCircle size={16} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span>Verify your identity by comparing your live photo with your profile picture</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle size={16} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span>Prevent unauthorized attendance marking by others</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle size={16} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span>Ensure accurate attendance records for academic purposes</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle size={16} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span>Your photo is used only for verification and is not stored permanently</span>
                </li>
              </ul>
            </div>

            <div className="bg-blue-950/30 border border-blue-700/30 rounded-lg p-3 mb-5">
              <p className="text-xs text-blue-300">
                <strong>Privacy Note:</strong> Your camera feed is processed locally in your browser.
                We only send the captured photo to our secure server for verification purposes.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowPermissionModal(false)}
                className="flex-1 rounded-xl bg-gray-700 px-4 py-2.5 font-semibold text-white hover:bg-gray-600 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={startCamera}
                className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
              >
                <Camera size={18} />
                Allow Camera
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}