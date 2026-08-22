'use client';
import { useState, useEffect } from 'react';
import CourseSearch from '../components/CourseSearch';
import WeeklyCalendar from '../components/WeeklyCalendar';
import ConflictAlert from '../components/ConflictAlert';
import SmartPlanner from '../components/SmartPlanner';
import { useTimetable } from '../hooks/useTimetable';
import { courseAPI, mergeRefreshedSections } from '../lib/api';
import type { Course, TimetableSection } from '../lib/types';
import { Calendar, Search, Sparkles, X, RefreshCw, Trash2 } from 'lucide-react';

export default function Home() {
  const {
    selectedSections,
    conflicts,
    addSection,
    removeSection,
    refreshSections,
    activePaletteId,
    setPalette,
    setCourseColor,
    colorizeSections,
    clearAll,
  } = useTimetable();
  
  const [focusedCourse, setFocusedCourse] = useState<{ code: string; timestamp: number } | null>(null);
  const [activeTab, setActiveTab] = useState<'search' | 'smart'>('search');
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [previewSections, setPreviewSections] = useState<TimetableSection[] | null>(null);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshStatus, setRefreshStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [courseBasket, setCourseBasket] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem('smart-planner-courses');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const courses = await courseAPI.getAllCourses();
        setAllCourses(courses);
        setLastUpdated(new Date());
      } catch (error) {
        console.error('Error fetching courses:', error);
      } finally {
        setLoadingCourses(false);
      }
    };
    fetchCourses();
  }, []);

  useEffect(() => {
    const selectedCodes = [...new Set(selectedSections.map(section => section.courseCode))];
    if (selectedCodes.length > 0) {
      setCourseBasket(previous => [...new Set([...previous, ...selectedCodes])]);
    }
  }, [selectedSections]);

  useEffect(() => {
    localStorage.setItem('smart-planner-courses', JSON.stringify(courseBasket));
  }, [courseBasket]);

  const handleRefreshCourses = async () => {
    setIsRefreshing(true);
    setRefreshStatus(null);
    try {
      const { courses, refreshedAt } = await courseAPI.refreshCourses();
      setAllCourses(courses);
      refreshSections(courses);
      setPreviewSections(previous => previous ? mergeRefreshedSections(previous, courses) : null);
      setLastUpdated(new Date(refreshedAt));
      const refreshedTime = new Date(refreshedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setRefreshStatus({
        type: 'success',
        message: `Updated ${courses.length.toLocaleString()} courses at ${refreshedTime}.`,
      });
    } catch (error) {
      console.error('Error refreshing courses:', error);
      setRefreshStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unable to refresh course data.',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSelectSection = (section: TimetableSection) => {
    addSection(section);
    setCourseBasket(previous => previous.includes(section.courseCode)
      ? previous
      : [...previous, section.courseCode]);
  };

  const handleRemoveCourse = (courseCode: string) => {
    removeSection(courseCode);
    setCourseBasket(previous => previous.filter(code => code !== courseCode));
  };

  const handleClearAll = () => {
    clearAll();
    setCourseBasket([]);
    setPreviewSections(null);
  };
  
  const calculateCredits = (sections: TimetableSection[]) => {
    const creditsByCourse = new Map<string, number>();
    sections.forEach(section => {
      if (!creditsByCourse.has(section.courseCode)) {
        creditsByCourse.set(section.courseCode, section.credits || 0);
      }
    });
    return [...creditsByCourse.values()].reduce((sum, credits) => sum + credits, 0);
  };

  const totalCredits = calculateCredits(selectedSections);

  const displaySections = previewSections 
    ? colorizeSections(previewSections)
    : selectedSections;

  const previewCredits = previewSections
    ? calculateCredits(previewSections)
    : 0;
  const displayedCourseCount = new Set(
    (previewSections || selectedSections).map(section => section.courseCode)
  ).size;

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#171220] text-[#EACDC2]">
      {/* Header */}
      <header className="bg-[#1A1423]/80 backdrop-blur-sm shadow-xl border-b border-[#372549]">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 py-4 sm:py-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-[#B75D69] to-[#774C60] rounded-lg">
                <Calendar className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold leading-tight text-[#F7EDE8] sm:text-3xl">
                  HKUST Timetable Planner
                </h1>
                <p className="text-sm text-[#EACDC2]/70">
                  Fall 2026-27
                  {previewSections && (
                    <span className="ml-2 text-yellow-400 font-semibold">• Preview Mode</span>
                  )}
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center xl:justify-end">
              <button
                onClick={handleRefreshCourses}
                disabled={isRefreshing || loadingCourses}
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#774C60] bg-[#272033] px-3 py-2 text-sm font-medium text-[#F7EDE8] transition-colors hover:bg-[#372549] disabled:cursor-not-allowed disabled:opacity-60 sm:px-4"
                title="Refresh live course, quota, and enrollment data from HKUST"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Refreshing…' : 'Refresh Data'}
              </button>
              <div className="flex min-h-11 items-center justify-center rounded-xl border border-[#4A3856] bg-[#272033] px-3 py-2 sm:px-4">
                <span className="text-[#EACDC2]/80 text-sm">
                  <span className="font-bold text-[#B75D69]">
                    {displayedCourseCount}
                  </span> courses {previewSections ? 'previewing' : 'selected'}
                </span>
              </div>
              {(totalCredits > 0 || previewCredits > 0) && (
                <div className="flex min-h-11 items-center justify-center rounded-xl border border-[#4A3856] bg-[#272033] px-3 py-2 sm:px-4">
                  <span className="text-[#EACDC2]/80 text-sm">
                    Total: <span className="font-bold text-[#B75D69]">{previewSections ? previewCredits : totalCredits}</span> credits
                  </span>
                </div>
              )}
              {selectedSections.length > 0 && !previewSections && (
                <button
                  onClick={handleClearAll}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#B75D69] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#C96B77]"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear All
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {refreshStatus && (
        <div className={refreshStatus.type === 'success'
          ? 'bg-emerald-500/10 border-b border-emerald-500/30'
          : 'bg-red-500/10 border-b border-red-500/30'}>
          <div role="status" aria-live="polite" className={`max-w-[1800px] mx-auto px-4 sm:px-6 py-2 text-sm ${
            refreshStatus.type === 'success' ? 'text-emerald-200' : 'text-red-200'
          }`}>
            {refreshStatus.message}
          </div>
        </div>
      )}

      {isRefreshing && (
        <div className="border-b border-[#B75D69]/25 bg-[#B75D69]/10">
          <div role="status" aria-live="polite" className="mx-auto flex max-w-[1800px] items-center gap-2 px-4 py-2 text-sm text-[#F4D7D2] sm:px-6">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Fetching current sections, enrollment and quota data. Your existing timetable remains available.
          </div>
        </div>
      )}

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
                  You are previewing a generated schedule. Exit preview to return to your saved schedule.
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
      <div className="max-w-[1800px] mx-auto px-4 py-5 sm:px-6 sm:py-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs text-[#EACDC2]/60">
          <span>{allCourses.length.toLocaleString()} courses available</span>
          <span>{lastUpdated ? `Data loaded ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Loading course data…'}</span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[420px,1fr] gap-6">
          
          {/* Left Sidebar */}
          <div className="flex h-auto min-w-0 flex-col space-y-4 lg:h-[calc(100vh-225px)]">
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
                Automated Planning
              </button>
            </div>

            {/* Tab Content */}
            <div className="min-h-0 flex-1 overflow-visible lg:overflow-y-auto">
              {activeTab === 'search' ? (
                <CourseSearch
                  allCourses={allCourses}
                  loading={loadingCourses}
                  onSelectSection={handleSelectSection}
                  selectedSections={selectedSections}
                  focusedCourse={focusedCourse}
                />
              ) : (
                <SmartPlanner
                  allCourses={allCourses}
                  selectedCourses={courseBasket}
                  onSelectedCoursesChange={setCourseBasket}
                  onPreviewSchedule={(sections: TimetableSection[]) => {
                    setPreviewSections(sections);
                  }}
                  onApplySchedule={(sections: TimetableSection[]) => {
                    clearAll();
                    sections.forEach((s: TimetableSection) => addSection(s));
                    setCourseBasket([...new Set(sections.map(section => section.courseCode))]);
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
          <div className="relative min-w-0 rounded-2xl border border-[#372549] bg-[#211A2B] p-4 shadow-2xl sm:p-6 lg:h-[calc(100vh-225px)]">
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
              allCourses={allCourses}
              onRemoveSection={handleRemoveCourse}
              onSwapSection={handleSelectSection}
              activePaletteId={activePaletteId}
              onPaletteChange={setPalette}
              onCourseColorChange={setCourseColor}
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
