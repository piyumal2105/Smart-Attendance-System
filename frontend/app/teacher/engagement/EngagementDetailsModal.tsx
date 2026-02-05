"use client";
import React, { useEffect, useState } from 'react';
import { X, Clock, Users } from 'lucide-react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area
} from 'recharts';

interface EngagementDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    dataKeys?: { // Optional keys to plot specific group data
        engaged: string;
        total: string;
        label: string;
    };
}

interface DataPoint {
    timestamp: number;
    engaged: number;
    total: number;
    // Dynamic keys for groups
    [key: string]: number;
}

export default function EngagementDetailsModal({ isOpen, onClose, dataKeys }: EngagementDetailsModalProps) {
    const [history, setHistory] = useState<DataPoint[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isOpen) return;

        // Fetch immediately then poll
        const fetchData = () => {
            fetch('http://localhost:8000/stats/history', { cache: 'no-store' })
                .then(res => res.json())
                .then(data => {
                    setHistory(data);
                    setLoading(false);
                })
                .catch(err => console.error("History fetch error:", err));
        };

        fetchData();
        const interval = setInterval(fetchData, 2000); // Poll every 2s

        return () => clearInterval(interval);
    }, [isOpen]);

    if (!isOpen) return null;

    const keyEngaged = dataKeys?.engaged || 'engaged';
    const keyTotal = dataKeys?.total || 'total';
    const chartLabel = dataKeys?.label || 'Total Engagement';

    // Process data for graph
    const chartData = history.map(point => ({
        time: new Date(point.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        percentage: point[keyTotal] > 0 ? Math.round((point[keyEngaged] / point[keyTotal]) * 100) : 0,
        count: point[keyEngaged],
        total: point[keyTotal]
    }));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-gray-800 border border-gray-700 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-700 bg-gray-900/50">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Clock className="text-blue-400" />
                            Engagement History
                        </h2>
                        <p className="text-sm text-gray-400 mt-1">Real-time analysis of current session</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Stats Summary */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-gray-700/30 p-4 rounded-xl border border-gray-600/50">
                            <div className="text-gray-400 text-sm mb-1">Average Engagement</div>
                            <div className="text-2xl font-bold text-white">
                                {chartData.length > 0
                                    ? Math.round(chartData.reduce((acc, curr) => acc + curr.percentage, 0) / chartData.length)
                                    : 0}%
                            </div>
                        </div>
                        <div className="bg-gray-700/30 p-4 rounded-xl border border-gray-600/50">
                            <div className="text-gray-400 text-sm mb-1">Peak Engagement</div>
                            <div className="text-2xl font-bold text-emerald-400">
                                {chartData.length > 0
                                    ? Math.max(...chartData.map(d => d.percentage))
                                    : 0}%
                            </div>
                        </div>
                        <div className="bg-gray-700/30 p-4 rounded-xl border border-gray-600/50">
                            <div className="text-gray-400 text-sm mb-1">Data Points</div>
                            <div className="text-2xl font-bold text-blue-400">{history.length}</div>
                        </div>
                    </div>

                    {/* Chart */}
                    <div className="h-[400px] w-full bg-gray-900/50 rounded-xl p-4 border border-gray-700">
                        {loading ? (
                            <div className="h-full flex items-center justify-center text-gray-500">
                                Loading history data...
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}>
                                    <defs>
                                        <linearGradient id="colorEngagement" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                    <XAxis
                                        dataKey="time"
                                        stroke="#9CA3AF"
                                        tick={{ fill: '#9CA3AF' }}
                                        tickLine={{ stroke: '#9CA3AF' }}
                                    />
                                    <YAxis
                                        stroke="#9CA3AF"
                                        tick={{ fill: '#9CA3AF' }}
                                        tickLine={{ stroke: '#9CA3AF' }}
                                        domain={[0, 100]}
                                    />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#fff' }}
                                        itemStyle={{ color: '#fff' }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="percentage"
                                        stroke="#3B82F6"
                                        strokeWidth={2}
                                        fillOpacity={1}
                                        fill="url(#colorEngagement)"
                                        name="Engagement %"
                                        isAnimationActive={false}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
