'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Plus, ChevronDown, ChevronRight, Loader2, BookOpen, AlertTriangle } from 'lucide-react';
import type { Course, TimetableSection, Section } from '../lib/types';
import { courseAPI } from '../lib/api';

interface CourseSearchProps {
  onSelectSection: (section: TimetableSection) => void;
  selectedSections: TimetableSection[];
  focusedCourse?: { code: string; timestamp: number } | null;
}

export default function CourseSearch({ onSelectSection, selectedSections,focusedCourse }: CourseSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);
  const [expandedDept, setExpandedDept] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // REFS - one for each course card
  const courseRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);

// Auto-scroll when focusedCourse changes
useEffect(() => {
  if (!focusedCourse || !courseRefs.current[focusedCourse.code]) return;

  const element = courseRefs.current[focusedCourse.code];
  if (!element) return;

  // EXPAND THE COURSE to show sections
  setExpandedCourse(focusedCourse.code);

  // ALSO EXPAND THE DEPARTMENT
  const courseDept = allCourses.find(c => c.courseCode === focusedCourse.code)?.department;
  if (courseDept) {
    setExpandedDept(prev => new Set([...prev, courseDept]));
  }

  // Scroll the element into view smoothly (small delay to let expansion happen)
  const scrollTimeout = setTimeout(() => {
    if (element) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, 100);

  // Add a temporary highlight animation
  element.classList.add('ring-2', 'ring-[#B75D69]', 'ring-offset-2', 'ring-offset-[#1A1423]');

  // ✅ Clear any existing highlight timeout to prevent overlaps
  if (highlightTimeoutRef.current) {
    clearTimeout(highlightTimeoutRef.current);
  }

  // Remove highlight after 2 seconds and store timeout reference
  highlightTimeoutRef.current = setTimeout(() => {
    if (element) {
      element.classList.remove('ring-2', 'ring-[#B75D69]', 'ring-offset-2', 'ring-offset-[#1A1423]');
    }
    highlightTimeoutRef.current = null;
  }, 2000);

  // ✅ CLEANUP: Clear timeouts if effect runs again or component unmounts
  return () => {
    clearTimeout(scrollTimeout);
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = null;
    }
    // Remove highlight classes immediately on cleanup
    if (element) {
      element.classList.remove('ring-2', 'ring-[#B75D69]', 'ring-offset-2', 'ring-offset-[#1A1423]');
    }
  };
}, [focusedCourse]);




  useEffect(() => {
    const fetchAllCourses = async () => {
      try {
        setLoading(true);
        const courses = await courseAPI.getAllCourses();
        setAllCourses(courses);
      } catch (error) {
        console.error('Error fetching courses:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchAllCourses();
  }, []);

  const filteredCourses = useMemo(() => {
    if (!searchQuery.trim()) {
      return allCourses;
    }
    
    const query = searchQuery.toLowerCase();
    // Remove spaces for flexible matching (ELEC1200 or ELEC 1200)
    const queryNoSpaces = query.replace(/\s+/g, '');
    
    return allCourses.filter(course => {
      const courseCodeNoSpaces = course.courseCode.toLowerCase().replace(/\s+/g, '');
      const courseTitleLower = course.courseTitle.toLowerCase();
      const deptLower = course.department.toLowerCase();
      
      return (
        // Match with or without spaces in course code
        courseCodeNoSpaces.includes(queryNoSpaces) ||
        course.courseCode.toLowerCase().includes(query) ||
        // Match course title
        courseTitleLower.includes(query) ||
        // Match department
        deptLower.includes(query)
      );
    });
  }, [searchQuery, allCourses]);

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

  useEffect(() => {
  if (searchQuery.trim() && Object.keys(coursesByDepartment).length > 0 && expandedDept.size === 0) {
    const firstDept = Object.keys(coursesByDepartment)[0];
    setExpandedDept(new Set([firstDept]));
  }
}, [searchQuery, coursesByDepartment, expandedDept.size]);

  return (
    <div className="bg-gradient-to-br from-[#372549] to-[#774C60] rounded-lg shadow-xl p-6 h-full flex flex-col">
      <h2 className="text-2xl font-bold text-[#EACDC2] mb-4 flex items-center gap-2">
        <Search className="w-6 h-6" />
        Course Search
      </h2>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#EACDC2]/60 w-5 h-5" />
        <input
          type="text"
          placeholder="Search by course code, title, or department..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-[#1A1423]/40 border border-[#B75D69]/30 rounded-lg 
                     text-[#EACDC2] placeholder-[#EACDC2]/50 focus:outline-none focus:ring-2 
                     focus:ring-[#B75D69] focus:border-transparent transition-all"
        />
      </div>

      {searchQuery && (
        <div className="mb-3 px-2">
          <p className="text-sm text-[#EACDC2]/70">
            Found {filteredCourses.length} course{filteredCourses.length !== 1 ? 's' : ''} 
            {' '}in {Object.keys(coursesByDepartment).length} department{Object.keys(coursesByDepartment).length !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-3 pr-2">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#B75D69] animate-spin" />
          </div>
        ) : Object.keys(coursesByDepartment).length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="w-12 h-12 text-[#EACDC2]/30 mx-auto mb-3" />
            <p className="text-[#EACDC2]/60">
              {searchQuery ? 'No courses found matching your search' : 'No courses available'}
            </p>
          </div>
        ) : (
          Object.entries(coursesByDepartment).map(([dept, courses]) => (
            <div key={dept} className="bg-[#1A1423]/20 rounded-lg overflow-hidden border border-[#B75D69]/20">
              <button
                onClick={() => toggleDepartment(dept)}
                className="w-full px-4 py-3 flex items-center justify-between bg-[#1A1423]/40 hover:bg-[#1A1423]/60 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {expandedDept.has(dept) ? (
                    <ChevronDown className="w-5 h-5 text-[#B75D69]" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-[#B75D69]" />
                  )}
                  <span className="font-bold text-[#EACDC2]">{dept}</span>
                  <span className="text-sm text-[#EACDC2]/60">({courses.length})</span>
                </div>
              </button>

              {expandedDept.has(dept) && (
                <div className="p-2 space-y-2">
                  {courses.map(course => {
                    const lectureSections = course.sections.filter(s => s.sectionType === 'LECTURE');
                    
                    return (
                      <div key={course.courseCode}
                      ref={(el) => { courseRefs.current[course.courseCode] = el; }}
                        className="bg-[#372549]/40 rounded-lg overflow-hidden border border-[#B75D69]/20">
                        <button
                          onClick={() => toggleCourse(course.courseCode)}
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
                              <p className="text-xs text-[#B75D69]">{lectureSections.length} section(s)</p>
                              {course.credits && course.credits > 0 && (
                                <span className="text-xs text-[#EACDC2]/60">• {course.credits} credits</span>
                              )}
                            </div>
                          </div>
                        </button>

                        {expandedCourse === course.courseCode && (
                          <div className="px-3 pb-2 space-y-2">
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
