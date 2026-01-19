'use client';
import { useState, useEffect } from 'react';
import CourseSearch from '../components/CourseSearch';
import WeeklyCalendar from '../components/WeeklyCalendar';
import ConflictAlert from '../components/ConflictAlert';
import SmartPlanner from '../components/SmartPlanner';
import { useTimetable } from '../hooks/useTimetable';
import { courseAPI } from '../lib/api';
import type { Course, TimetableSection } from '../lib/types';
import { Calendar, Search, Sparkles, X } from 'lucide-react';

// ✅ Color palette for courses
const COURSE_COLORS = [
  'bg-[#F75590]', // Wild Strawberry (Pink)
  'bg-[#FCE4D8]', // Powder Petal (Peach)
  'bg-[#FBD87F]', // Jasmine (Yellow)
  'bg-[#B5F8FE]', // Icy Aqua (Light Blue)
  'bg-[#10FFCB]', // Tropical Mint (Mint)
  'bg-[#E7B8FF]', // Lavender (Purple)
  'bg-[#FFD4D4]', // Light Coral
  'bg-[#C4A5E1]', // Soft Purple
  'bg-blue-600', // Deep Blue
  'bg-teal-600', // Teal
  'bg-orange-600', // Orange
];

export default function Home() {
  const { selectedSections, conflicts, addSection, removeSection, switchSection, clearAll } = useTimetable();
  
  const [focusedCourse, setFocusedCourse] = useState<{ code: string; timestamp: number } | null>(null);
  const [activeTab, setActiveTab] = useState<'search' | 'smart'>('search');
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [previewSections, setPreviewSections] = useState<TimetableSection[] | null>(null);
  
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const courses = await courseAPI.getAllCourses();
        setAllCourses(courses);
      } catch (error) {
        console.error('Error fetching courses:', error);
      }
    };
    fetchCourses();
  }, []);
  
  const totalCredits = selectedSections
    .filter(s => s.sectionType === 'LECTURE')
    .reduce((sum, s) => sum + (s.credits || 0), 0);

  // ✅ Function to assign colors to preview sections
  const assignColorsToSections = (sections: TimetableSection[]): TimetableSection[] => {
    const courseColorMap: { [key: string]: string } = {};
    let colorIndex = 0;
    
    return sections.map(section => {
      if (!courseColorMap[section.courseCode]) {
        courseColorMap[section.courseCode] = COURSE_COLORS[colorIndex % COURSE_COLORS.length];
        colorIndex++;
      }
      return {
        ...section,
        color: courseColorMap[section.courseCode]
      };
    });
  };

  // ✅ Sections to display (preview with colors or actual)
  const displaySections = previewSections 
    ? assignColorsToSections(previewSections)
    : selectedSections;

  const previewCredits = previewSections
    ? previewSections.filter(s => s.sectionType === 'LECTURE').reduce((sum, s) => sum + (s.credits || 0), 0)
    : 0;

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
                <p className="text-sm text-[#EACDC2]/70">
                  Spring 2025-26
                  {previewSections && (
                    <span className="ml-2 text-yellow-400 font-semibold">• Preview Mode</span>
                  )}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="px-4 py-2 bg-[#372549]/50 rounded-lg border border-[#774C60]">
                <span className="text-[#EACDC2]/80 text-sm">
                  <span className="font-bold text-[#B75D69]">
                    {previewSections 
                      ? previewSections.filter(s => s.sectionType === 'LECTURE').length
                      : selectedSections.filter(s => s.sectionType === 'LECTURE').length
                    }
                  </span> courses {previewSections ? 'previewing' : 'selected'}
                </span>
              </div>
              {(totalCredits > 0 || previewCredits > 0) && (
                <div className="px-4 py-2 bg-[#372549]/50 rounded-lg border border-[#774C60]">
                  <span className="text-[#EACDC2]/80 text-sm">
                    Total: <span className="font-bold text-[#B75D69]">{previewSections ? previewCredits : totalCredits}</span> credits
                  </span>
                </div>
              )}
              {selectedSections.length > 0 && !previewSections && (
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

      {/* Preview Mode Banner */}
      {previewSections && (
        <div className="bg-yellow-500/10 border-b border-yellow-500/30">
          <div className="max-w-[1800px] mx-auto px-6 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="px-3 py-1 bg-yellow-500 text-black text-xs font-bold rounded-full">
                  PREVIEW
                </div>
                <p className="text-sm text-yellow-200">
                  You're previewing a generated schedule. Click "Exit Preview" to return to your saved schedule.
                </p>
              </div>
              <button
                onClick={() => setPreviewSections(null)}
                className="flex items-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
                Exit Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conflict Alert */}
      {conflicts.length > 0 && (
        <ConflictAlert conflicts={conflicts} />
      )}

      {/* Main Content */}
      <div className="max-w-[1800px] mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[420px,1fr] gap-6">
          
          {/* Left Sidebar */}
          <div className="space-y-4 h-[calc(100vh-200px)] flex flex-col">
            {/* Tab Buttons */}
            <div className="flex gap-2 bg-[#1A1423]/40 p-1 rounded-lg flex-shrink-0">
              <button
                onClick={() => setActiveTab('search')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md font-medium transition-all ${
                  activeTab === 'search'
                    ? 'bg-[#B75D69] text-white shadow-lg'
                    : 'text-[#EACDC2]/60 hover:text-[#EACDC2]'
                }`}
              >
                <Search className="w-4 h-4" />
                Manual Search
              </button>
              <button
                onClick={() => setActiveTab('smart')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md font-medium transition-all ${
                  activeTab === 'smart'
                    ? 'bg-[#B75D69] text-white shadow-lg'
                    : 'text-[#EACDC2]/60 hover:text-[#EACDC2]'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                Smart Planner
              </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto">
              {activeTab === 'search' ? (
                <CourseSearch
                  onSelectSection={addSection}
                  selectedSections={selectedSections}
                  focusedCourse={focusedCourse}
                />
              ) : (
                <SmartPlanner
                  allCourses={allCourses}
                  onPreviewSchedule={(sections: TimetableSection[]) => {
                    setPreviewSections(sections);
                  }}
                  onApplySchedule={(sections: TimetableSection[]) => {
                    clearAll();
                    sections.forEach((s: TimetableSection) => addSection(s));
                    setPreviewSections(null);
                    setActiveTab('search');
                  }}
                  onClearPreview={() => setPreviewSections(null)}
                  isPreviewMode={previewSections !== null}
                />
              )}
            </div>
          </div>

          {/* Right Side - Calendar */}
          <div className="bg-[#1A1423]/60 backdrop-blur-sm rounded-2xl shadow-2xl border border-[#372549] p-6 h-[calc(100vh-200px)] relative">
            {/* Preview Mode Overlay Indicator */}
            {previewSections && (
              <div className="absolute top-4 right-4 z-10">
                <div className="px-3 py-1.5 bg-yellow-500 text-black text-xs font-bold rounded-full shadow-lg animate-pulse">
                  PREVIEW MODE
                </div>
              </div>
            )}
            
            <WeeklyCalendar
              sections={displaySections}
              onRemoveSection={removeSection}
              conflicts={conflicts}
              onCourseClick={(courseCode) => setFocusedCourse({ code: courseCode, timestamp: Date.now() })}
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-[#1A1423]/80 backdrop-blur-sm border-t border-[#372549]">
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-center justify-center gap-3 text-sm">
            <p className="text-[#EACDC2]/60">
              Made with <span className="text-[#B75D69]">♥</span> by{' '}
              <span className="font-semibold text-[#EACDC2]">Sabina Yessaly</span>
            </p>
            <a
              href="https://github.com/ysabina"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#EACDC2]/60 hover:text-[#B75D69] transition-colors"
              aria-label="GitHub Profile"
            >
              <svg
                height="20"
                width="20"
                viewBox="0 0 16 16"
                fill="currentColor"
                className="inline-block"
              >
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
              </svg>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
