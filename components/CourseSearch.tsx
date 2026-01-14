'use client';

import { useState, useEffect } from 'react';
import { Search, Plus, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import type { Course, TimetableSection } from '../lib/types';
import { courseAPI } from '../lib/api';

interface CourseSearchProps {
  onSelectSection: (section: TimetableSection) => void;
  selectedSections: TimetableSection[];
  onSwitchSection: (courseCode: string, newSection: TimetableSection) => void;
}

export default function CourseSearch({ onSelectSection, selectedSections, onSwitchSection }: CourseSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [departments, setDepartments] = useState<string[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [courses, setCourses] = useState<Course[]>([]);
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<Course[]>([]);

  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const depts = await courseAPI.getDepartments();
        setDepartments(depts);
      } catch (error) {
        console.error('Error fetching departments:', error);
      }
    };
    fetchDepartments();
  }, []);

  useEffect(() => {
    if (selectedDept) {
      setLoading(true);
      courseAPI.getCoursesByDepartment(selectedDept)
        .then(setCourses)
        .catch(console.error)
        .finally(() => setLoading(false));
    } else {
      setCourses([]);
    }
  }, [selectedDept]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = courses.filter(course =>
        course.courseCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        course.courseTitle.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setSearchResults(filtered);
    } else {
      setSearchResults(courses);
    }
  }, [searchQuery, courses]);

  const toggleCourse = (courseCode: string) => {
    setExpandedCourse(expandedCourse === courseCode ? null : courseCode);
  };

  const isAdded = (courseCode: string, sectionCode: string) => {
    return selectedSections.some(s => 
      s.courseCode === courseCode && s.sectionCode === sectionCode
    );
  };

  const handleAddSection = (course: Course, section: any) => {
    const timetableSection: TimetableSection = {
      ...section,
      courseCode: course.courseCode,
      courseTitle: course.courseTitle,
    };
    onSelectSection(timetableSection);
  };

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
          placeholder="Search courses..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-[#1A1423]/40 border border-[#B75D69]/30 rounded-lg 
                     text-[#EACDC2] placeholder-[#EACDC2]/50 focus:outline-none focus:ring-2 
                     focus:ring-[#B75D69] focus:border-transparent transition-all"
        />
      </div>

      <select
        value={selectedDept}
        onChange={(e) => setSelectedDept(e.target.value)}
        className="w-full mb-4 px-4 py-2.5 bg-[#1A1423]/40 border border-[#B75D69]/30 rounded-lg 
                   text-[#EACDC2] focus:outline-none focus:ring-2 focus:ring-[#B75D69] 
                   focus:border-transparent transition-all cursor-pointer"
      >
        <option value="">Select Department</option>
        {departments.map(dept => (
          <option key={dept} value={dept}>{dept}</option>
        ))}
      </select>

      <div className="flex-1 overflow-y-auto space-y-2 pr-2">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#B75D69] animate-spin" />
          </div>
        ) : searchResults.length === 0 ? (
          <p className="text-[#EACDC2]/60 text-center py-8">
            {selectedDept ? 'No courses found' : 'Select a department to browse courses'}
          </p>
        ) : (
          searchResults.map(course => (
            <div key={course.courseCode} className="bg-[#1A1423]/40 rounded-lg overflow-hidden border border-[#B75D69]/20">
              <button
                onClick={() => toggleCourse(course.courseCode)}
                className="w-full px-4 py-3 flex items-start gap-3 hover:bg-[#B75D69]/10 transition-colors text-left"
              >
                {expandedCourse === course.courseCode ? (
                  <ChevronDown className="w-5 h-5 text-[#B75D69] mt-0.5 flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-[#B75D69] mt-0.5 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[#EACDC2]">{course.courseCode}</p>
                  <p className="text-sm text-[#EACDC2]/80 line-clamp-2">{course.courseTitle}</p>
                  <p className="text-xs text-[#B75D69] mt-1">{course.sections.length} section(s)</p>
                </div>
              </button>

              {expandedCourse === course.courseCode && (
                <div className="px-4 pb-3 space-y-2">
                  {course.sections.map(section => (
                    <div
                      key={section.sectionCode}
                      className="bg-[#372549]/60 rounded p-3 border border-[#B75D69]/20"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <p className="font-medium text-[#EACDC2]">{section.sectionCode}</p>
                          {section.instructor && (
                            <p className="text-sm text-[#EACDC2]/70 mt-1">{section.instructor}</p>
                          )}
                        </div>
                        <button
                          onClick={() => handleAddSection(course, section)}
                          disabled={isAdded(course.courseCode, section.sectionCode)}
                          className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-sm font-medium transition-all ${
                            isAdded(course.courseCode, section.sectionCode)
                              ? 'bg-[#1A1423]/40 text-[#EACDC2]/40 cursor-not-allowed'
                              : 'bg-[#B75D69] text-white hover:bg-[#B75D69]/80'
                          }`}
                        >
                          <Plus className="w-4 h-4" />
                          {isAdded(course.courseCode, section.sectionCode) ? 'Added' : 'Add'}
                        </button>
                      </div>
                      
                      {/* Display time and room */}
                      {section.dateTime && (
                        <p className="text-xs text-[#EACDC2]/80 mb-1">
                          📅 {section.dateTime}
                        </p>
                      )}
                      {section.room && (
                        <p className="text-xs text-[#EACDC2]/80 mb-2">
                          📍 {section.room}
                        </p>
                      )}
                      
                      {/* Display quota info */}
                      <div className="mt-2 pt-2 border-t border-[#B75D69]/20">
                        <p className="text-xs text-[#EACDC2]/70">
                          Quota: {section.enrolled}/{section.quota} • 
                          Available: {section.available}
                          {section.wait !== '0' && ` • Wait: ${section.wait}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
