"use client";

import React, { useState } from "react";
// Removed unnecessary imports for sidebar/navigation
import {
  BarChart3,
  BrainCircuit,
  Settings2
} from 'lucide-react';

import EngagementDetailsModal from './EngagementDetailsModal';

export default function StudentEngagementPage() {
  // Removed activeTab and manual router logic

  const [stats, setStats] = useState({ total: 0, engaged: 0, active: 0 });
  const [groupStats, setGroupStats] = useState({
    "Front Row": { engaged: 0, total: 0 },
    "Middle Row": { engaged: 0, total: 0 },
    "Back Row": { engaged: 0, total: 0 }
  });
  const [showDetails, setShowDetails] = useState(false);
  const [visualizeGroups, setVisualizeGroups] = useState(false);

  // New Advanced State
  const [visualStyle, setVisualStyle] = useState("dots"); // "dots", "boxes", "detailed"
  const [modalDataKeys, setModalDataKeys] = useState<{ engaged: string, total: string, label: string } | undefined>(undefined);
  const [zoneSettings, setZoneSettings] = useState({ back: 33, front: 66 });

  // ... (keep existing functions)
  const updateZoneSettings = async (back: number, front: number) => {
    setZoneSettings({ back, front });
    try {
      await fetch('http://localhost:8000/settings/zones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ back_split: back / 100, front_split: front / 100 })
      });
    } catch (err) {
      console.error("Failed to update zones:", err);
    }
  };

  const toggleVisualization = async () => {
    try {
      const newState = !visualizeGroups;
      setVisualizeGroups(newState);
      await fetch('http://localhost:8000/settings/visualize-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newState })
      });
    } catch (err) {
      console.error("Failed to toggle visualization:", err);
      // Revert on error
      setVisualizeGroups(!visualizeGroups);
    }
  };

  const changeVisualStyle = async (style: string) => {
    setVisualStyle(style);
    try {
      await fetch('http://localhost:8000/settings/visual-style', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ style: style })
      });
    } catch (err) {
      console.error("Failed to set visual style:", err);
    }
  };

  const handleCardClick = (keys?: { engaged: string, total: string, label: string }) => {
    setModalDataKeys(keys); // If undefined, it uses default global stats
    setShowDetails(true);
  };

  React.useEffect(() => {
    const interval = setInterval(() => {
      // Fetch Global Stats
      fetch('http://localhost:8000/stats', { cache: 'no-store' })
        .then(res => res.json())
        .then(data => setStats(data))
        .catch(err => console.error("Stats fetch error:", err));

      // Fetch Group Stats
      fetch('http://localhost:8000/stats/groups', { cache: 'no-store' })
        .then(res => res.json())
        .then(data => setGroupStats(data))
        .catch(err => console.error("Group Stats fetch error:", err));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Helper to get keys for zone
  const getZoneKeys = (zoneName: string) => {
    if (zoneName === "Front Row") return { engaged: "front_engaged", total: "front_total", label: "Front Row Engagement" };
    if (zoneName === "Middle Row") return { engaged: "mid_engaged", total: "mid_total", label: "Middle Row Engagement" };
    if (zoneName === "Back Row") return { engaged: "back_engaged", total: "back_total", label: "Back Row Engagement" };
    return undefined;
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white overflow-hidden">
      <EngagementDetailsModal
        isOpen={showDetails}
        onClose={() => setShowDetails(false)}
        dataKeys={modalDataKeys}
      />

      <header className="h-16 bg-gray-800/50 backdrop-blur border-b border-gray-700 flex items-center justify-between px-8 sticky top-0 z-10 shrink-0">
        <h2 className="text-lg font-semibold text-gray-200">
          Student Engagement
        </h2>
        <div className="flex items-center gap-4">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-sm text-emerald-400">System Online</span>
        </div>
      </header>

      <main className="p-8 flex-1 overflow-auto">
        <div className="space-y-6">
          {/* Engagement Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
              <h3 className="text-gray-400 text-sm font-medium mb-2">Current Status</h3>
              <div className="text-2xl font-bold text-white">Monitoring Active</div>
              <div className="text-emerald-400 text-sm mt-1">Live feed processing</div>
            </div>
            <div
              className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg cursor-pointer hover:border-blue-500 transition-colors"
              onClick={() => handleCardClick(undefined)}
            >
              <h3 className="text-gray-400 text-sm font-medium mb-2">Class Engagement</h3>
              <div className="text-2xl font-bold text-white">
                {stats.total > 0 ? Math.round((stats.engaged / stats.total) * 100) : 0}%
              </div>
              <div className="text-emerald-400 text-sm mt-1">
                {stats.engaged} / {stats.total} Students Engaged
              </div>
            </div>
            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
              <h3 className="text-gray-400 text-sm font-medium mb-2">Active Students</h3>
              <div className="text-2xl font-bold text-white">{stats.active}</div>
              <div className="text-gray-500 text-sm mt-1">Total in view</div>
            </div>
          </div>

          {/* Zone Analysis - Only visible if visualized */}
          {visualizeGroups && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-4 duration-500">
              {Object.entries(groupStats).map(([zoneName, zoneData]) => (
                <div
                  key={zoneName}
                  className="bg-gray-800/50 p-4 rounded-xl border border-gray-700 cursor-pointer hover:bg-gray-800 hover:border-blue-500/50 transition-all"
                  onClick={() => handleCardClick(getZoneKeys(zoneName))}
                >
                  <h4 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2 flex items-center justify-between">
                    {zoneName}
                    <BarChart3 size={14} className="opacity-50" />
                  </h4>
                  <div className="flex items-end justify-between">
                    <div className="text-xl font-bold text-white">
                      {zoneData.total > 0 ? Math.round((zoneData.engaged / zoneData.total) * 100) : 0}%
                    </div>
                    <div className="text-xs text-gray-500">
                      {zoneData.engaged}/{zoneData.total} Engaged
                    </div>
                  </div>
                  {/* Simple bar visual */}
                  <div className="w-full h-1.5 bg-gray-700 rounded-full mt-3 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${(zoneData.total > 0 && (zoneData.engaged / zoneData.total) > 0.7) ? 'bg-emerald-500' :
                        (zoneData.total > 0 && (zoneData.engaged / zoneData.total) > 0.4) ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                      style={{ width: `${zoneData.total > 0 ? (zoneData.engaged / zoneData.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Video Stream Section */}
          <div className="bg-gray-800 rounded-2xl overflow-hidden border border-gray-700 shadow-2xl relative">
            <div className="p-4 bg-gray-900/50 border-b border-gray-700 flex justify-between items-center">
              <h3 className="font-semibold flex items-center gap-2">
                <BrainCircuit size={18} className="text-blue-400" />
                Live Classroom Feed
              </h3>
              <div className="flex items-center gap-4">
                {/* Visual Style Selector */}
                <div className="flex bg-gray-700/50 rounded-lg p-1 gap-1">
                  {['dots', 'boxes', 'detailed'].map((style) => (
                    <button
                      key={style}
                      onClick={() => changeVisualStyle(style)}
                      className={`px-2 py-1 text-[10px] font-medium rounded uppercase tracking-wider transition-all ${visualStyle === style
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-gray-400 hover:text-gray-200'
                        }`}
                    >
                      {style}
                    </button>
                  ))}
                </div>

                <div className="h-4 w-px bg-gray-700 mx-2"></div>

                {/* Visualization Toggle */}
                <button
                  onClick={toggleVisualization}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${visualizeGroups
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-400 border border-transparent'
                    }`}
                >
                  <div className={`w-2 h-2 rounded-full ${visualizeGroups ? 'bg-blue-400' : 'bg-gray-500'}`} />
                  {visualizeGroups ? 'Zones On' : 'Show Zones'}
                </button>
                <span className="bg-red-500/20 text-red-400 text-xs px-2 py-1 rounded font-mono uppercase">
                  REC
                </span>
              </div>
            </div>

            {/* Zone Configuration Panel */}
            {visualizeGroups && (
              <div className="px-4 py-3 bg-gray-900/30 border-b border-gray-700 flex items-center gap-6 animate-in slide-in-from-top-2">
                <div className="flex items-center gap-2 text-xs text-gray-400 font-medium">
                  <Settings2 size={14} />
                  Zone Calibration
                </div>

                <div className="flex items-center gap-4 flex-1">
                  <div className="flex items-center gap-2 flex-1">
                    <label className="text-[10px] uppercase text-gray-500 font-bold w-16">Back Line</label>
                    <input
                      type="range"
                      min="10" max="90"
                      value={zoneSettings.back}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (val < zoneSettings.front) updateZoneSettings(val, zoneSettings.front);
                      }}
                      className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    <span className="text-xs font-mono text-blue-400 w-8">{zoneSettings.back}%</span>
                  </div>

                  <div className="h-4 w-px bg-gray-700"></div>

                  <div className="flex items-center gap-2 flex-1">
                    <label className="text-[10px] uppercase text-gray-500 font-bold w-16">Front Line</label>
                    <input
                      type="range"
                      min="10" max="90"
                      value={zoneSettings.front}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (val > zoneSettings.back) updateZoneSettings(zoneSettings.back, val);
                      }}
                      className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    <span className="text-xs font-mono text-blue-400 w-8">{zoneSettings.front}%</span>
                  </div>
                </div>
              </div>
            )}

            {/* THE STREAM IMAGE */}
            <div className="relative aspect-video bg-black flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="http://localhost:8000/video_feed"
                alt="Live Classroom Feed"
                className="w-full h-full object-contain"
              />

              <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur px-3 py-1.5 rounded-lg text-xs font-mono text-white/80">
                CAM-01 • 1080p • 30FPS
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
