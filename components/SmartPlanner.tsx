'use client';

import { useState } from 'react';
import { AlertCircle, Check, CheckCircle2, Eye, GitBranch, Loader2, Search, Sliders, Sparkles, X } from 'lucide-react';
import type { Course, TimetableSection } from '../lib/types';
import type { UserPreferences, ScheduleCombination } from '../lib/preferences';
import { ScheduleGenerator } from '../lib/scheduleGenerator';

interface SmartPlannerProps {
  allCourses: Course[];
  onPreviewSchedule: (sections: TimetableSection[]) => void;
  onApplySchedule: (sections: TimetableSection[]) => void;
  onClearPreview: () => void;
  isPreviewMode: boolean;
  selectedCourses: string[];
  onSelectedCoursesChange: (courses: string[]) => void;
}

const TAG_COLORS = [
  'bg-pink-500',
  'bg-purple-500',
  'bg-blue-500',
  'bg-green-500',
  'bg-yellow-500',
  'bg-orange-500',
  'bg-red-500',
  'bg-indigo-500',
  'bg-teal-500',
  'bg-cyan-500',
];

type PlannerRunStats = InstanceType<typeof ScheduleGenerator>['lastRunStats'];
type PlannerNotice = { type: 'info' | 'success' | 'warning' | 'error'; message: string };

const formatCount = (value: string | number) => {
  try {
    return BigInt(value).toLocaleString();
  } catch {
    return String(value);
  }
};

export default function SmartPlanner({ 
  allCourses, 
  onPreviewSchedule, 
  onApplySchedule,
  onClearPreview,
  isPreviewMode,
  selectedCourses,
  onSelectedCoursesChange,
}: SmartPlannerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [preferences, setPreferences] = useState<UserPreferences>({
    weights: {
      noMorning: 5,
      noEvening: 3,
      noFriday: 7,
      daysOff: 8,
      minimizeGaps: 6,
      compact: 4,
    }
  });
  const [results, setResults] = useState<ScheduleCombination[]>([]);
  const [loading, setLoading] = useState(false);
  const [runStats, setRunStats] = useState<PlannerRunStats | null>(null);
  const [notice, setNotice] = useState<PlannerNotice | null>(null);

  const clearGeneratedResults = () => {
    setResults([]);
    setRunStats(null);
    setNotice(null);
    if (isPreviewMode) onClearPreview();
  };

  // Filter courses based on search (works with or without space)
  const normalizeQuery = (query: string) => {
    return query.toLowerCase().replace(/\s+/g, '');
  };

  const filteredCourses = searchQuery.trim()
    ? allCourses.filter(course => {
        const normalizedQuery = normalizeQuery(searchQuery);
        const normalizedCode = normalizeQuery(course.courseCode);
        const normalizedTitle = normalizeQuery(course.courseTitle);
        const normalizedAcademicInfo = normalizeQuery([
          course.description,
          course.prerequisites,
          course.corequisites,
          course.exclusions,
        ].filter(Boolean).join(' '));
        
        return normalizedCode.includes(normalizedQuery) || 
               normalizedTitle.includes(normalizedQuery) ||
               normalizedAcademicInfo.includes(normalizedQuery) ||
               course.courseCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
               course.courseTitle.toLowerCase().includes(searchQuery.toLowerCase());
      }).slice(0, 20)
    : [];

  const addCourse = (courseCode: string) => {
    if (selectedCourses.length >= 6) {
      setNotice({ type: 'warning', message: 'Remove a course before adding another. Planning supports up to 6 courses per run.' });
      return;
    }
    if (!selectedCourses.includes(courseCode)) {
      onSelectedCoursesChange([...selectedCourses, courseCode]);
      setSearchQuery('');
      clearGeneratedResults();
    }
  };

  const removeCourse = (courseCode: string) => {
    onSelectedCoursesChange(selectedCourses.filter(c => c !== courseCode));
    clearGeneratedResults();
  };

  const clearSelectedCourses = () => {
    onSelectedCoursesChange([]);
    clearGeneratedResults();
  };

  const getTagColor = (index: number) => {
    return TAG_COLORS[index % TAG_COLORS.length];
  };

  const generateSchedules = () => {
    if (selectedCourses.length === 0) {
      setNotice({ type: 'warning', message: 'Add at least one course before generating schedules.' });
      return;
    }

    if (selectedCourses.length > 6) {
      setNotice({ type: 'warning', message: 'Select 6 or fewer courses so the planner can search safely.' });
      return;
    }

    setLoading(true);
    setNotice({ type: 'info', message: 'Building section combinations and removing time conflicts…' });
    setResults([]);
    setRunStats(null);
    if (isPreviewMode) onClearPreview();
    
    setTimeout(() => {
      try {
        const courses = allCourses.filter(c => selectedCourses.includes(c.courseCode));
        if (courses.length !== selectedCourses.length) {
          throw new Error('One or more selected courses are no longer available. Remove them and try again.');
        }
        const generator = new ScheduleGenerator();
        const combinations = generator.generateCombinations(courses, preferences);
        setRunStats(generator.lastRunStats);

        if (combinations.length === 0) {
          setNotice({
            type: 'warning',
            message: generator.lastRunStats.courseOptionCounts.some(course => course.options === 0)
              ? 'At least one selected course has no usable lecture, lab, or tutorial combinations.'
              : 'No conflict-free schedules were found. Try removing a course or choosing different courses.',
          });
        } else if (generator.lastRunStats.truncated) {
          setNotice({
            type: 'warning',
            message: `The search reached its safety limit after ${formatCount(generator.lastRunStats.exploredNodes)} branches. These are the best schedules found in that search.`,
          });
        } else {
          setNotice({
            type: 'success',
            message: `Finished the complete Cartesian search and ranked ${formatCount(generator.lastRunStats.candidateSchedules)} conflict-free schedules.`,
          });
        }

        setResults(combinations.slice(0, 3));
      } catch (error) {
        console.error('Error generating schedules:', error);
        setNotice({
          type: 'error',
          message: error instanceof Error ? error.message : 'The planner could not generate schedules. Try fewer courses.',
        });
      } finally {
        setLoading(false);
      }
    }, 100);
  };

  const updateWeight = (key: keyof UserPreferences['weights'], value: number) => {
    setPreferences(previous => ({
      ...previous,
      weights: { ...previous.weights, [key]: value },
    }));
    clearGeneratedResults();
  };

  const activeStep = results.length > 0 ? 3 : selectedCourses.length > 0 ? 2 : 1;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-[#4A3856] bg-[#2A2134] shadow-xl">
      <div className="flex-1 overflow-visible p-4 sm:p-6 lg:overflow-y-auto">
        <h2 className="text-2xl font-bold text-[#EACDC2] mb-4 flex items-center gap-2">
          <Sparkles className="w-6 h-6" />
          Automated Planning
        </h2>

        <ol className="mb-5 grid grid-cols-3 gap-2 text-center text-[11px] font-semibold text-[#EACDC2]/65" aria-label="Planning steps">
          {['Courses', 'Preferences', 'Compare'].map((label, index) => {
            const step = index + 1;
            return (
              <li
                key={label}
                aria-current={activeStep === step ? 'step' : undefined}
                className={`rounded-lg border px-2 py-2 transition-colors ${
                  activeStep === step
                    ? 'border-[#B75D69]/60 bg-[#B75D69]/25 text-[#F7EDE8]'
                    : step < activeStep
                      ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
                      : 'border-transparent bg-[#372549]'
                }`}
              >
                {step < activeStep ? <Check className="mr-1 inline h-3 w-3" /> : `${step}. `}{label}
              </li>
            );
          })}
        </ol>

        {/* Course Selection */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-semibold text-[#EACDC2]">
              Add Courses ({selectedCourses.length} selected)
            </h3>
            {selectedCourses.length > 0 && (
              <button
                onClick={clearSelectedCourses}
                className="text-xs text-red-400 hover:text-red-300 transition-colors font-medium"
              >
                Clear All
              </button>
            )}
          </div>
          
          {/* Search Input */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#EACDC2]/40" />
            <input
              type="text"
              placeholder="Search courses (e.g., COMP2012 or COMP 2012)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3 py-2.5 bg-[#1A1423]/40 border border-[#B75D69]/30 rounded-lg text-[#EACDC2] text-sm focus:outline-none focus:border-[#B75D69] placeholder:text-[#EACDC2]/40"
            />
          </div>

          {/* Selected Course Tags */}
          {selectedCourses.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3 p-3 bg-[#1A1423]/40 rounded-lg">
              {selectedCourses.map((courseCode, idx) => (
                <div
                  key={courseCode}
                  className={`${getTagColor(idx)} text-white px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 shadow-lg`}
                >
                  {courseCode}
                  <button
                    onClick={() => removeCourse(courseCode)}
                    aria-label={`Remove ${courseCode} from planner`}
                    className="hover:bg-white/20 rounded-full p-0.5 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Search Results Dropdown */}
          {searchQuery.trim() && (
            <div className="bg-[#1A1423]/60 rounded-lg border border-[#B75D69]/30 max-h-64 overflow-y-auto">
              {filteredCourses.length === 0 ? (
                <p className="text-xs text-[#EACDC2]/60 text-center py-4">No courses found</p>
              ) : (
                <div className="divide-y divide-[#B75D69]/10">
                  {filteredCourses.map(course => {
                    const isSelected = selectedCourses.includes(course.courseCode);
                    return (
                      <button
                        key={course.courseCode}
                        onClick={() => !isSelected && addCourse(course.courseCode)}
                        disabled={isSelected}
                        className={`w-full text-left px-3 py-2.5 hover:bg-[#B75D69]/20 transition-colors ${
                          isSelected ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm text-[#EACDC2] flex items-center gap-2">
                              {course.courseCode}
                              {isSelected && (
                                <span className="text-[10px] bg-[#B75D69] text-white px-1.5 py-0.5 rounded">
                                  Added
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-[#EACDC2]/70 truncate">
                              {course.courseTitle}
                            </div>
                            {course.prerequisites && (
                              <div className="mt-1 line-clamp-2 text-[11px] text-amber-200/80">
                                Prerequisites: {course.prerequisites}
                              </div>
                            )}
                            {course.description && (
                              <div className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-[#EACDC2]/55">
                                {course.description}
                              </div>
                            )}
                            <div className="text-[10px] text-[#EACDC2]/50 mt-0.5">
                              {course.department} • {course.credits || 0} credits
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Preference Sliders */}
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-[#EACDC2] mb-2 flex items-center gap-2">
            <Sliders className="w-4 h-4" />
            Preferences
          </h3>
          
          <div className="space-y-2">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs text-[#EACDC2]/80">No Morning Classes</label>
                <span className="text-xs text-[#B75D69] font-semibold">{preferences.weights.noMorning}/10</span>
              </div>
              <input
                aria-label="Avoid morning classes priority"
                type="range"
                min="0"
                max="10"
                value={preferences.weights.noMorning}
                onInput={(e) => updateWeight('noMorning', parseInt(e.currentTarget.value))}
                className="w-full h-2 bg-[#1A1423]/40 rounded-lg appearance-none cursor-pointer accent-[#B75D69]"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs text-[#EACDC2]/80">No Evening Classes</label>
                <span className="text-xs text-[#B75D69] font-semibold">{preferences.weights.noEvening}/10</span>
              </div>
              <input
                aria-label="Avoid evening classes priority"
                type="range"
                min="0"
                max="10"
                value={preferences.weights.noEvening}
                onInput={(e) => updateWeight('noEvening', parseInt(e.currentTarget.value))}
                className="w-full h-2 bg-[#1A1423]/40 rounded-lg appearance-none cursor-pointer accent-[#B75D69]"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs text-[#EACDC2]/80">No Friday Classes</label>
                <span className="text-xs text-[#B75D69] font-semibold">{preferences.weights.noFriday}/10</span>
              </div>
              <input
                aria-label="Avoid Friday classes priority"
                type="range"
                min="0"
                max="10"
                value={preferences.weights.noFriday}
                onInput={(e) => updateWeight('noFriday', parseInt(e.currentTarget.value))}
                className="w-full h-2 bg-[#1A1423]/40 rounded-lg appearance-none cursor-pointer accent-[#B75D69]"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs text-[#EACDC2]/80">Maximize Days Off</label>
                <span className="text-xs text-[#B75D69] font-semibold">{preferences.weights.daysOff}/10</span>
              </div>
              <input
                aria-label="Maximize days off priority"
                type="range"
                min="0"
                max="10"
                value={preferences.weights.daysOff}
                onInput={(e) => updateWeight('daysOff', parseInt(e.currentTarget.value))}
                className="w-full h-2 bg-[#1A1423]/40 rounded-lg appearance-none cursor-pointer accent-[#B75D69]"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs text-[#EACDC2]/80">Minimize Gaps</label>
                <span className="text-xs text-[#B75D69] font-semibold">{preferences.weights.minimizeGaps}/10</span>
              </div>
              <input
                aria-label="Minimize gaps priority"
                type="range"
                min="0"
                max="10"
                value={preferences.weights.minimizeGaps}
                onInput={(e) => updateWeight('minimizeGaps', parseInt(e.currentTarget.value))}
                className="w-full h-2 bg-[#1A1423]/40 rounded-lg appearance-none cursor-pointer accent-[#B75D69]"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs text-[#EACDC2]/80">Compact Schedule</label>
                <span className="text-xs text-[#B75D69] font-semibold">{preferences.weights.compact}/10</span>
              </div>
              <input
                aria-label="Compact schedule priority"
                type="range"
                min="0"
                max="10"
                value={preferences.weights.compact}
                onInput={(e) => updateWeight('compact', parseInt(e.currentTarget.value))}
                className="w-full h-2 bg-[#1A1423]/40 rounded-lg appearance-none cursor-pointer accent-[#B75D69]"
              />
            </div>
          </div>
        </div>

        <button
          onClick={generateSchedules}
          disabled={loading || selectedCourses.length === 0}
          className="mb-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#B75D69] py-2.5 font-semibold text-white transition-colors hover:bg-[#774C60] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : (
            results.length > 0 ? 'Recalculate Schedules' : 'Generate Smart Schedules'
          )}
        </button>

        {notice && (
          <div
            role="status"
            aria-live="polite"
            className={`mb-3 flex items-start gap-2 rounded-xl border p-3 text-xs leading-relaxed ${
              notice.type === 'success'
                ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100'
                : notice.type === 'warning'
                  ? 'border-amber-400/25 bg-amber-400/10 text-amber-100'
                  : notice.type === 'error'
                    ? 'border-red-400/25 bg-red-400/10 text-red-100'
                    : 'border-[#B75D69]/25 bg-[#B75D69]/10 text-[#F4D7D2]'
            }`}
          >
            {notice.type === 'success'
              ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              : notice.type === 'info' && loading
                ? <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
                : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>{notice.message}</span>
          </div>
        )}

        {runStats && (
          <section className="mb-4 rounded-xl border border-[#774C60]/30 bg-[#1A1423]/45 p-3" aria-label="Planning search summary">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-[#F4D7D2]">
              <GitBranch className="h-4 w-4 text-[#B75D69]" />
              Combination audit
            </div>
            <dl className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-[#2A2134] px-2 py-2">
                <dt className="text-[10px] uppercase tracking-wide text-[#EACDC2]/45">Cartesian</dt>
                <dd className="mt-1 truncate text-xs font-bold text-[#F7EDE8]" title={formatCount(runStats.totalCartesianProducts)}>{formatCount(runStats.totalCartesianProducts)}</dd>
              </div>
              <div className="rounded-lg bg-[#2A2134] px-2 py-2">
                <dt className="text-[10px] uppercase tracking-wide text-[#EACDC2]/45">Valid found</dt>
                <dd className="mt-1 text-xs font-bold text-[#F7EDE8]">{formatCount(runStats.candidateSchedules)}</dd>
              </div>
              <div className="rounded-lg bg-[#2A2134] px-2 py-2">
                <dt className="text-[10px] uppercase tracking-wide text-[#EACDC2]/45">Branches</dt>
                <dd className="mt-1 text-xs font-bold text-[#F7EDE8]">{formatCount(runStats.exploredNodes)}</dd>
              </div>
            </dl>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {runStats.courseOptionCounts.map(course => (
                <span key={course.courseCode} className="rounded-full bg-[#372549] px-2 py-1 text-[10px] text-[#EACDC2]/70">
                  {course.courseCode}: {formatCount(course.options)} options
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-semibold text-[#EACDC2]">
                Top {results.length} Schedules
              </h3>
              {isPreviewMode && (
                <button
                  onClick={onClearPreview}
                  className="text-xs text-yellow-400 hover:text-yellow-300 transition-colors"
                >
                  Exit Preview
                </button>
              )}
            </div>
            
            <div className="space-y-3">
              {results.map((result, idx) => {
                const sectionSummary = result.sections
                  .map(section => `${section.courseCode} ${section.sectionCode}`)
                  .join(' · ');
                return (
                <article
                  key={sectionSummary}
                  className={`rounded-xl border bg-[#1A1423]/40 p-3 transition-all ${
                    isPreviewMode ? 'border-yellow-400/50' : 'border-[#B75D69]/20'
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="font-bold text-[#EACDC2] text-sm">
                      Schedule {idx + 1}
                    </span>
                    <span className="rounded-full bg-[#B75D69]/15 px-2.5 py-1 text-sm font-bold text-[#F4D7D2]">
                      {result.score}/100
                    </span>
                  </div>

                  <p className="mb-3 line-clamp-2 text-[11px] leading-relaxed text-[#EACDC2]/55" title={sectionSummary}>
                    {sectionSummary}
                  </p>

                  <div className="mb-3 grid grid-cols-2 gap-1.5 text-[11px] text-[#EACDC2]/70">
                    <div className="rounded-md bg-[#2A2134] px-2 py-1.5">{(result.breakdown.daysOffBonus / 5).toFixed(0)} days off</div>
                    <div className="rounded-md bg-[#2A2134] px-2 py-1.5">{(result.breakdown.morningPenalty / 2).toFixed(0)} morning classes</div>
                    <div className="rounded-md bg-[#2A2134] px-2 py-1.5">{(result.breakdown.eveningPenalty / 2).toFixed(0)} evening classes</div>
                    <div className="rounded-md bg-[#2A2134] px-2 py-1.5">{(result.breakdown.fridayPenalty / 3).toFixed(0)} Friday classes</div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => onPreviewSchedule(result.sections)}
                      className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-yellow-400/25 bg-yellow-500/10 py-2 text-xs font-semibold text-yellow-100 transition-colors hover:bg-yellow-500/20"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Preview
                    </button>
                    <button
                      onClick={() => onApplySchedule(result.sections)}
                      className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#B75D69] py-2 text-xs font-semibold text-white transition-colors hover:bg-[#774C60]"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Apply
                    </button>
                  </div>
                </article>
              );})}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
