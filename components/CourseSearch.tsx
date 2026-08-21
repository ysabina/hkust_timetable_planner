'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Plus, ChevronDown, ChevronRight, Loader2, BookOpen, AlertTriangle, Compass } from 'lucide-react';
import type { Course, TimetableSection, Section } from '../lib/types';

interface CourseSearchProps {
  allCourses: Course[];
  loading: boolean;
  onSelectSection: (section: TimetableSection) => void;
  selectedSections: TimetableSection[];
  focusedCourse?: { code: string; timestamp: number } | null;
}

export default function CourseSearch({ allCourses, loading, onSelectSection, selectedSections, focusedCourse }: CourseSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);
  const [expandedDept, setExpandedDept] = useState<Set<string>>(new Set());

  // REFS - one for each course card
  const courseRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);

// Auto-scroll when focusedCourse changes
useEffect(() => {
  if (!focusedCourse) return;
  let scrollTimer: ReturnType<typeof setTimeout> | undefined;
  const focusTimer = setTimeout(() => {
    const courseDept = allCourses.find(c => c.courseCode === focusedCourse.code)?.department;
    if (courseDept) {
      setExpandedDept(prev => new Set([...prev, courseDept]));
      setSelectedDept(courseDept);
    }
    setExpandedCourse(focusedCourse.code);
    scrollTimer = setTimeout(() => {
    const element = courseRefs.current[focusedCourse.code];
    
    if (!element) {
      console.warn(`⚠️ Element not found for ${focusedCourse.code} - might still be rendering`);
      return;
    }

    // Scroll the element into view
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });

    // Add temporary highlight animation
    element.classList.add('ring-2', 'ring-[#B75D69]', 'ring-offset-2', 'ring-offset-[#1A1423]');

    // Clear any existing highlight timeout
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }

    // Remove highlight after 2 seconds
    highlightTimeoutRef.current = setTimeout(() => {
      if (element) {
        element.classList.remove('ring-2', 'ring-[#B75D69]', 'ring-offset-2', 'ring-offset-[#1A1423]');
      }
      highlightTimeoutRef.current = null;
    }, 2000);

    }, 300);
  }, 0);

  // Cleanup
  return () => {
    clearTimeout(focusTimer);
    if (scrollTimer) clearTimeout(scrollTimer);
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = null;
    }
  };
}, [focusedCourse, allCourses]); 

  const filteredCourses = useMemo(() => {
    if (!searchQuery.trim()) {
      return selectedDept ? allCourses.filter(course => course.department === selectedDept) : [];
    }
    
    const query = searchQuery.toLowerCase();
    // Remove spaces for flexible matching (ELEC1200 or ELEC 1200)
    const queryNoSpaces = query.replace(/\s+/g, '');
    
    return allCourses.filter(course => {
      const courseCodeNoSpaces = course.courseCode.toLowerCase().replace(/\s+/g, '');
      const courseTitleLower = course.courseTitle.toLowerCase();
      const deptLower = course.department.toLowerCase();
      const academicInfoLower = [
        course.description,
        course.prerequisites,
        course.corequisites,
        course.exclusions,
        course.attributes,
      ].filter(Boolean).join(' ').toLowerCase();
      
      return (
        // Match with or without spaces in course code
        courseCodeNoSpaces.includes(queryNoSpaces) ||
        course.courseCode.toLowerCase().includes(query) ||
        // Match course title
        courseTitleLower.includes(query) ||
        // Match department
        deptLower.includes(query) ||
        academicInfoLower.includes(query)
      );
    });
  }, [searchQuery, selectedDept, allCourses]);

  const departments = useMemo(() => {
    const counts = new Map<string, number>();
    allCourses.forEach(course => counts.set(course.department, (counts.get(course.department) || 0) + 1));
    return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [allCourses]);

  const popularDepartments = useMemo(() => [...departments]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6), [departments]);

  const coursesByDepartment = useMemo(() => {
    const grouped: { [dept: string]: Course[] } = {};
    
    filteredCourses.forEach(course => {
      if (!grouped[course.department]) {
        grouped[course.department] = [];
      }
      grouped[course.department].push(course);
    });
    
    return Object.keys(grouped)
      .sort()
      .reduce((acc, dept) => {
        acc[dept] = grouped[dept].sort((a, b) => 
          a.courseCode.localeCompare(b.courseCode)
        );
        return acc;
      }, {} as { [dept: string]: Course[] });
  }, [filteredCourses]);

  const toggleCourse = (courseCode: string) => {
    setExpandedCourse(expandedCourse === courseCode ? null : courseCode);
  };

  const toggleDepartment = (dept: string) => {
    const newExpanded = new Set(expandedDept);
    if (newExpanded.has(dept)) {
      newExpanded.delete(dept);
    } else {
      newExpanded.add(dept);
    }
    setExpandedDept(newExpanded);
  };

  const isAdded = (courseCode: string, sectionCode: string) => {
    return selectedSections.some(s => 
      s.courseCode === courseCode && s.sectionCode === sectionCode
    );
  };

  const getExistingSectionOfType = (courseCode: string, sectionType: string) => {
    return selectedSections.find(s => 
      s.courseCode === courseCode && s.sectionType === sectionType
    );
  };

  const getMissingComponents = (course: Course, selectedLecture: Section) => {
    const missing: string[] = [];
    
    // Check if there are labs matching this lecture
    const matchingLab = course.sections.find(s => 
      s.sectionType === 'LAB' && s.linkedSection === selectedLecture.sectionCode
    );
    
    if (matchingLab) {
      const labAdded = selectedSections.some(s => 
        s.courseCode === course.courseCode && s.sectionCode === matchingLab.sectionCode
      );
      if (!labAdded) {
        missing.push(`Lab ${matchingLab.sectionCode}`);
      }
    }
    
    // Check if there are tutorials
    const tutorials = course.sections.filter(s => s.sectionType === 'TUTORIAL');
    if (tutorials.length > 0) {
      const tutorialAdded = selectedSections.some(s => 
        s.courseCode === course.courseCode && s.sectionType === 'TUTORIAL'
      );
      if (!tutorialAdded) {
        missing.push('Tutorial');
      }
    }
    
    return missing;
  };

  const handleAddSection = (course: Course, section: Section) => {
    const timetableSection: TimetableSection = {
      ...section,
      courseCode: course.courseCode,
      courseTitle: course.courseTitle,
      credits: course.credits || 0,
    };
    onSelectSection(timetableSection);
  };

  const isDepartmentExpanded = (department: string) => expandedDept.has(department) || (
    Boolean(searchQuery.trim()) && Object.keys(coursesByDepartment).length === 1
  );

  return (
    <div className="flex h-full flex-col rounded-2xl border border-[#4A3856] bg-[#2A2134] p-4 shadow-xl sm:p-6">
      <h2 className="text-2xl font-bold text-[#EACDC2] mb-4 flex items-center gap-2">
        <Search className="w-6 h-6" />
        Course Search
      </h2>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#EACDC2]/60 w-5 h-5" />
        <input
          type="text"
          placeholder="Search by course code, title, or department..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (e.target.value) setSelectedDept('');
          }}
          className="w-full pl-10 pr-4 py-2.5 bg-[#1A1423]/40 border border-[#B75D69]/30 rounded-lg 
                     text-[#EACDC2] placeholder-[#EACDC2]/50 focus:outline-none focus:ring-2 
                     focus:ring-[#B75D69] focus:border-transparent transition-all"
        />
      </div>

      <label className="mb-4 block text-xs font-medium text-[#EACDC2]/70">
        Browse a department
        <select
          value={selectedDept}
          onChange={(event) => {
            setSelectedDept(event.target.value);
            setSearchQuery('');
            setExpandedDept(event.target.value ? new Set([event.target.value]) : new Set());
          }}
          className="mt-1.5 min-h-11 w-full rounded-lg border border-[#B75D69]/30 bg-[#1A1423] px-3 text-sm text-[#EACDC2] outline-none focus:ring-2 focus:ring-[#B75D69]"
        >
          <option value="">Choose a department…</option>
          {departments.map(([department, count]) => (
            <option key={department} value={department}>{department} ({count})</option>
          ))}
        </select>
      </label>

      {(searchQuery || selectedDept) && (
        <div className="mb-3 px-2">
          <p className="text-sm text-[#EACDC2]/70">
            Found {filteredCourses.length} course{filteredCourses.length !== 1 ? 's' : ''} 
            {' '}in {Object.keys(coursesByDepartment).length} department{Object.keys(coursesByDepartment).length !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      <div className="flex-1 space-y-3 pr-0 lg:overflow-y-auto lg:pr-2">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#B75D69] animate-spin" />
          </div>
        ) : Object.keys(coursesByDepartment).length === 0 ? (
          <div className="rounded-xl border border-[#B75D69]/15 bg-[#1A1423]/35 px-4 py-8 text-center">
            {searchQuery ? <BookOpen className="mx-auto mb-3 h-10 w-10 text-[#EACDC2]/30" /> : <Compass className="mx-auto mb-3 h-10 w-10 text-[#B75D69]" />}
            <p className="font-medium text-[#EACDC2]">
              {searchQuery ? 'No matching courses' : 'Find your first course'}
            </p>
            <p className="mx-auto mt-1 max-w-xs text-sm text-[#EACDC2]/55">
              {searchQuery ? 'Try a course code, title, or another department.' : 'Search by code or title, or start with a popular department.'}
            </p>
            {!searchQuery && !loading && (
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {popularDepartments.map(([department, count]) => (
                  <button
                    key={department}
                    onClick={() => {
                      setSelectedDept(department);
                      setExpandedDept(new Set([department]));
                    }}
                    className="min-h-10 rounded-full border border-[#774C60] bg-[#372549] px-3 text-xs font-semibold text-[#F4D7D2] transition-colors hover:bg-[#4A3856]"
                  >
                    {department} · {count}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          Object.entries(coursesByDepartment).map(([dept, courses]) => (
            <div key={dept} className="bg-[#1A1423]/20 rounded-lg overflow-hidden border border-[#B75D69]/20">
              <button
                onClick={() => toggleDepartment(dept)}
                aria-expanded={isDepartmentExpanded(dept)}
                className="w-full px-4 py-3 flex items-center justify-between bg-[#1A1423]/40 hover:bg-[#1A1423]/60 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {isDepartmentExpanded(dept) ? (
                    <ChevronDown className="w-5 h-5 text-[#B75D69]" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-[#B75D69]" />
                  )}
                  <span className="font-bold text-[#EACDC2]">{dept}</span>
                  <span className="text-sm text-[#EACDC2]/60">({courses.length})</span>
                </div>
              </button>

              {isDepartmentExpanded(dept) && (
                <div className="p-2 space-y-2">
                  {courses.map(course => {
                    const lectureSections = course.sections.filter(s => s.sectionType === 'LECTURE');
                    const primarySectionCount = lectureSections.length || course.sections.length;
                    
                    return (
                      <div key={course.courseCode}
                      ref={(el) => { courseRefs.current[course.courseCode] = el; }}
                        className="bg-[#372549]/40 rounded-lg overflow-hidden border border-[#B75D69]/20">
                        <button
                          onClick={() => toggleCourse(course.courseCode)}
                          aria-expanded={expandedCourse === course.courseCode}
                          className="w-full px-3 py-2.5 flex items-start gap-2 hover:bg-[#B75D69]/10 transition-colors text-left"
                        >
                          {expandedCourse === course.courseCode ? (
                            <ChevronDown className="w-4 h-4 text-[#B75D69] mt-0.5 flex-shrink-0" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-[#B75D69] mt-0.5 flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-[#EACDC2] text-sm">{course.courseCode}</p>
                            <p className="text-xs text-[#EACDC2]/80 line-clamp-2">{course.courseTitle}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <p className="text-xs text-[#B75D69]">{primarySectionCount} section(s)</p>
                              {course.credits && course.credits > 0 && (
                                <span className="text-xs text-[#EACDC2]/60">• {course.credits} credits</span>
                              )}
                            </div>
                          </div>
                        </button>

                        {expandedCourse === course.courseCode && (
                          <div className="px-3 pb-2 space-y-2">
                            {(course.description || course.prerequisites || course.corequisites || course.exclusions || course.attributes) && (
                              <div className="rounded-xl border border-[#B75D69]/20 bg-[#1A1423]/45 p-3 text-xs">
                                {course.description && (
                                  <div className="mb-3">
                                    <p className="mb-1 font-semibold uppercase tracking-wide text-[#B75D69]">Course description</p>
                                    <p className="leading-relaxed text-[#EACDC2]/80">{course.description}</p>
                                  </div>
                                )}
                                <dl className="space-y-2">
                                  {course.prerequisites && (
                                    <div>
                                      <dt className="font-semibold text-amber-300">Prerequisites</dt>
                                      <dd className="mt-0.5 leading-relaxed text-[#EACDC2]/75">{course.prerequisites}</dd>
                                    </div>
                                  )}
                                  {course.corequisites && (
                                    <div>
                                      <dt className="font-semibold text-sky-300">Corequisites</dt>
                                      <dd className="mt-0.5 leading-relaxed text-[#EACDC2]/75">{course.corequisites}</dd>
                                    </div>
                                  )}
                                  {course.exclusions && (
                                    <div>
                                      <dt className="font-semibold text-rose-300">Exclusions</dt>
                                      <dd className="mt-0.5 leading-relaxed text-[#EACDC2]/75">{course.exclusions}</dd>
                                    </div>
                                  )}
                                  {course.attributes && (
                                    <div>
                                      <dt className="font-semibold text-emerald-300">Attributes</dt>
                                      <dd className="mt-0.5 leading-relaxed text-[#EACDC2]/75">{course.attributes}</dd>
                                    </div>
                                  )}
                                </dl>
                                {course.learningOutcomes && (
                                  <details className="mt-3 border-t border-[#B75D69]/15 pt-2">
                                    <summary className="cursor-pointer font-semibold text-[#F4D7D2]">Intended learning outcomes</summary>
                                    <p className="mt-2 leading-relaxed text-[#EACDC2]/70">{course.learningOutcomes}</p>
                                  </details>
                                )}
                              </div>
                            )}
                            {/* Lectures */}
                            {lectureSections.map(section => {
                              const missing = getMissingComponents(course, section);
                              const isLectureAdded = isAdded(course.courseCode, section.sectionCode);
                              const existingLecture = getExistingSectionOfType(course.courseCode, 'LECTURE');
                              const isSwitch = existingLecture && existingLecture.sectionCode !== section.sectionCode;
                              
                              return (
                                <div key={`lecture-${course.courseCode}-${section.sectionCode}`}>
                                  <div className="bg-[#1A1423]/40 rounded p-2.5 border border-[#B75D69]/10">
                                    <div className="flex items-start justify-between mb-2">
                                      <div className="flex-1">
                                        <p className="font-medium text-[#EACDC2] text-sm mb-1">{section.sectionCode}</p>
                                        {section.instructor && (
                                          <p className="text-xs text-[#EACDC2]/70">{section.instructor}</p>
                                        )}
                                      </div>
                                      
                                      <button
                                        onClick={() => handleAddSection(course, section)}
                                        aria-label={`${isLectureAdded ? 'Selected' : isSwitch ? 'Switch to' : 'Add'} ${course.courseCode} ${section.sectionCode}`}
                                        className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-medium transition-all ${
                                          isLectureAdded
                                            ? 'bg-green-600/20 text-green-300 border border-green-500/30 cursor-default'
                                            : isSwitch
                                            ? 'bg-blue-600 text-white hover:bg-blue-600/80'
                                            : 'bg-[#B75D69] text-white hover:bg-[#B75D69]/80'
                                        }`}
                                      >
                                        <Plus className="w-3 h-3" />
                                        {isLectureAdded ? 'Added' : isSwitch ? 'Switch' : 'Add'}
                                      </button>
                                    </div>
                                    
                                    {section.dateTime && (
                                      <p className="text-xs text-[#EACDC2]/80 mb-1">📅 {section.dateTime}</p>
                                    )}
                                    {section.room && (
                                      <p className="text-xs text-[#EACDC2]/80 mb-2">📍 {section.room}</p>
                                    )}
                                    
                                    <div className="pt-2 border-t border-[#B75D69]/20">
                                      <p className="text-xs text-[#EACDC2]/70">
                                        Quota: {section.enrolled}/{section.quota} • Available: {section.available}
                                        {section.wait !== '0' && ` • Wait: ${section.wait}`}
                                      </p>
                                    </div>
                                  </div>
                                  
                                  {isLectureAdded && missing.length > 0 && (
                                    <div className="mt-2 bg-yellow-500/10 border border-yellow-500/30 rounded p-2 flex items-start gap-2">
                                      <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                                      <div className="flex-1">
                                        <p className="text-xs font-medium text-yellow-300">Required Components Missing</p>
                                        <p className="text-xs text-yellow-200/80 mt-0.5">
                                          You need to add: {missing.join(', ')}
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            
                            {/* Labs */}
                            {course.sections.filter(s => s.sectionType === 'LAB').length > 0 && (
                              <div className="mt-3 pt-3 border-t border-[#B75D69]/20">
                                <p className="text-xs font-semibold text-orange-300 mb-2">Labs</p>
                                {course.sections
                                  .filter(s => s.sectionType === 'LAB')
                                  .map(section => {
                                    const isLabAdded = isAdded(course.courseCode, section.sectionCode);
                                    const existingLab = getExistingSectionOfType(course.courseCode, 'LAB');
                                    const isSwitch = existingLab && existingLab.sectionCode !== section.sectionCode;
                                    
                                    return (
                                      <div key={`lab-${course.courseCode}-${section.sectionCode}`} className="bg-orange-500/10 rounded p-2.5 border border-orange-500/20 mb-2">
                                        <div className="flex items-start justify-between mb-2">
                                          <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                              <p className="font-medium text-[#EACDC2] text-sm">{section.sectionCode}</p>
                                              <span className="text-xs bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded border border-orange-500/30">
                                                For {section.linkedSection}
                                              </span>
                                            </div>
                                            {section.instructor && (
                                              <p className="text-xs text-[#EACDC2]/70">{section.instructor}</p>
                                            )}
                                          </div>
                                          
                                          <button
                                            onClick={() => handleAddSection(course, section)}
                                            aria-label={`${isLabAdded ? 'Selected' : isSwitch ? 'Switch to' : 'Add'} ${course.courseCode} ${section.sectionCode}`}
                                            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-medium transition-all ${
                                              isLabAdded
                                                ? 'bg-green-600/20 text-green-300 border border-green-500/30 cursor-default'
                                                : isSwitch
                                                ? 'bg-blue-600 text-white hover:bg-blue-600/80'
                                                : 'bg-orange-600 text-white hover:bg-orange-600/80'
                                            }`}
                                          >
                                            <Plus className="w-3 h-3" />
                                            {isLabAdded ? 'Added' : isSwitch ? 'Switch' : 'Add'}
                                          </button>
                                        </div>
                                        
                                        {section.dateTime && (
                                          <p className="text-xs text-[#EACDC2]/80 mb-1">📅 {section.dateTime}</p>
                                        )}
                                        {section.room && (
                                          <p className="text-xs text-[#EACDC2]/80">📍 {section.room}</p>
                                        )}
                                      </div>
                                    );
                                  })}
                              </div>
                            )}
                            
                            {/* Tutorials */}
                            {course.sections.filter(s => s.sectionType === 'TUTORIAL').length > 0 && (
                              <div className="mt-3 pt-3 border-t border-[#B75D69]/20">
                                <p className="text-xs font-semibold text-blue-300 mb-2">Tutorials</p>
                                {course.sections
                                  .filter(s => s.sectionType === 'TUTORIAL')
                                  .map(section => {
                                    const isTutorialAdded = isAdded(course.courseCode, section.sectionCode);
                                    const existingTutorial = getExistingSectionOfType(course.courseCode, 'TUTORIAL');
                                    const isSwitch = existingTutorial && existingTutorial.sectionCode !== section.sectionCode;
                                    
                                    return (
                                      <div key={`tutorial-${course.courseCode}-${section.sectionCode}`} className="bg-blue-500/10 rounded p-2.5 border border-blue-500/20 mb-2">
                                        <div className="flex items-start justify-between mb-2">
                                          <div className="flex-1">
                                            <p className="font-medium text-[#EACDC2] text-sm mb-1">{section.sectionCode}</p>
                                            {section.instructor && (
                                              <p className="text-xs text-[#EACDC2]/70">{section.instructor}</p>
                                            )}
                                          </div>
                                          
                                          <button
                                            onClick={() => handleAddSection(course, section)}
                                            aria-label={`${isTutorialAdded ? 'Selected' : isSwitch ? 'Switch to' : 'Add'} ${course.courseCode} ${section.sectionCode}`}
                                            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-medium transition-all ${
                                              isTutorialAdded
                                                ? 'bg-green-600/20 text-green-300 border border-green-500/30 cursor-default'
                                                : isSwitch
                                                ? 'bg-blue-600 text-white hover:bg-blue-600/80'
                                                : 'bg-blue-600 text-white hover:bg-blue-600/80'
                                            }`}
                                          >
                                            <Plus className="w-3 h-3" />
                                            {isTutorialAdded ? 'Added' : isSwitch ? 'Switch' : 'Add'}
                                          </button>
                                        </div>
                                        
                                        {section.dateTime && (
                                          <p className="text-xs text-[#EACDC2]/80 mb-1">📅 {section.dateTime}</p>
                                        )}
                                        {section.room && (
                                          <p className="text-xs text-[#EACDC2]/80">📍 {section.room}</p>
                                        )}
                                      </div>
                                    );
                                  })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
