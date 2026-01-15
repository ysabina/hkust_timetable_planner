'use client';

import { X } from 'lucide-react';
import type { TimetableSection, Conflict } from '../lib/types';

interface WeeklyCalendarProps {
  sections: TimetableSection[];
  onRemoveSection: (courseCode: string) => void;
  conflicts: Conflict[];
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
  // Use the new timeslots array if available (from updated scraper)
  if (section.parsedTime?.timeslots && section.parsedTime.timeslots.length > 0) {
    return section.parsedTime.timeslots;
  }
  
  // Fallback: use the old parsedTime format for backward compatibility
  if (section.parsedTime) {
    return [{
      days: section.parsedTime.days,
      startTime: section.parsedTime.startTime,
      endTime: section.parsedTime.endTime
    }];
  }
  
  return [];
}

export default function WeeklyCalendar({ sections, onRemoveSection, conflicts }: WeeklyCalendarProps) {
  const timeToPosition = (time: string): number => {
    // Convert "10:30AM" to minutes from 8:00AM
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
                      // Get timeslots using the new helper function
                      const timeslots = getTimeslots(section);
                      
                      // Render each timeslot that includes this day
                      return timeslots.map((timeslot, idx) => {
                        // Check if this timeslot includes the current day
                        if (!timeslot.days.includes(day)) return null;
                        
                        const startPos = timeToPosition(timeslot.startTime);
                        const endPos = timeToPosition(timeslot.endTime);
                        const height = endPos - startPos;
                        const isConflicting = hasConflict(section);
                        const bgColor = isConflicting ? 'bg-red-600/80' : (section.color || 'bg-[#B75D69]');

                        return (
                          <div
                            key={`${section.courseCode}-${section.sectionCode}-${day}-${idx}`}
                            className={`absolute left-0 right-0 mx-1 ${bgColor} rounded-lg p-2 shadow-lg 
                                       border-2 ${isConflicting ? 'border-red-400 animate-pulse' : 'border-[#EACDC2]/30'} 
                                       overflow-hidden group hover:z-10 transition-all`}
                            style={{
                              top: `${(startPos / 840) * 100}%`,
                              height: `${(height / 840) * 100}%`,
                              minHeight: '40px',
                            }}
                          >
                            <button
                              onClick={() => onRemoveSection(section.courseCode)}
                              className="absolute top-1 right-1 w-5 h-5 bg-[#1A1423]/60 rounded-full flex items-center 
                                         justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#1A1423]/80"
                            >
                              <X className="w-3 h-3 text-[#EACDC2]" />
                            </button>
                            <div className="text-white text-xs font-semibold truncate">
                              {section.courseCode}
                            </div>
                            <div className="text-white/90 text-xs truncate">
                              {section.sectionCode}
                              {section.sectionType === 'LAB' && ' (Lab)'}
                              {section.sectionType === 'TUTORIAL' && ' (Tut)'}
                            </div>
                            {height > 60 && (
                              <>
                                <div className="text-white/80 text-xs mt-1 truncate">
                                  {timeslot.startTime}-{timeslot.endTime}
                                </div>
                                {section.room && (
                                  <div className="text-white/70 text-xs truncate">
                                    {section.room.split(';')[idx] || section.room.split(';')[0]}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        );
                      }).filter(Boolean); // Remove null entries
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
