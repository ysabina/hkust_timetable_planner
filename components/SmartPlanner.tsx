'use client';

import { useState } from 'react';
import { Sparkles, Sliders, Loader2, X, Search } from 'lucide-react';
import type { Course, TimetableSection } from '../lib/types';
import type { UserPreferences, ScheduleCombination } from '../lib/preferences';
import { ScheduleGenerator } from '../lib/scheduleGenerator';

interface SmartPlannerProps {
  allCourses: Course[];
  onPreviewSchedule: (sections: TimetableSection[]) => void;
  onApplySchedule: (sections: TimetableSection[]) => void;
  onClearPreview: () => void;
  isPreviewMode: boolean;
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

export default function SmartPlanner({ 
  allCourses, 
  onPreviewSchedule, 
  onApplySchedule,
  onClearPreview,
  isPreviewMode
}: SmartPlannerProps) {
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
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

  // Filter courses based on search (works with or without space)
  const normalizeQuery = (query: string) => {
    return query.toLowerCase().replace(/\s+/g, ''); // Remove all spaces
  };

  const filteredCourses = searchQuery.trim()
    ? allCourses.filter(course => {
        const normalizedQuery = normalizeQuery(searchQuery);
        const normalizedCode = normalizeQuery(course.courseCode);
        const normalizedTitle = normalizeQuery(course.courseTitle);
        
        return normalizedCode.includes(normalizedQuery) || 
               normalizedTitle.includes(normalizedQuery) ||
               course.courseCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
               course.courseTitle.toLowerCase().includes(searchQuery.toLowerCase());
      }).slice(0, 20) // Limit to 20 results
    : [];

  const addCourse = (courseCode: string) => {
    if (!selectedCourses.includes(courseCode)) {
      setSelectedCourses(prev => [...prev, courseCode]);
      setSearchQuery(''); // Clear search after adding
    }
  };

  const removeCourse = (courseCode: string) => {
    setSelectedCourses(prev => prev.filter(c => c !== courseCode));
  };

  const getTagColor = (index: number) => {
    return TAG_COLORS[index % TAG_COLORS.length];
  };

  const generateSchedules = () => {
    if (selectedCourses.length === 0) {
      alert('Please select at least one course');
      return;
    }

    if (selectedCourses.length > 6) {
      alert('Please select 6 or fewer courses for optimal performance');
      return;
    }

    setLoading(true);
    
    setTimeout(() => {
      try {
        const courses = allCourses.filter(c => selectedCourses.includes(c.courseCode));
        const generator = new ScheduleGenerator();
        const combinations = generator.generateCombinations(courses, preferences);
        
        if (combinations.length === 0) {
          alert('No valid schedules found. Try adjusting your preferences or course selection.');
        }
        
        setResults(combinations.slice(0, 10)); // Top 10 results
      } catch (error) {
        console.error('Error generating schedules:', error);
        alert('Error generating schedules. Please try with fewer courses.');
      } finally {
        setLoading(false);
      }
    }, 100);
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-[#372549] to-[#774C60] rounded-lg shadow-xl overflow-hidden">
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <h2 className="text-2xl font-bold text-[#EACDC2] mb-4 flex items-center gap-2">
          <Sparkles className="w-6 h-6" />
          Smart Planner
        </h2>

        {/* Course Selection */}
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-[#EACDC2] mb-2">
            Add Courses ({selectedCourses.length} selected)
          </h3>
          
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
                type="range"
                min="0"
                max="10"
                value={preferences.weights.noMorning}
                onChange={(e) => setPreferences(prev => ({
                  ...prev,
                  weights: { ...prev.weights, noMorning: parseInt(e.target.value) }
                }))}
                className="w-full h-2 bg-[#1A1423]/40 rounded-lg appearance-none cursor-pointer accent-[#B75D69]"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs text-[#EACDC2]/80">No Evening Classes</label>
                <span className="text-xs text-[#B75D69] font-semibold">{preferences.weights.noEvening}/10</span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                value={preferences.weights.noEvening}
                onChange={(e) => setPreferences(prev => ({
                  ...prev,
                  weights: { ...prev.weights, noEvening: parseInt(e.target.value) }
                }))}
                className="w-full h-2 bg-[#1A1423]/40 rounded-lg appearance-none cursor-pointer accent-[#B75D69]"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs text-[#EACDC2]/80">No Friday Classes</label>
                <span className="text-xs text-[#B75D69] font-semibold">{preferences.weights.noFriday}/10</span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                value={preferences.weights.noFriday}
                onChange={(e) => setPreferences(prev => ({
                  ...prev,
                  weights: { ...prev.weights, noFriday: parseInt(e.target.value) }
                }))}
                className="w-full h-2 bg-[#1A1423]/40 rounded-lg appearance-none cursor-pointer accent-[#B75D69]"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs text-[#EACDC2]/80">Maximize Days Off</label>
                <span className="text-xs text-[#B75D69] font-semibold">{preferences.weights.daysOff}/10</span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                value={preferences.weights.daysOff}
                onChange={(e) => setPreferences(prev => ({
                  ...prev,
                  weights: { ...prev.weights, daysOff: parseInt(e.target.value) }
                }))}
                className="w-full h-2 bg-[#1A1423]/40 rounded-lg appearance-none cursor-pointer accent-[#B75D69]"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs text-[#EACDC2]/80">Minimize Gaps</label>
                <span className="text-xs text-[#B75D69] font-semibold">{preferences.weights.minimizeGaps}/10</span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                value={preferences.weights.minimizeGaps}
                onChange={(e) => setPreferences(prev => ({
                  ...prev,
                  weights: { ...prev.weights, minimizeGaps: parseInt(e.target.value) }
                }))}
                className="w-full h-2 bg-[#1A1423]/40 rounded-lg appearance-none cursor-pointer accent-[#B75D69]"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs text-[#EACDC2]/80">Compact Schedule</label>
                <span className="text-xs text-[#B75D69] font-semibold">{preferences.weights.compact}/10</span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                value={preferences.weights.compact}
                onChange={(e) => setPreferences(prev => ({
                  ...prev,
                  weights: { ...prev.weights, compact: parseInt(e.target.value) }
                }))}
                className="w-full h-2 bg-[#1A1423]/40 rounded-lg appearance-none cursor-pointer accent-[#B75D69]"
              />
            </div>
          </div>
        </div>

        <button
          onClick={generateSchedules}
          disabled={loading || selectedCourses.length === 0}
          className="w-full bg-[#B75D69] hover:bg-[#774C60] text-white py-2.5 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mb-4"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : (
            'Generate Smart Schedules'
          )}
        </button>

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
            
            <div className="space-y-2">
              {results.map((result, idx) => (
                <div 
                  key={idx} 
                  className={`bg-[#1A1423]/40 rounded-lg p-3 border transition-all ${
                    isPreviewMode ? 'border-yellow-400/50' : 'border-[#B75D69]/20'
                  }`}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-[#EACDC2] text-sm">
                      Schedule {idx + 1}
                    </span>
                    <span className="text-[#B75D69] font-semibold text-sm">
                      Score: {result.score.toFixed(1)}/100
                    </span>
                  </div>
                  
                  <div className="text-xs text-[#EACDC2]/70 space-y-1 mb-3">
                    <div>📅 Days off: {(result.breakdown.daysOffBonus / 5).toFixed(0)}</div>
                    <div>🌅 Morning classes: {(result.breakdown.morningPenalty / 2).toFixed(0)}</div>
                    <div>🌙 Evening classes: {(result.breakdown.eveningPenalty / 2).toFixed(0)}</div>
                    <div>📆 Friday classes: {(result.breakdown.fridayPenalty / 3).toFixed(0)}</div>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => onPreviewSchedule(result.sections)}
                      className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white py-2 rounded-md text-xs font-medium transition-colors"
                    >
                      👁️ Preview
                    </button>
                    <button
                      onClick={() => onApplySchedule(result.sections)}
                      className="flex-1 bg-[#B75D69] hover:bg-[#774C60] text-white py-2 rounded-md text-xs font-medium transition-colors"
                    >
                      ✓ Apply
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
