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
    
    const [, hoursStr, minutesStr, period] = match;
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
  const agendaEntries = sections.flatMap(section => getTimeslots(section).flatMap((timeslot, slotIndex) =>
    timeslot.days.map(day => ({
      day,
      section,
      slotIndex,
      startTime: timeslot.startTime,
      endTime: timeslot.endTime,
    }))
  )).sort((a, b) => {
    const dayDifference = DAYS.indexOf(a.day) - DAYS.indexOf(b.day);
    return dayDifference || timeToPosition(a.startTime) - timeToPosition(b.startTime);
  });
  const handleCourseClick = (courseCode: string, sectionCode: string, day: string) => {
  const blockId = `${courseCode}-${sectionCode}-${day}`;
  
  // Toggle expansion
  setExpandedBlock(prev => prev === blockId ? null : blockId);
  
  // Notify parent component (page.tsx) to update CourseSearch
  onCourseClick?.(courseCode);
};



  return (
    <div className="h-full overflow-visible lg:overflow-auto">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-[#F7EDE8]">Your Timetable</h2>
          <p className="mt-1 text-sm text-[#EACDC2]/55">Tap a class to inspect it or change its section.</p>
        </div>
        {sections.length > 0 && <span className="rounded-full bg-[#372549] px-3 py-1 text-xs text-[#EACDC2]/75">{agendaEntries.length} meetings</span>}
      </div>
      
      {sections.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#B75D69]/35 bg-[#372549]/25 px-5 py-12 text-center">
          <p className="text-lg font-semibold text-[#F7EDE8]">Your week is ready to be built</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-[#EACDC2]/60">Search for a course, choose a section, and every meeting will appear here automatically.</p>
        </div>
      ) : (
        <>
        <div className="space-y-5 md:hidden" aria-label="Mobile timetable agenda">
          {DAYS.map(day => {
            const dayEntries = agendaEntries.filter(entry => entry.day === day);
            if (dayEntries.length === 0) return null;
            return (
              <section key={day} aria-labelledby={`agenda-${day}`}>
                <h3 id={`agenda-${day}`} className="mb-2 text-sm font-semibold text-[#F4D7D2]">{day}</h3>
                <div className="space-y-2">
                  {dayEntries.map(({ section, startTime, endTime, slotIndex }) => {
                    const isConflicting = hasConflict(section);
                    return (
                      <div key={`${day}-${section.courseCode}-${section.sectionCode}-${slotIndex}`} className={`flex items-stretch overflow-hidden rounded-xl border ${isConflicting ? 'border-red-400/70 bg-red-500/15' : 'border-[#774C60]/60 bg-[#2A2134]'}`}>
                        <button
                          onClick={() => onCourseClick?.(section.courseCode)}
                          className="min-w-0 flex-1 p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#EACDC2]"
                          aria-label={`View ${section.courseCode} ${section.sectionCode} details`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-[#F7EDE8]">{section.courseCode} · {section.sectionCode}</p>
                              <p className="mt-1 text-sm text-[#F4D7D2]">{startTime}–{endTime}</p>
                            </div>
                            {isConflicting && <span className="rounded-full bg-red-500/20 px-2 py-1 text-[10px] font-bold text-red-200">CONFLICT</span>}
                          </div>
                          {section.room && <p className="mt-2 truncate text-xs text-[#EACDC2]/60">{section.room.split(';')[slotIndex] || section.room.split(';')[0]}</p>}
                        </button>
                        <button
                          onClick={() => onRemoveSection(section.courseCode)}
                          className="flex w-12 items-center justify-center border-l border-[#774C60]/40 text-[#EACDC2]/60 transition-colors hover:bg-red-500/15 hover:text-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-300"
                          aria-label={`Remove ${section.courseCode} from timetable`}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        <div className="hidden rounded-lg border border-[#B75D69]/20 bg-[#1A1423]/40 p-4 md:block md:overflow-x-auto">
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
                                        justify-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity hover:bg-black/60 z-10"
                            aria-label={`Remove ${section.courseCode} from timetable`}
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
        </>
      )}
    </div>
  );
}
