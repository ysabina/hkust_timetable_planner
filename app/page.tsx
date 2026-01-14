'use client';

import CourseSearch from '../components/CourseSearch';
import WeeklyCalendar from '../components/WeeklyCalendar';
import ConflictAlert from '../components/ConflictAlert';
import { useTimetable } from '../hooks/useTimetable';
import { Calendar } from 'lucide-react';

export default function Home() {
  const { selectedSections, conflicts, addSection, removeSection, switchSection, clearAll } = useTimetable();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1A1423] via-[#372549] to-[#774C60]">
      {/* Header */}
      <header className="bg-[#1A1423]/80 backdrop-blur-sm shadow-xl border-b border-[#372549]">
        <div className="max-w-[1800px] mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-[#B75D69] to-[#774C60] rounded-lg">
                <Calendar className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-[#EACDC2] to-[#B75D69] bg-clip-text text-transparent">
                  HKUST Timetable Planner
                </h1>
                <p className="text-sm text-[#EACDC2]/70">Spring 2025-26</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="px-4 py-2 bg-[#372549]/50 rounded-lg border border-[#774C60]">
                <span className="text-[#EACDC2]/80 text-sm">
                  <span className="font-bold text-[#B75D69]">{selectedSections.length}</span> courses selected
                </span>
              </div>
              {selectedSections.length > 0 && (
                <button
                  onClick={clearAll}
                  className="px-5 py-2 text-sm font-medium text-white bg-gradient-to-r from-[#B75D69] to-[#774C60] hover:from-[#774C60] hover:to-[#B75D69] rounded-lg transition-all duration-300 shadow-lg hover:shadow-[#B75D69]/50"
                >
                  Clear All
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Conflict Alert */}
      {conflicts.length > 0 && (
        <ConflictAlert conflicts={conflicts} />
      )}

      {/* Main Content */}
      <div className="max-w-[1800px] mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[420px,1fr] gap-6">
          {/* Left Sidebar - Course Search */}
          <div className="space-y-4 h-[calc(100vh-200px)]">
            <CourseSearch
              onSelectSection={addSection}
              selectedSections={selectedSections}
              onSwitchSection={switchSection}
            />
          </div>

          {/* Right Side - Calendar */}
          <div className="bg-[#1A1423]/60 backdrop-blur-sm rounded-2xl shadow-2xl border border-[#372549] p-6 h-[calc(100vh-200px)]">
            <WeeklyCalendar
              sections={selectedSections}
              onRemoveSection={removeSection}
              conflicts={conflicts}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
