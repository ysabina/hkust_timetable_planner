'use client';
import { useState } from 'react';
import { X } from 'lucide-react';
import type { TimetableSection, Conflict } from '../lib/types';

interface WeeklyCalendarProps {
  sections: TimetableSection[];
  onRemoveSection: (courseCode: string) => void;
  conflicts: Conflict[];
  onCourseClick?: (courseCode: string) => void;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const DAY_ABBREV: { [key: string]: string } = {
  'Monday': 'Mon',
  'Tuesday': 'Tue',
  'Wednesday': 'Wed',
  'Thursday': 'Thu',
  'Friday': 'Fri',
};
const HOURS = Array.from({ length: 14 }, (_, i) => i + 8);

// Helper to get timeslots from section
function getTimeslots(section: TimetableSection) {
  if (section.parsedTime?.timeslots && section.parsedTime.timeslots.length > 0) {
    return section.parsedTime.timeslots;
  }
  
  if (section.parsedTime) {
    return [{
      days: section.parsedTime.days,
      startTime: section.parsedTime.startTime,
      endTime: section.parsedTime.endTime
    }];
  }
  
  return [];
}

// Helper to determine if background is light or dark for text color
function getTextColor(bgColor: string): string {
  // Light backgrounds that need dark text
  const lightColors = ['bg-[#FCE4D8]', 'bg-[#FBD87F]', 'bg-[#B5F8FE]', 'bg-[#10FFCB]', 
                       'bg-[#A7C7E7]', 'bg-[#E7B8FF]', 'bg-[#FFD4D4]', 'bg-[#C4A5E1]', 'bg-[#FFB5C5]'];
  
  return lightColors.includes(bgColor) ? 'text-gray-800' : 'text-white';
}

export default function WeeklyCalendar({ sections, onRemoveSection, conflicts, onCourseClick }: WeeklyCalendarProps) {
    const [expandedBlock, setExpandedBlock] = useState<string | null>(null);
    const timeToPosition = (time: string): number => {
    const match = time.match(/(\d+):(\d+)(AM|PM)/);
    if (!match) return 0;
    
    let [, hoursStr, minutesStr, period] = match;
    let hours = parseInt(hoursStr);
    const minutes = parseInt(minutesStr);
    
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    
    return (hours - 8) * 60 + minutes;
  };

  const hasConflict = (section: TimetableSection): boolean => {
    return conflicts.some(c => 
      (c.course1 === section.courseCode && c.section1 === section.sectionCode) ||
      (c.course2 === section.courseCode && c.section2 === section.sectionCode)
    );
  };
  const handleCourseClick = (courseCode: string, sectionCode: string, day: string) => {
  const blockId = `${courseCode}-${sectionCode}-${day}`;
  
  // Toggle expansion
  setExpandedBlock(prev => prev === blockId ? null : blockId);
  
  // Notify parent component (page.tsx) to update CourseSearch
  onCourseClick?.(courseCode);
};



  return (
    <div className="h-full overflow-auto">
      <h2 className="text-2xl font-bold text-[#EACDC2] mb-6">Your Timetable</h2>
      
      {sections.length === 0 ? (
        <div className="bg-[#372549]/40 rounded-lg p-12 text-center border border-[#B75D69]/20">
          <p className="text-[#EACDC2]/60 text-lg">
            No courses selected yet. Add courses from the search panel to build your timetable!
          </p>
        </div>
      ) : (
        <div className="bg-[#1A1423]/40 rounded-lg p-4 overflow-x-auto border border-[#B75D69]/20">
          <div className="grid grid-cols-[60px_repeat(5,1fr)] gap-2 min-w-[700px]">
            {/* Header row with day names */}
            <div></div>
            {DAYS.map(day => (
              <div key={day} className="text-center font-semibold text-[#EACDC2] py-2 border-b border-[#B75D69]/30">
                {DAY_ABBREV[day]}
              </div>
            ))}

            {/* Time grid */}
            <div className="col-span-6 grid grid-cols-[60px_repeat(5,1fr)] gap-2 relative">
              {HOURS.map(hour => (
                <div key={hour} className="contents">
                  <div className="text-right pr-2 text-sm text-[#EACDC2]/70 py-4">
                    {hour}:00
                  </div>
                  {DAYS.map(day => (
                    <div
                      key={`${day}-${hour}`}
                      className="border border-[#B75D69]/20 bg-[#372549]/30 rounded min-h-[60px]"
                    ></div>
                  ))}
                </div>
              ))}

              {/* Course blocks overlay */}
              <div className="absolute inset-0 grid grid-cols-[60px_repeat(5,1fr)] gap-2 pointer-events-none">
                <div></div>
                {DAYS.map((day) => (
                  <div key={day} className="relative pointer-events-auto" style={{ height: '840px' }}>
                    {sections.map((section) => {
                      const timeslots = getTimeslots(section);
                      
                      return timeslots.map((timeslot, idx) => {
                        if (!timeslot.days.includes(day)) return null;
                        
                        const startPos = timeToPosition(timeslot.startTime);
                        const endPos = timeToPosition(timeslot.endTime);
                        const height = endPos - startPos;
                        const isConflicting = hasConflict(section);
                        
                        // Use section.color if available, fallback to first color in palette
                        const bgColor = isConflicting 
                          ? 'bg-red-600/80' 
                          : (section.color || 'bg-[#F75590]'); // Changed fallback to pink
                        
                        const textColor = isConflicting ? 'text-white' : getTextColor(bgColor);


                        const blockId = `${section.courseCode}-${section.sectionCode}-${day}`;
                        const isExpanded = expandedBlock === blockId;

                        return (
                        <div
                            key={blockId}
                            onClick={() => handleCourseClick(section.courseCode, section.sectionCode, day)}
                            className={`absolute left-0 right-0 mx-1 ${bgColor} ${textColor} rounded-lg p-2 shadow-lg 
                                    border-2 ${isConflicting ? 'border-red-400 animate-pulse' : 'border-white/20'} 
                                    overflow-hidden group cursor-pointer
                                    transition-all duration-300 ease-out
                                    ${isExpanded ? 'z-50 scale-105 shadow-2xl ring-2 ring-[#EACDC2]' : 'hover:z-10 hover:shadow-xl hover:scale-102'}`}
                            style={{
                            top: `${(startPos / 840) * 100}%`,
                            height: `${(height / 840) * 100}%`,
                            minHeight: isExpanded ? '120px' : '40px',
                            }}
                        >
                            <button
                            onClick={(e) => {
                                e.stopPropagation(); // ✅ CHANGED: Stop click from bubbling to parent
                                onRemoveSection(section.courseCode);
                            }}
                            className="absolute top-1 right-1 w-5 h-5 bg-black/40 rounded-full flex items-center 
                                        justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60 z-10"
                            >
                            <X className="w-3 h-3 text-white" />
                            </button>

                            {/* Always visible info */}
                            <div className="font-semibold text-xs truncate">
                            {section.courseCode}
                            </div>
                            <div className="opacity-90 text-xs truncate">
                            {section.sectionCode}
                            {section.sectionType === 'LAB' && ' (Lab)'}
                            {section.sectionType === 'TUTORIAL' && ' (Tut)'}
                            </div>

                            {/* Show time/room if block is tall enough OR expanded */}
                            {(height > 60 || isExpanded) && (
                            <>
                                <div className="opacity-80 text-xs mt-1 truncate">
                                {timeslot.startTime}-{timeslot.endTime}
                                </div>
                                {section.room && (
                                <div className="opacity-70 text-xs truncate">
                                    {section.room.split(';')[idx] || section.room.split(';')[0]}
                                </div>
                                )}
                            </>
                            )}

                            {/* Extra details when expanded */}
                            {isExpanded && (
                            <div className="mt-2 pt-2 border-t border-white/20 space-y-1 animate-fadeIn">
                                {section.instructor && (
                                <div className="text-xs opacity-90">
                                    👤 {section.instructor}
                                </div>
                                )}
                                {section.quota && (
                                <div className="text-xs opacity-90">
                                    📊 {section.enrolled}/{section.quota} enrolled
                                    {section.wait && section.wait !== '0' && ` • ${section.wait} waiting`}
                                </div>
                                )}
                                {section.remarks && (
                                <div className="text-xs opacity-80 italic">
                                    💡 {section.remarks}
                                </div>
                                )}
                            </div>
                            )}
                        </div>
                        );
                      }).filter(Boolean);
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
