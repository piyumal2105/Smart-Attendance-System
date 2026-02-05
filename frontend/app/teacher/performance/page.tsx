"use client";
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
    Upload,
    Mic,
    MicOff,
    FileText,
    CheckCircle2,
    AlertCircle,
    Loader2,
    Trash2,
    Send,
    GraduationCap,
    ClipboardPaste,
    Clock,
    Zap,
    HelpCircle,
    PlayCircle,
    BarChart3,
    Users,
    Target,
    TrendingUp,
    CheckCheck,
    XCircle,
    Brain,
    Sparkles,
    Plus,
    X,
    Settings,
    Wand2
} from 'lucide-react';

// API Configuration
const API_BASE_URL = "http://localhost:8000";

// Auto-submit interval in milliseconds (5 seconds)
const AUTO_SUBMIT_INTERVAL = 5000;

interface UploadStatus {
    status: 'idle' | 'uploading' | 'success' | 'error';
    message: string;
    chunks?: number;
}

interface TranscriptStatus {
    status: 'idle' | 'processing' | 'success' | 'error';
    message: string;
}

export default function StudentPerformanceSection() {
    // File upload state
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploadStatus, setUploadStatus] = useState<UploadStatus>({ status: 'idle', message: '' });
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Transcription state
    const [isRecording, setIsRecording] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [interimTranscript, setInterimTranscript] = useState('');
    const [transcriptStatus, setTranscriptStatus] = useState<TranscriptStatus>({ status: 'idle', message: '' });
    const recognitionRef = useRef<any>(null);

    // Auto-submit state
    const [autoSubmitEnabled, setAutoSubmitEnabled] = useState(true);
    const [lastAutoSubmit, setLastAutoSubmit] = useState<Date | null>(null);
    const [autoSubmitCount, setAutoSubmitCount] = useState(0);
    const pendingTranscriptRef = useRef('');
    const autoSubmitTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Demo paste state
    const [pasteText, setPasteText] = useState('');
    const [pasteStatus, setPasteStatus] = useState<TranscriptStatus>({ status: 'idle', message: '' });

    // Stats
    const [contentStats, setContentStats] = useState<{ document_count: number } | null>(null);

    // ===== QUIZ FEATURE STATE =====
    interface QuizQuestion {
        id: number;
        topic: string;
        question: string;
        options: string[];
        correctAnswer: number;
        difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
    }

    interface StudentResponse {
        studentId: string;
        studentName: string;
        questionId: number;
        selectedAnswer: number;
        isCorrect: boolean;
        timestamp: Date;
    }

    // Available topics for quiz generation
    const availableTopics = [
        "Machine Learning",
        "Data Structures",
        "Neural Networks",
        "Algorithms",
        "Databases",
        "Web Development",
        "Python Programming",
        "Computer Networks"
    ];

    // Hardcoded question bank by topic and difficulty
    const questionBank: Record<string, Record<string, QuizQuestion[]>> = {
        "Machine Learning": {
            "Beginner": [
                { id: 0, topic: "Machine Learning", difficulty: "Beginner", question: "What is supervised learning?", options: ["Learning without any data", "Learning from labeled training data", "Learning from unlabeled data only", "Learning without a computer"], correctAnswer: 1 },
                { id: 0, topic: "Machine Learning", difficulty: "Beginner", question: "What is a training dataset?", options: ["Data used to test the model", "Data used to train the model", "Data used to validate only", "Random data"], correctAnswer: 1 },
            ],
            "Intermediate": [
                { id: 0, topic: "Machine Learning", difficulty: "Intermediate", question: "What is overfitting?", options: ["Model performs well on all data", "Model memorizes training data but fails on new data", "Model is too simple", "Model trains too fast"], correctAnswer: 1 },
                { id: 0, topic: "Machine Learning", difficulty: "Intermediate", question: "What is cross-validation?", options: ["Testing once", "Training without validation", "Splitting data into multiple folds for validation", "Using all data for training"], correctAnswer: 2 },
            ],
            "Advanced": [
                { id: 0, topic: "Machine Learning", difficulty: "Advanced", question: "What is the bias-variance tradeoff?", options: ["Balancing model complexity vs generalization", "Choosing between two algorithms", "Training speed vs accuracy", "Data size vs model size"], correctAnswer: 0 },
            ]
        },
        "Data Structures": {
            "Beginner": [
                { id: 0, topic: "Data Structures", difficulty: "Beginner", question: "What is an array?", options: ["A single variable", "A collection of elements at contiguous memory", "A type of loop", "A function"], correctAnswer: 1 },
                { id: 0, topic: "Data Structures", difficulty: "Beginner", question: "What is a linked list?", options: ["An array with fixed size", "A sequence of nodes with pointers", "A type of tree", "A sorting algorithm"], correctAnswer: 1 },
            ],
            "Intermediate": [
                { id: 0, topic: "Data Structures", difficulty: "Intermediate", question: "What is the time complexity of binary search?", options: ["O(n)", "O(n²)", "O(log n)", "O(1)"], correctAnswer: 2 },
                { id: 0, topic: "Data Structures", difficulty: "Intermediate", question: "What is a hash table?", options: ["A sorted array", "A key-value storage with O(1) average lookup", "A binary tree", "A graph structure"], correctAnswer: 1 },
            ],
            "Advanced": [
                { id: 0, topic: "Data Structures", difficulty: "Advanced", question: "What is the amortized time complexity of dynamic array insertion?", options: ["O(n)", "O(log n)", "O(1)", "O(n²)"], correctAnswer: 2 },
            ]
        },
        "Neural Networks": {
            "Beginner": [
                { id: 0, topic: "Neural Networks", difficulty: "Beginner", question: "What is a neuron in neural networks?", options: ["A database", "A basic computational unit", "A type of data", "A training method"], correctAnswer: 1 },
            ],
            "Intermediate": [
                { id: 0, topic: "Neural Networks", difficulty: "Intermediate", question: "What is an activation function?", options: ["A function that turns off the network", "A function that introduces non-linearity", "A function that only works on images", "A function that reduces learning rate"], correctAnswer: 1 },
                { id: 0, topic: "Neural Networks", difficulty: "Intermediate", question: "What is backpropagation?", options: ["Forward data flow", "Algorithm to calculate gradients for training", "A type of neural network", "Data preprocessing"], correctAnswer: 1 },
            ],
            "Advanced": [
                { id: 0, topic: "Neural Networks", difficulty: "Advanced", question: "What is the vanishing gradient problem?", options: ["Gradients become very small in deep networks", "Gradients become too large", "Network runs out of memory", "Training is too fast"], correctAnswer: 0 },
            ]
        },
        "Algorithms": {
            "Beginner": [
                { id: 0, topic: "Algorithms", difficulty: "Beginner", question: "What is an algorithm?", options: ["A programming language", "A step-by-step procedure to solve a problem", "A type of data", "A computer component"], correctAnswer: 1 },
            ],
            "Intermediate": [
                { id: 0, topic: "Algorithms", difficulty: "Intermediate", question: "What does Big O notation measure?", options: ["The exact runtime in seconds", "Memory usage only", "Algorithm efficiency as input grows", "Code readability"], correctAnswer: 2 },
            ],
            "Advanced": [
                { id: 0, topic: "Algorithms", difficulty: "Advanced", question: "What is the time complexity of merge sort?", options: ["O(n)", "O(n log n)", "O(n²)", "O(log n)"], correctAnswer: 1 },
            ]
        },
        "Databases": {
            "Beginner": [
                { id: 0, topic: "Databases", difficulty: "Beginner", question: "What is a database?", options: ["A programming language", "An organized collection of data", "A type of algorithm", "A web server"], correctAnswer: 1 },
            ],
            "Intermediate": [
                { id: 0, topic: "Databases", difficulty: "Intermediate", question: "What is database normalization?", options: ["Making database faster", "Organizing data to reduce redundancy", "Encrypting all data", "Backing up the database"], correctAnswer: 1 },
            ],
            "Advanced": [
                { id: 0, topic: "Databases", difficulty: "Advanced", question: "What is ACID in database transactions?", options: ["A type of SQL query", "Atomicity, Consistency, Isolation, Durability", "A database engine", "A backup method"], correctAnswer: 1 },
            ]
        }
    };

    // Dynamic quiz questions state
    const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
    const [nextQuizId, setNextQuizId] = useState(1);

    // Hardcoded simulated student responses
    const simulatedResponses: StudentResponse[] = [
        { studentId: "S001", studentName: "Alex Johnson", questionId: 1, selectedAnswer: 1, isCorrect: true, timestamp: new Date() },
        { studentId: "S002", studentName: "Emma Williams", questionId: 1, selectedAnswer: 1, isCorrect: true, timestamp: new Date() },
        { studentId: "S003", studentName: "Michael Brown", questionId: 1, selectedAnswer: 2, isCorrect: false, timestamp: new Date() },
        { studentId: "S001", studentName: "Alex Johnson", questionId: 2, selectedAnswer: 2, isCorrect: true, timestamp: new Date() },
        { studentId: "S002", studentName: "Emma Williams", questionId: 2, selectedAnswer: 0, isCorrect: false, timestamp: new Date() },
    ];

    // Quiz state
    const [activeQuizId, setActiveQuizId] = useState<number | null>(null);
    const [releasedQuizzes, setReleasedQuizzes] = useState<number[]>([]);
    const [showAnalytics, setShowAnalytics] = useState(false);

    // Quiz generation modal state
    const [showGenerateModal, setShowGenerateModal] = useState(false);
    const [selectedTopic, setSelectedTopic] = useState(availableTopics[0]);
    const [selectedDifficulty, setSelectedDifficulty] = useState<'Beginner' | 'Intermediate' | 'Advanced'>('Intermediate');
    const [questionCount, setQuestionCount] = useState(3);
    const [isGenerating, setIsGenerating] = useState(false);

    // Generate quiz function
    const generateQuiz = () => {
        setIsGenerating(true);

        // Simulate AI generation delay
        setTimeout(() => {
            const topicQuestions = questionBank[selectedTopic]?.[selectedDifficulty] || [];
            const availableQuestions = [...topicQuestions];
            const newQuestions: QuizQuestion[] = [];

            for (let i = 0; i < Math.min(questionCount, availableQuestions.length); i++) {
                const randomIdx = Math.floor(Math.random() * availableQuestions.length);
                const q = { ...availableQuestions[randomIdx], id: nextQuizId + i };
                newQuestions.push(q);
                availableQuestions.splice(randomIdx, 1);
            }

            // If we need more questions, generate placeholder ones
            while (newQuestions.length < questionCount) {
                newQuestions.push({
                    id: nextQuizId + newQuestions.length,
                    topic: selectedTopic,
                    difficulty: selectedDifficulty,
                    question: `${selectedTopic} question ${newQuestions.length + 1} (${selectedDifficulty})`,
                    options: ["Option A", "Option B", "Option C", "Option D"],
                    correctAnswer: Math.floor(Math.random() * 4)
                });
            }

            setQuizQuestions([...quizQuestions, ...newQuestions]);
            setNextQuizId(nextQuizId + newQuestions.length);
            setIsGenerating(false);
            setShowGenerateModal(false);
        }, 1500);
    };

    // Remove quiz function
    const removeQuiz = (questionId: number) => {
        setQuizQuestions(quizQuestions.filter(q => q.id !== questionId));
        setReleasedQuizzes(releasedQuizzes.filter(id => id !== questionId));
    };

    // Calculate analytics
    const getTopicAnalytics = () => {
        const topicStats: Record<string, { correct: number; total: number }> = {};

        quizQuestions.forEach(q => {
            if (!topicStats[q.topic]) {
                topicStats[q.topic] = { correct: 0, total: 0 };
            }
        });

        simulatedResponses.forEach(response => {
            const question = quizQuestions.find(q => q.id === response.questionId);
            if (question) {
                topicStats[question.topic].total++;
                if (response.isCorrect) {
                    topicStats[question.topic].correct++;
                }
            }
        });

        return Object.entries(topicStats).map(([topic, stats]) => ({
            topic,
            percentage: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
            correct: stats.correct,
            total: stats.total
        }));
    };

    const getOverallStats = () => {
        const totalResponses = simulatedResponses.length;
        const correctResponses = simulatedResponses.filter(r => r.isCorrect).length;
        const uniqueStudents = new Set(simulatedResponses.map(r => r.studentId)).size;

        return {
            totalResponses,
            correctResponses,
            accuracy: totalResponses > 0 ? Math.round((correctResponses / totalResponses) * 100) : 0,
            uniqueStudents,
            questionsAnswered: new Set(simulatedResponses.map(r => r.questionId)).size
        };
    };

    const releaseQuiz = (questionId: number) => {
        if (!releasedQuizzes.includes(questionId)) {
            setReleasedQuizzes([...releasedQuizzes, questionId]);
            setActiveQuizId(questionId);
        }
    };

    // Auto-submit function
    const autoSubmitTranscript = useCallback(async (text: string) => {
        if (!text.trim() || text.trim().length < 20) return;

        try {
            const response = await fetch(`${API_BASE_URL}/api/performance/transcript`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transcript: text, use_llm_filter: false }), // Use regex for speed
            });

            const data = await response.json();

            if (response.ok && data.success) {
                setAutoSubmitCount(prev => prev + 1);
                setLastAutoSubmit(new Date());
                fetchStats();
                console.log(`Auto-submitted chunk: ${text.length} chars`);
            }
        } catch (error) {
            console.error('Auto-submit failed:', error);
        }
    }, []);

    // Initialize speech recognition
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (SpeechRecognition) {
                const recognition = new SpeechRecognition();
                recognition.continuous = true;
                recognition.interimResults = true;
                recognition.lang = 'en-US';

                recognition.onresult = (event: any) => {
                    let interim = '';
                    let final = '';
                    for (let i = event.resultIndex; i < event.results.length; i++) {
                        const result = event.results[i];
                        if (result.isFinal) {
                            final += result[0].transcript + ' ';
                        } else {
                            interim += result[0].transcript;
                        }
                    }
                    if (final) {
                        setTranscript(prev => prev + final);
                        pendingTranscriptRef.current += final;
                    }
                    setInterimTranscript(interim);
                };

                recognition.onerror = (event: any) => {
                    console.error('Speech recognition error:', event.error);
                    setIsRecording(false);
                };

                recognition.onend = () => {
                    // Only restart if still recording
                    if (isRecording && recognitionRef.current) {
                        try {
                            recognitionRef.current.start();
                        } catch (e) {
                            console.error('Failed to restart recognition:', e);
                        }
                    }
                };

                recognitionRef.current = recognition;
            }
        }
        fetchStats();
    }, []);

    // Auto-submit timer effect
    useEffect(() => {
        if (isRecording && autoSubmitEnabled) {
            // Start auto-submit timer
            autoSubmitTimerRef.current = setInterval(() => {
                const pending = pendingTranscriptRef.current;
                if (pending.trim().length >= 20) {
                    autoSubmitTranscript(pending);
                    pendingTranscriptRef.current = ''; // Clear pending after submit
                }
            }, AUTO_SUBMIT_INTERVAL);
        } else {
            // Clear timer when not recording
            if (autoSubmitTimerRef.current) {
                clearInterval(autoSubmitTimerRef.current);
                autoSubmitTimerRef.current = null;
            }
        }

        return () => {
            if (autoSubmitTimerRef.current) {
                clearInterval(autoSubmitTimerRef.current);
            }
        };
    }, [isRecording, autoSubmitEnabled, autoSubmitTranscript]);

    const fetchStats = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/performance/stats`);
            if (response.ok) {
                const data = await response.json();
                setContentStats(data.data);
            }
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        }
    };

    // File upload handlers
    const handleFileSelect = (file: File) => {
        if (file.type === 'application/pdf' || file.name.endsWith('.pdf') || file.name.endsWith('.txt')) {
            setSelectedFile(file);
            setUploadStatus({ status: 'idle', message: '' });
        } else {
            setUploadStatus({ status: 'error', message: 'Please select a PDF or TXT file' });
        }
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFileSelect(file);
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback(() => {
        setIsDragging(false);
    }, []);

    const uploadFile = async () => {
        if (!selectedFile) return;
        setUploadStatus({ status: 'uploading', message: 'Processing document...' });

        try {
            const formData = new FormData();
            formData.append('file', selectedFile);

            const response = await fetch(`${API_BASE_URL}/api/performance/upload`, {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (response.ok && data.success) {
                setUploadStatus({ status: 'success', message: data.message, chunks: data.data?.chunks_stored });
                setSelectedFile(null);
                fetchStats();
            } else {
                setUploadStatus({ status: 'error', message: data.detail || data.message || 'Upload failed' });
            }
        } catch (error) {
            setUploadStatus({ status: 'error', message: 'Failed to connect to server. Is the backend running?' });
        }
    };

    // Transcription handlers
    const toggleRecording = () => {
        if (!recognitionRef.current) {
            alert('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
            return;
        }

        if (isRecording) {
            recognitionRef.current.stop();
            setIsRecording(false);

            // Submit any remaining pending transcript
            if (autoSubmitEnabled && pendingTranscriptRef.current.trim().length >= 20) {
                autoSubmitTranscript(pendingTranscriptRef.current);
                pendingTranscriptRef.current = '';
            }
        } else {
            setTranscript('');
            setInterimTranscript('');
            setAutoSubmitCount(0);
            pendingTranscriptRef.current = '';
            recognitionRef.current.start();
            setIsRecording(true);
        }
    };

    const clearTranscript = () => {
        setTranscript('');
        setInterimTranscript('');
        setTranscriptStatus({ status: 'idle', message: '' });
        setAutoSubmitCount(0);
        pendingTranscriptRef.current = '';
    };

    const submitTranscript = async () => {
        if (!transcript.trim()) return;
        setTranscriptStatus({ status: 'processing', message: 'Processing transcript...' });

        try {
            const response = await fetch(`${API_BASE_URL}/api/performance/transcript`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transcript: transcript, use_llm_filter: true }),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                setTranscriptStatus({ status: 'success', message: `Stored ${data.data?.chunks_stored || 1} content chunks` });
                setTranscript('');
                pendingTranscriptRef.current = '';
                fetchStats();
            } else {
                setTranscriptStatus({ status: 'error', message: data.detail || data.message || 'Processing failed' });
            }
        } catch (error) {
            setTranscriptStatus({ status: 'error', message: 'Failed to connect to server' });
        }
    };

    // Demo paste handlers
    const submitPasteText = async () => {
        if (!pasteText.trim()) return;
        setPasteStatus({ status: 'processing', message: 'Processing pasted transcript...' });

        try {
            const response = await fetch(`${API_BASE_URL}/api/performance/transcript`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transcript: pasteText, use_llm_filter: true }),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                setPasteStatus({ status: 'success', message: `Stored ${data.data?.chunks_stored || 1} content chunks` });
                setPasteText('');
                fetchStats();
            } else {
                setPasteStatus({ status: 'error', message: data.detail || data.message || 'Processing failed' });
            }
        } catch (error) {
            setPasteStatus({ status: 'error', message: 'Failed to connect to server' });
        }
    };

    const clearContent = async () => {
        if (!confirm('Are you sure you want to clear all stored content?')) return;
        try {
            await fetch(`${API_BASE_URL}/api/performance/clear`, { method: 'DELETE' });
            fetchStats();
            setAutoSubmitCount(0);
        } catch (error) {
            console.error('Failed to clear:', error);
        }
    };

    return (
        <div className="flex flex-col h-full bg-gray-900 text-white overflow-hidden">
            <header className="h-16 bg-gray-800/50 backdrop-blur border-b border-gray-700 flex items-center justify-between px-8 sticky top-0 z-10 shrink-0">
                <h2 className="text-lg font-semibold text-gray-200">
                    Student Performance
                </h2>
                <div className="flex items-center gap-4">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-sm text-emerald-400">System Online</span>
                </div>
            </header>
            <main className="p-8 flex-1 overflow-auto">
                <div className="space-y-6">
                    {/* Info Banner */}
                    <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-xl p-4 flex items-center gap-4">
                        <div className="p-3 bg-blue-500/20 rounded-lg">
                            <GraduationCap size={24} className="text-blue-400" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold text-white">Lecture Content Manager</h3>
                            <p className="text-sm text-gray-400">Upload slides and record lectures for AI-powered student summaries and Q&A</p>
                        </div>
                        {contentStats && (
                            <div className="flex items-center gap-2 bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-700">
                                <FileText size={14} className="text-blue-400" />
                                <span className="text-sm text-white">{contentStats.document_count} chunks</span>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* File Upload Section */}
                        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                            <div className="p-4 border-b border-gray-700 bg-gray-900/50">
                                <h3 className="font-semibold flex items-center gap-2">
                                    <Upload size={18} className="text-blue-400" />
                                    Upload Lecture Slides
                                </h3>
                                <p className="text-xs text-gray-500 mt-1">PDF or TXT files accepted</p>
                            </div>
                            <div className="p-6">
                                <div
                                    className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${isDragging ? 'border-blue-500 bg-blue-500/10' : 'border-gray-600 hover:border-blue-500/50 hover:bg-gray-700/30'}`}
                                    onDrop={handleDrop}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <input ref={fileInputRef} type="file" accept=".pdf,.txt" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])} />
                                    <Upload size={32} className="mx-auto text-gray-500 mb-3" />
                                    <p className="text-white font-medium">{selectedFile ? selectedFile.name : 'Drop your file here'}</p>
                                    <p className="text-sm text-gray-500 mt-1">{selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB` : 'or click to browse'}</p>
                                </div>

                                <div className="mt-4 space-y-3">
                                    <button
                                        onClick={uploadFile}
                                        disabled={!selectedFile || uploadStatus.status === 'uploading'}
                                        className={`w-full py-2.5 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${selectedFile && uploadStatus.status !== 'uploading' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
                                    >
                                        {uploadStatus.status === 'uploading' ? <><Loader2 size={16} className="animate-spin" />Processing...</> : <><Upload size={16} />Upload & Process</>}
                                    </button>

                                    {uploadStatus.message && (
                                        <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${uploadStatus.status === 'success' ? 'bg-emerald-500/10 text-emerald-400' : uploadStatus.status === 'error' ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'}`}>
                                            {uploadStatus.status === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                                            {uploadStatus.message}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Live Transcription Section with Auto-Submit */}
                        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                            <div className="p-4 border-b border-gray-700 bg-gray-900/50">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="font-semibold flex items-center gap-2">
                                            <Mic size={18} className="text-purple-400" />
                                            Live Transcription
                                        </h3>
                                        <p className="text-xs text-gray-500 mt-1">Auto-saves every 5 seconds while recording</p>
                                    </div>
                                    {/* Auto-submit toggle */}
                                    <button
                                        onClick={() => setAutoSubmitEnabled(!autoSubmitEnabled)}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${autoSubmitEnabled ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-gray-700 text-gray-400'}`}
                                    >
                                        <Zap size={14} />
                                        Auto-Save {autoSubmitEnabled ? 'ON' : 'OFF'}
                                    </button>
                                </div>
                            </div>
                            <div className="p-6">
                                <div className="flex justify-center mb-4">
                                    <button
                                        onClick={toggleRecording}
                                        className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-red-500 animate-pulse shadow-lg shadow-red-500/30' : 'bg-blue-600 hover:bg-blue-700'}`}
                                    >
                                        {isRecording ? <MicOff size={28} className="text-white" /> : <Mic size={28} className="text-white" />}
                                    </button>
                                </div>

                                {/* Recording status */}
                                <div className="text-center mb-4">
                                    <p className="text-sm text-gray-400">
                                        {isRecording ? 'Recording... Click to stop' : 'Click to start recording'}
                                    </p>
                                    {isRecording && autoSubmitEnabled && (
                                        <div className="flex items-center justify-center gap-2 mt-2 text-xs text-emerald-400">
                                            <Clock size={12} />
                                            {autoSubmitCount > 0 ? `${autoSubmitCount} chunks auto-saved` : 'Will auto-save every 5s'}
                                        </div>
                                    )}
                                </div>

                                <div className="bg-gray-900 rounded-lg p-4 min-h-[120px] max-h-[160px] overflow-y-auto border border-gray-700">
                                    {transcript || interimTranscript ? (
                                        <p className="text-gray-200 leading-relaxed text-sm">
                                            {transcript}
                                            <span className="text-blue-400 opacity-70">{interimTranscript}</span>
                                        </p>
                                    ) : (
                                        <p className="text-gray-600 text-center text-sm">Transcript will appear here...</p>
                                    )}
                                </div>

                                <div className="mt-4 space-y-3">
                                    <div className="flex gap-2">
                                        <button
                                            onClick={submitTranscript}
                                            disabled={!transcript.trim() || transcriptStatus.status === 'processing'}
                                            className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${transcript.trim() && transcriptStatus.status !== 'processing' ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
                                        >
                                            {transcriptStatus.status === 'processing' ? <><Loader2 size={16} className="animate-spin" />Processing...</> : <><Send size={16} />Submit All</>}
                                        </button>
                                        <button
                                            onClick={clearTranscript}
                                            disabled={!transcript.trim() && !interimTranscript}
                                            className={`py-2.5 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${transcript.trim() || interimTranscript ? 'bg-gray-600 text-white hover:bg-gray-500' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>

                                    {transcriptStatus.message && (
                                        <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${transcriptStatus.status === 'success' ? 'bg-emerald-500/10 text-emerald-400' : transcriptStatus.status === 'error' ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'}`}>
                                            {transcriptStatus.status === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                                            {transcriptStatus.message}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Demo Paste Section */}
                    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                        <div className="p-4 border-b border-gray-700 bg-gray-900/50">
                            <h3 className="font-semibold flex items-center gap-2">
                                <ClipboardPaste size={18} className="text-orange-400" />
                                Paste Transcript (Demo Mode)
                            </h3>
                            <p className="text-xs text-gray-500 mt-1">Paste lecture transcript text directly for testing without recording</p>
                        </div>
                        <div className="p-6">
                            <textarea
                                value={pasteText}
                                onChange={(e) => setPasteText(e.target.value)}
                                placeholder="Paste your lecture transcript here for demo purposes...&#10;&#10;Example: Today we'll be discussing machine learning fundamentals. Machine learning is a subset of artificial intelligence that enables computers to learn from data without being explicitly programmed..."
                                className="w-full h-32 bg-gray-900 border border-gray-700 rounded-lg p-4 text-gray-200 text-sm resize-none focus:outline-none focus:border-orange-500/50 placeholder-gray-600"
                            />

                            <div className="mt-4 flex gap-3">
                                <button
                                    onClick={submitPasteText}
                                    disabled={!pasteText.trim() || pasteStatus.status === 'processing'}
                                    className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${pasteText.trim() && pasteStatus.status !== 'processing' ? 'bg-orange-600 text-white hover:bg-orange-700' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
                                >
                                    {pasteStatus.status === 'processing' ? <><Loader2 size={16} className="animate-spin" />Processing...</> : <><Send size={16} />Submit Pasted Text</>}
                                </button>
                                <button
                                    onClick={() => { setPasteText(''); setPasteStatus({ status: 'idle', message: '' }); }}
                                    disabled={!pasteText.trim()}
                                    className={`py-2.5 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${pasteText.trim() ? 'bg-gray-600 text-white hover:bg-gray-500' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
                                >
                                    <Trash2 size={16} />
                                    Clear
                                </button>
                            </div>

                            {pasteStatus.message && (
                                <div className={`mt-3 flex items-start gap-2 p-3 rounded-lg text-sm ${pasteStatus.status === 'success' ? 'bg-emerald-500/10 text-emerald-400' : pasteStatus.status === 'error' ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'}`}>
                                    {pasteStatus.status === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                                    {pasteStatus.message}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* How it works */}
                    <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
                        <h3 className="font-semibold text-white mb-4">How it works</h3>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="flex gap-3">
                                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold shrink-0">1</div>
                                <div>
                                    <h4 className="font-medium text-white text-sm">Upload Slides</h4>
                                    <p className="text-xs text-gray-500">Text is extracted and stored</p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold shrink-0">2</div>
                                <div>
                                    <h4 className="font-medium text-white text-sm">Record Lecture</h4>
                                    <p className="text-xs text-gray-500">Speech auto-saves every 5s</p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-400 font-bold shrink-0">3</div>
                                <div>
                                    <h4 className="font-medium text-white text-sm">Or Paste Text</h4>
                                    <p className="text-xs text-gray-500">For demos without mic</p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold shrink-0">4</div>
                                <div>
                                    <h4 className="font-medium text-white text-sm">Student Access</h4>
                                    <p className="text-xs text-gray-500">AI summaries & Q&A ready</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ===== CLASS QUIZ SECTION ===== */}
                    <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
                        <div className="p-4 border-b border-gray-700 bg-gray-900/50">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-blue-500/20 rounded-xl">
                                        <Brain size={22} className="text-blue-400" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white text-lg flex items-center gap-2">
                                            AI-Generated Quiz
                                            <span className="px-2 py-0.5 bg-gray-700 text-gray-300 text-xs font-medium rounded-full border border-gray-600">
                                                <Sparkles size={10} className="inline mr-1" />
                                                From Lecture Content
                                            </span>
                                        </h3>
                                        <p className="text-sm text-gray-400">Questions auto-generated based on your uploaded slides and live transcription</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => setShowGenerateModal(true)}
                                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all"
                                    >
                                        <Wand2 size={18} />
                                        Generate Quiz
                                    </button>
                                    <button
                                        onClick={() => setShowAnalytics(!showAnalytics)}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${showAnalytics
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                                    >
                                        <BarChart3 size={18} />
                                        {showAnalytics ? 'Hide Analytics' : 'View Analytics'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Quiz Questions Grid */}
                            {quizQuestions.length === 0 ? (
                                <div className="text-center py-12">
                                    <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <HelpCircle size={32} className="text-blue-400" />
                                    </div>
                                    <h4 className="text-lg font-semibold text-white mb-2">No Quizzes Yet</h4>
                                    <p className="text-gray-400 mb-6">Generate AI-powered quizzes based on your lecture content</p>
                                    <button
                                        onClick={() => setShowGenerateModal(true)}
                                        className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all"
                                    >
                                        <Wand2 size={18} />
                                        Generate Your First Quiz
                                    </button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {quizQuestions.map((question) => (
                                        <div
                                            key={question.id}
                                            className={`bg-gray-800/80 rounded-xl border transition-all ${releasedQuizzes.includes(question.id)
                                                ? 'border-emerald-500/50 shadow-lg shadow-emerald-500/10'
                                                : 'border-gray-700 hover:border-indigo-500/50'
                                                }`}
                                        >
                                            <div className="p-4">
                                                <div className="flex items-start justify-between mb-3">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${question.topic === 'Machine Learning' ? 'bg-blue-500/20 text-blue-400' :
                                                            question.topic === 'Data Structures' ? 'bg-emerald-500/20 text-emerald-400' :
                                                                question.topic === 'Neural Networks' ? 'bg-purple-500/20 text-purple-400' :
                                                                    question.topic === 'Algorithms' ? 'bg-orange-500/20 text-orange-400' :
                                                                        'bg-pink-500/20 text-pink-400'
                                                            }`}>
                                                            {question.topic}
                                                        </span>
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${question.difficulty === 'Beginner' ? 'bg-green-500/20 text-green-400' :
                                                            question.difficulty === 'Intermediate' ? 'bg-yellow-500/20 text-yellow-400' :
                                                                'bg-red-500/20 text-red-400'
                                                            }`}>
                                                            {question.difficulty}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {releasedQuizzes.includes(question.id) && (
                                                            <span className="flex items-center gap-1 text-xs text-emerald-400">
                                                                <CheckCheck size={14} />
                                                                Released
                                                            </span>
                                                        )}
                                                        <button
                                                            onClick={() => removeQuiz(question.id)}
                                                            className="p-1 hover:bg-red-500/20 rounded transition-colors group"
                                                            title="Remove quiz"
                                                        >
                                                            <X size={14} className="text-gray-500 group-hover:text-red-400" />
                                                        </button>
                                                    </div>
                                                </div>

                                                <h4 className="font-medium text-white mb-3 leading-snug">
                                                    {question.question}
                                                </h4>

                                                <div className="space-y-1.5 mb-4">
                                                    {question.options.map((option, idx) => (
                                                        <div
                                                            key={idx}
                                                            className={`text-xs px-3 py-1.5 rounded-lg ${idx === question.correctAnswer
                                                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                                                : 'bg-gray-700/50 text-gray-400'
                                                                }`}
                                                        >
                                                            {String.fromCharCode(65 + idx)}. {option}
                                                        </div>
                                                    ))}
                                                </div>

                                                <button
                                                    onClick={() => releaseQuiz(question.id)}
                                                    disabled={releasedQuizzes.includes(question.id)}
                                                    className={`w-full py-2 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${releasedQuizzes.includes(question.id)
                                                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                                        }`}
                                                >
                                                    {releasedQuizzes.includes(question.id) ? (
                                                        <><CheckCircle2 size={16} />Released to Class</>
                                                    ) : (
                                                        <><PlayCircle size={16} />Release to Class</>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Analytics Dashboard (Collapsible) */}
                            {showAnalytics && (
                                <div className="mt-6 space-y-6 animate-in fade-in duration-300">
                                    {/* Stats Cards */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2.5 bg-blue-500/20 rounded-lg">
                                                    <Users size={20} className="text-blue-400" />
                                                </div>
                                                <div>
                                                    <p className="text-2xl font-bold text-white">{getOverallStats().uniqueStudents}</p>
                                                    <p className="text-xs text-gray-400">Students Participated</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2.5 bg-emerald-500/20 rounded-lg">
                                                    <Target size={20} className="text-emerald-400" />
                                                </div>
                                                <div>
                                                    <p className="text-2xl font-bold text-white">{getOverallStats().accuracy}%</p>
                                                    <p className="text-xs text-gray-400">Overall Accuracy</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2.5 bg-purple-500/20 rounded-lg">
                                                    <HelpCircle size={20} className="text-purple-400" />
                                                </div>
                                                <div>
                                                    <p className="text-2xl font-bold text-white">{getOverallStats().questionsAnswered}</p>
                                                    <p className="text-xs text-gray-400">Questions Answered</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2.5 bg-orange-500/20 rounded-lg">
                                                    <TrendingUp size={20} className="text-orange-400" />
                                                </div>
                                                <div>
                                                    <p className="text-2xl font-bold text-white">{getOverallStats().totalResponses}</p>
                                                    <p className="text-xs text-gray-400">Total Responses</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Topic Understanding Chart */}
                                    <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
                                        <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
                                            <BarChart3 size={18} className="text-indigo-400" />
                                            Topic Understanding Breakdown
                                        </h4>
                                        <div className="space-y-4">
                                            {getTopicAnalytics().map((topic) => (
                                                <div key={topic.topic}>
                                                    <div className="flex items-center justify-between mb-1.5">
                                                        <span className="text-sm text-gray-300">{topic.topic}</span>
                                                        <span className="text-sm font-medium text-white">
                                                            {topic.percentage}% ({topic.correct}/{topic.total})
                                                        </span>
                                                    </div>
                                                    <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-500 ${topic.percentage >= 80 ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' :
                                                                topic.percentage >= 60 ? 'bg-gradient-to-r from-yellow-500 to-yellow-400' :
                                                                    'bg-gradient-to-r from-red-500 to-red-400'
                                                                }`}
                                                            style={{ width: `${topic.percentage}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Insights Panel */}
                                    <div className="bg-gradient-to-r from-emerald-500/10 to-blue-500/10 rounded-xl border border-emerald-500/30 p-6">
                                        <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
                                            <Sparkles size={18} className="text-emerald-400" />
                                            AI Insights
                                        </h4>
                                        <div className="space-y-2 text-sm text-gray-300">
                                            <p className="flex items-start gap-2">
                                                <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 shrink-0" />
                                                <span><strong className="text-white">Strong understanding</strong> in Neural Networks and Machine Learning topics</span>
                                            </p>
                                            <p className="flex items-start gap-2">
                                                <AlertCircle size={16} className="text-yellow-400 mt-0.5 shrink-0" />
                                                <span><strong className="text-white">Consider reviewing</strong> Data Structures - some students struggled with complexity analysis</span>
                                            </p>
                                            <p className="flex items-start gap-2">
                                                <TrendingUp size={16} className="text-blue-400 mt-0.5 shrink-0" />
                                                <span><strong className="text-white">Participation rate</strong> is excellent - {getOverallStats().uniqueStudents} out of 5 students engaged with quizzes</span>
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>


                    {/* Clear Content Section */}
                    {contentStats && contentStats.document_count > 0 && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-red-500/20 rounded-lg">
                                        <Trash2 size={24} className="text-red-400" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-white">Lecture Finished?</h3>
                                        <p className="text-sm text-gray-400">Clear all {contentStats.document_count} stored chunks to prepare for the next lecture</p>
                                    </div>
                                </div>
                                <button
                                    onClick={clearContent}
                                    className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                                >
                                    <Trash2 size={18} />
                                    Clear All Content
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* ===== QUIZ GENERATION MODAL ===== */}
            {showGenerateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                    <div className="bg-gray-900 rounded-2xl border border-indigo-500/50 shadow-2xl shadow-indigo-500/20 w-full max-w-lg mx-4 overflow-hidden">
                        {/* Modal Header */}
                        <div className="bg-gradient-to-r from-indigo-600/30 to-purple-600/30 px-6 py-4 border-b border-gray-700 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-500/20 rounded-lg">
                                    <Wand2 size={22} className="text-indigo-400" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-white text-lg">Generate Quiz</h3>
                                    <p className="text-sm text-gray-400">AI will create questions from your content</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowGenerateModal(false)}
                                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                            >
                                <X size={20} className="text-gray-400" />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 space-y-6">
                            {/* Topic Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Select Topic</label>
                                <select
                                    value={selectedTopic}
                                    onChange={(e) => setSelectedTopic(e.target.value)}
                                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                >
                                    {availableTopics.map((topic) => (
                                        <option key={topic} value={topic}>{topic}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Difficulty Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Difficulty Level</label>
                                <div className="grid grid-cols-3 gap-3">
                                    {(['Beginner', 'Intermediate', 'Advanced'] as const).map((level) => (
                                        <button
                                            key={level}
                                            onClick={() => setSelectedDifficulty(level)}
                                            className={`py-3 px-4 rounded-lg font-medium transition-all flex flex-col items-center gap-1 ${selectedDifficulty === level
                                                ? level === 'Beginner' ? 'bg-green-500/20 border-2 border-green-500 text-green-400'
                                                    : level === 'Intermediate' ? 'bg-yellow-500/20 border-2 border-yellow-500 text-yellow-400'
                                                        : 'bg-red-500/20 border-2 border-red-500 text-red-400'
                                                : 'bg-gray-800 border border-gray-700 text-gray-400 hover:border-gray-600'
                                                }`}
                                        >
                                            <span className="text-sm">{level}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Question Count */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Number of Questions: <span className="text-indigo-400 font-bold">{questionCount}</span>
                                </label>
                                <input
                                    type="range"
                                    min="1"
                                    max="10"
                                    value={questionCount}
                                    onChange={(e) => setQuestionCount(parseInt(e.target.value))}
                                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                />
                                <div className="flex justify-between text-xs text-gray-500 mt-1">
                                    <span>1</span>
                                    <span>5</span>
                                    <span>10</span>
                                </div>
                            </div>

                            {/* Preview */}
                            <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                                <p className="text-sm text-gray-400">
                                    <Sparkles size={14} className="inline mr-2 text-purple-400" />
                                    Will generate <strong className="text-white">{questionCount}</strong> {selectedDifficulty.toLowerCase()} questions about <strong className="text-white">{selectedTopic}</strong>
                                </p>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 border-t border-gray-700 bg-gray-800/50 flex justify-end gap-3">
                            <button
                                onClick={() => setShowGenerateModal(false)}
                                className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg font-medium hover:bg-gray-600 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={generateQuiz}
                                disabled={isGenerating}
                                className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium hover:from-indigo-700 hover:to-purple-700 transition-all flex items-center gap-2 disabled:opacity-50"
                            >
                                {isGenerating ? (
                                    <><Loader2 size={18} className="animate-spin" />Generating...</>
                                ) : (
                                    <><Wand2 size={18} />Generate Quiz</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
