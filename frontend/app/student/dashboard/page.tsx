"use client";
import React, { useState, useRef, useEffect } from 'react';
import { useAuth, UserRole } from "@/context/AuthContext";
import Link from 'next/link';
import {
  BookOpen,
  Sparkles,
  MessageCircle,
  Send,
  Loader2,
  RefreshCw,
  Bot,
  User,
  GraduationCap,
  FileText,
  UserCheck,
  HelpCircle,
  X,
  CheckCircle2,
  AlertCircle,
  Brain,
  Bell
} from 'lucide-react';

// API Configuration
const API_BASE_URL = "http://localhost:8000";

// Simple markdown renderer for bold text
const renderMarkdown = (text: string) => {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
};

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function StudentDashboard() {
  // AI Assistant State
  const [summary, setSummary] = useState('');
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isAskLoading, setIsAskLoading] = useState(false);
  const [contentCount, setContentCount] = useState<number | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // ===== QUIZ STATE =====
  interface QuizQuestion {
    id: number;
    topic: string;
    question: string;
    options: string[];
    correctAnswer: number;
  }

  // Hardcoded quiz questions (same as teacher side)
  const quizQuestions: QuizQuestion[] = [
    {
      id: 1,
      topic: "Machine Learning",
      question: "What is supervised learning?",
      options: [
        "Learning without any data",
        "Learning from labeled training data",
        "Learning from unlabeled data only",
        "Learning without a computer"
      ],
      correctAnswer: 1
    },
    {
      id: 2,
      topic: "Data Structures",
      question: "What is the time complexity of binary search?",
      options: ["O(n)", "O(n²)", "O(log n)", "O(1)"],
      correctAnswer: 2
    },
    {
      id: 3,
      topic: "Neural Networks",
      question: "What is an activation function?",
      options: [
        "A function that turns off the network",
        "A function that introduces non-linearity",
        "A function that only works on images",
        "A function that reduces learning rate"
      ],
      correctAnswer: 1
    },
    {
      id: 4,
      topic: "Algorithms",
      question: "What does Big O notation measure?",
      options: [
        "The exact runtime in seconds",
        "Memory usage only",
        "Algorithm efficiency as input grows",
        "Code readability"
      ],
      correctAnswer: 2
    },
    {
      id: 5,
      topic: "Databases",
      question: "What is database normalization?",
      options: [
        "Making database faster",
        "Organizing data to reduce redundancy",
        "Encrypting all data",
        "Backing up the database"
      ],
      correctAnswer: 1
    }
  ];

  // Quiz popup state
  const [showQuizPopup, setShowQuizPopup] = useState(false);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [quizNotification, setQuizNotification] = useState(true); // Show notification by default for demo

  const currentQuestion = quizQuestions[currentQuizIndex];

  const triggerQuiz = () => {
    setShowQuizPopup(true);
    setSelectedAnswer(null);
    setHasSubmitted(false);
    setQuizNotification(false);
  };

  const submitQuizAnswer = () => {
    if (selectedAnswer !== null) {
      setHasSubmitted(true);
    }
  };

  const nextQuestion = () => {
    if (currentQuizIndex < quizQuestions.length - 1) {
      setCurrentQuizIndex(currentQuizIndex + 1);
      setSelectedAnswer(null);
      setHasSubmitted(false);
    } else {
      // All questions done
      setShowQuizPopup(false);
      setCurrentQuizIndex(0);
      setSelectedAnswer(null);
      setHasSubmitted(false);
    }
  };

  const closeQuiz = () => {
    setShowQuizPopup(false);
    setSelectedAnswer(null);
    setHasSubmitted(false);
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/performance/stats`);
      if (response.ok) {
        const data = await response.json();
        setContentCount(data.data?.document_count ?? 0);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const generateSummary = async () => {
    setIsSummaryLoading(true);
    setSummary('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/performance/summary`);

      if (!response.ok) {
        const error = await response.json();
        setSummary(`Error: ${error.detail || 'Failed to generate summary'}`);
        setIsSummaryLoading(false);
        return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        setSummary('Error: Unable to read response');
        setIsSummaryLoading(false);
        return;
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.text) {
                setSummary(prev => prev + parsed.text);
              }
            } catch { }
          }
        }
      }
    } catch {
      setSummary('Error: Failed to connect to server. Is the backend running?');
    } finally {
      setIsSummaryLoading(false);
    }
  };

  const askQuestion = async () => {
    if (!inputMessage.trim() || isAskLoading) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsAskLoading(true);
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    try {
      const response = await fetch(`${API_BASE_URL}/api/performance/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userMessage }),
      });

      if (!response.ok) {
        const error = await response.json();
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1] = { role: 'assistant', content: `Error: ${error.detail || 'Failed to get answer'}` };
          return newMessages;
        });
        setIsAskLoading(false);
        return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1] = { role: 'assistant', content: 'Error: Unable to read response' };
          return newMessages;
        });
        setIsAskLoading(false);
        return;
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.text) {
                setMessages(prev => {
                  const newMessages = [...prev];
                  newMessages[newMessages.length - 1] = {
                    role: 'assistant',
                    content: newMessages[newMessages.length - 1].content + parsed.text
                  };
                  return newMessages;
                });
              }
            } catch { }
          }
        }
      }
    } catch {
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = { role: 'assistant', content: 'Error: Failed to connect to server' };
        return newMessages;
      });
    } finally {
      setIsAskLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      askQuestion();
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">

      <main className="max-w-7xl mx-auto p-8">
        {/* AI Learning Assistant - PRIORITY SECTION */}
        <section className="mb-8">
          <div className="bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-500 rounded-2xl p-[2px]">
            <div className="bg-gray-900 rounded-2xl overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-purple-600/20 via-blue-600/20 to-cyan-500/20 px-6 py-5 border-b border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl">
                      <Sparkles size={24} className="text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">AI Learning Assistant</h2>
                      <p className="text-sm text-gray-400">Get summaries and ask questions about your lectures</p>
                    </div>
                  </div>
                  <span className="flex items-center gap-2 bg-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-full text-sm">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                    AI Ready
                  </span>
                </div>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Summary Section */}
                  <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                    <div className="p-4 border-b border-gray-700 bg-gray-800/50 flex items-center justify-between">
                      <h3 className="font-semibold flex items-center gap-2">
                        <BookOpen size={18} className="text-purple-400" />
                        Lecture Summary
                      </h3>
                      <button
                        onClick={generateSummary}
                        disabled={isSummaryLoading}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                      >
                        {isSummaryLoading ? (
                          <><Loader2 size={16} className="animate-spin" />Generating...</>
                        ) : (
                          <><RefreshCw size={16} />Get Summary</>
                        )}
                      </button>
                    </div>
                    <div className="p-4 h-[400px] overflow-y-auto">
                      {summary ? (
                        <div className="text-gray-300 leading-relaxed whitespace-pre-wrap">{renderMarkdown(summary)}</div>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-500">
                          <BookOpen size={48} className="mb-4 opacity-30" />
                          <p className="text-center">Click &quot;Get Summary&quot; to generate an AI-powered summary of your lecture content</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Chat Section */}
                  <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                    <div className="p-4 border-b border-gray-700 bg-gray-800/50">
                      <h3 className="font-semibold flex items-center gap-2">
                        <MessageCircle size={18} className="text-blue-400" />
                        Ask Questions
                      </h3>
                    </div>

                    {/* Messages */}
                    <div ref={chatContainerRef} className="p-4 h-[320px] overflow-y-auto space-y-4">
                      {messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-500">
                          <MessageCircle size={40} className="mb-3 opacity-30" />
                          <p className="text-center text-sm">Ask any question about the lecture content</p>
                        </div>
                      ) : (
                        messages.map((msg, idx) => (
                          <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.role === 'assistant' && (
                              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                                <Bot size={16} className="text-white" />
                              </div>
                            )}
                            <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200'}`}>
                              <div className="text-sm leading-relaxed whitespace-pre-wrap">
                                {msg.content ? renderMarkdown(msg.content) : <Loader2 size={16} className="animate-spin" />}
                              </div>
                            </div>
                            {msg.role === 'user' && (
                              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-center flex-shrink-0">
                                <User size={16} className="text-white" />
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>

                    {/* Input */}
                    <div className="p-4 border-t border-gray-700 bg-gray-800/50">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={inputMessage}
                          onChange={(e) => setInputMessage(e.target.value)}
                          onKeyDown={handleKeyPress}
                          placeholder="Ask a question about the lecture..."
                          className="flex-1 px-4 py-3 rounded-xl bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          disabled={isAskLoading}
                        />
                        <button
                          onClick={askQuestion}
                          disabled={!inputMessage.trim() || isAskLoading}
                          className="px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isAskLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How to Use AI Assistant */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Sparkles size={18} className="text-purple-400" />
            How to Use AI Assistant
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-gray-400">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold shrink-0">1</div>
              <p>Click <strong className="text-white">"Get Summary"</strong> to generate an AI-powered summary of your lecture content</p>
            </div>
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold shrink-0">2</div>
              <p>Use the <strong className="text-white">chat</strong> to ask specific questions about the lecture material</p>
            </div>
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold shrink-0">3</div>
              <p>Content is provided by your <strong className="text-white">teacher</strong> through uploaded slides and live transcriptions</p>
            </div>
          </div>
        </div>
      </main>

      {/* Quiz Popup Modal */}
      {showQuizPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-gray-900 rounded-2xl border border-indigo-500/50 shadow-2xl shadow-indigo-500/20 w-full max-w-2xl mx-4 overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600/30 to-purple-600/30 px-6 py-4 border-b border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/20 rounded-lg">
                  <Brain size={22} className="text-indigo-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg flex items-center gap-2">
                    Understanding Check
                    <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-[10px] font-medium rounded-full border border-purple-500/30">
                      AI Generated
                    </span>
                  </h3>
                  <p className="text-sm text-gray-400">Question {currentQuizIndex + 1} of {quizQuestions.length}</p>
                </div>
              </div>
              <button
                onClick={closeQuiz}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X size={20} className="text-gray-400" />
              </button>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-gray-800 h-1">
              <div
                className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full transition-all duration-500"
                style={{ width: `${((currentQuizIndex + 1) / quizQuestions.length) * 100}%` }}
              />
            </div>

            {/* Question Content */}
            <div className="p-6">
              {/* Topic Badge */}
              <div className="mb-4">
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${currentQuestion.topic === 'Machine Learning' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                  currentQuestion.topic === 'Data Structures' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                    currentQuestion.topic === 'Neural Networks' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                      currentQuestion.topic === 'Algorithms' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                        'bg-pink-500/20 text-pink-400 border border-pink-500/30'
                  }`}>
                  {currentQuestion.topic}
                </span>
              </div>

              {/* Question */}
              <h4 className="text-xl font-semibold text-white mb-6">{currentQuestion.question}</h4>

              {/* Answer Options */}
              <div className="space-y-3">
                {currentQuestion.options.map((option, idx) => {
                  const isSelected = selectedAnswer === idx;
                  const isCorrect = idx === currentQuestion.correctAnswer;
                  const showResult = hasSubmitted;

                  let optionClass = 'bg-gray-800 border-gray-700 hover:border-indigo-500/50 hover:bg-gray-700/50';

                  if (isSelected && !showResult) {
                    optionClass = 'bg-indigo-500/20 border-indigo-500 ring-2 ring-indigo-500/30';
                  } else if (showResult && isCorrect) {
                    optionClass = 'bg-emerald-500/20 border-emerald-500';
                  } else if (showResult && isSelected && !isCorrect) {
                    optionClass = 'bg-red-500/20 border-red-500';
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => !hasSubmitted && setSelectedAnswer(idx)}
                      disabled={hasSubmitted}
                      className={`w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center gap-3 ${optionClass} ${hasSubmitted ? 'cursor-default' : 'cursor-pointer'}`}
                    >
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${showResult && isCorrect ? 'bg-emerald-500 text-white' :
                        showResult && isSelected && !isCorrect ? 'bg-red-500 text-white' :
                          isSelected ? 'bg-indigo-500 text-white' :
                            'bg-gray-700 text-gray-300'
                        }`}>
                        {showResult && isCorrect ? <CheckCircle2 size={16} /> :
                          showResult && isSelected && !isCorrect ? <X size={16} /> :
                            String.fromCharCode(65 + idx)}
                      </span>
                      <span className={`flex-1 ${showResult && isCorrect ? 'text-emerald-400 font-medium' : 'text-gray-200'}`}>
                        {option}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Feedback Message */}
              {hasSubmitted && (
                <div className={`mt-6 p-4 rounded-xl flex items-start gap-3 animate-in slide-in-from-bottom-2 duration-300 ${selectedAnswer === currentQuestion.correctAnswer
                  ? 'bg-emerald-500/10 border border-emerald-500/30'
                  : 'bg-red-500/10 border border-red-500/30'
                  }`}>
                  {selectedAnswer === currentQuestion.correctAnswer ? (
                    <>
                      <CheckCircle2 size={20} className="text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-emerald-400">Correct!</p>
                        <p className="text-sm text-gray-400">Great job! You understand this concept well.</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <AlertCircle size={20} className="text-red-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-red-400">Not quite right</p>
                        <p className="text-sm text-gray-400">
                          The correct answer is: <strong className="text-white">{currentQuestion.options[currentQuestion.correctAnswer]}</strong>
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="px-6 py-4 border-t border-gray-700 bg-gray-800/50 flex justify-end gap-3">
              {!hasSubmitted ? (
                <button
                  onClick={submitQuizAnswer}
                  disabled={selectedAnswer === null}
                  className={`px-6 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 ${selectedAnswer !== null
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    }`}
                >
                  Submit Answer
                </button>
              ) : (
                <button
                  onClick={nextQuestion}
                  className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-all flex items-center gap-2"
                >
                  {currentQuizIndex < quizQuestions.length - 1 ? 'Next Question' : 'Finish Quiz'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
