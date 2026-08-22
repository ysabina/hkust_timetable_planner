'use client';
import { useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { Check, Info, MoreVertical, Palette, RefreshCw, Trash2, X } from 'lucide-react';
import type { Course, TimetableSection, Conflict } from '../lib/types';
import { getReadableTextColor, getSchedulePalette, normalizeScheduleColor, SCHEDULE_PALETTES } from '../lib/colorPalettes';

interface WeeklyCalendarProps {
  sections: TimetableSection[];
  onRemoveSection: (courseCode: string) => void;
  conflicts: Conflict[];
  onCourseClick?: (courseCode: string) => void;
  allCourses: Course[];
  onSwapSection: (section: TimetableSection) => void;
  activePaletteId: string;
  onPaletteChange: (paletteId: string) => void;
  onCourseColorChange: (courseCode: string, color: string) => void;
}

interface CourseMenuState {
  x: number;
  y: number;
  section: TimetableSection;
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

export default function WeeklyCalendar({
  sections,
  onRemoveSection,
  conflicts,
  onCourseClick,
  allCourses,
  onSwapSection,
  activePaletteId,
  onPaletteChange,
  onCourseColorChange,
}: WeeklyCalendarProps) {
    const [expandedBlock, setExpandedBlock] = useState<string | null>(null);
    const [courseMenu, setCourseMenu] = useState<CourseMenuState | null>(null);
    const [showColorControls, setShowColorControls] = useState(false);
    const menuRef = useRef<HTMLDivElement | null>(null);
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

  const openCourseMenu = (x: number, y: number, section: TimetableSection) => {
    const isCompact = window.innerWidth < 640;
    const menuWidth = isCompact
      ? window.innerWidth - 16
      : Math.min(720, window.innerWidth - 32);
    const menuHeight = isCompact
      ? Math.min(Math.round(window.innerHeight * 0.82), window.innerHeight - 16)
      : Math.min(620, window.innerHeight - 32);
    const preferredX = x + 12 + menuWidth <= window.innerWidth - 8
      ? x + 12
      : x - menuWidth - 12;
    const preferredY = y + 12 + menuHeight <= window.innerHeight - 8
      ? y + 12
      : y - menuHeight + 24;
    setCourseMenu({
      x: Math.max(8, Math.min(preferredX, window.innerWidth - menuWidth - 8)),
      y: Math.max(8, Math.min(preferredY, window.innerHeight - menuHeight - 8)),
      section,
    });
  };

  const handleContextMenu = (event: ReactMouseEvent, section: TimetableSection) => {
    event.preventDefault();
    event.stopPropagation();
    openCourseMenu(event.clientX, event.clientY, section);
  };

  const handleMoreClick = (event: ReactMouseEvent<HTMLButtonElement>, section: TimetableSection) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    openCourseMenu(rect.right, rect.bottom, section);
  };

  useEffect(() => {
    if (!courseMenu) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setCourseMenu(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCourseMenu(null);
    };
    const closeOnResize = () => setCourseMenu(null);
    const closeOnOutsideScroll = (event: Event) => {
      if (!menuRef.current?.contains(event.target as Node)) setCourseMenu(null);
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    window.addEventListener('resize', closeOnResize);
    window.addEventListener('scroll', closeOnOutsideScroll, true);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('resize', closeOnResize);
      window.removeEventListener('scroll', closeOnOutsideScroll, true);
    };
  }, [courseMenu]);

  const selectedCourse = courseMenu
    ? allCourses.find(course => course.courseCode === courseMenu.section.courseCode)
    : undefined;
  const alternativeSections = selectedCourse && courseMenu
    ? selectedCourse.sections.filter(section =>
        section.sectionType === courseMenu.section.sectionType &&
        section.sectionCode !== courseMenu.section.sectionCode
      )
    : [];
  const activePalette = getSchedulePalette(activePaletteId);
  const displayedCourses = [...new Map(sections.map(section => [section.courseCode, section])).values()];



  return (
    <div className="h-full overflow-visible lg:overflow-auto">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-[#F7EDE8]">Your Timetable</h2>
          <p className="mt-1 text-sm text-[#EACDC2]/55">Right-click a class for details, colors, section swaps, and removal.</p>
        </div>
        {sections.length > 0 && (
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden rounded-full bg-[#372549] px-3 py-1 text-xs text-[#EACDC2]/75 sm:inline">{agendaEntries.length} meetings</span>
            <button
              onClick={() => setShowColorControls(previous => !previous)}
              aria-expanded={showColorControls}
              aria-controls="schedule-color-controls"
              className={`flex min-h-10 items-center gap-2 rounded-xl border px-3 text-xs font-semibold transition-colors ${
                showColorControls
                  ? 'border-[#B75D69] bg-[#B75D69]/20 text-[#F7EDE8]'
                  : 'border-[#774C60]/60 bg-[#2A2134] text-[#EACDC2]/75 hover:bg-[#372549]'
              }`}
            >
              <Palette className="h-4 w-4" />
              Colors
            </button>
          </div>
        )}
      </div>

      {showColorControls && sections.length > 0 && (
        <section id="schedule-color-controls" className="mb-5 rounded-2xl border border-[#774C60]/35 bg-[#1A1423]/55 p-4" aria-label="Schedule color settings">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-[#F7EDE8]">Schedule colors</h3>
              <p className="mt-1 text-xs text-[#EACDC2]/55">Choose a coordinated palette, then personalize individual courses.</p>
            </div>
            <button onClick={() => setShowColorControls(false)} className="rounded-lg p-2 text-[#EACDC2]/55 hover:bg-[#372549] hover:text-white" aria-label="Close schedule color settings">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {SCHEDULE_PALETTES.map(palette => (
              <button
                key={palette.id}
                onClick={() => onPaletteChange(palette.id)}
                aria-pressed={activePaletteId === palette.id}
                className={`rounded-xl border p-3 text-left transition-colors ${
                  activePaletteId === palette.id
                    ? 'border-[#B75D69] bg-[#372549]'
                    : 'border-[#774C60]/25 bg-[#2A2134]/70 hover:border-[#774C60]'
                }`}
              >
                <span className="flex items-center justify-between gap-2 text-xs font-semibold text-[#F7EDE8]">
                  {palette.name}
                  {activePaletteId === palette.id && <Check className="h-3.5 w-3.5 text-emerald-300" />}
                </span>
                <span className="mt-2 flex gap-1" aria-hidden="true">
                  {palette.colors.slice(0, 6).map(color => <span key={color} className="h-3 flex-1 rounded-full" style={{ backgroundColor: color }} />)}
                </span>
                <span className="mt-2 block text-[10px] text-[#EACDC2]/45">{palette.description}</span>
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-2 lg:grid-cols-2">
            {displayedCourses.map(section => (
              <div key={section.courseCode} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#774C60]/20 bg-[#2A2134]/60 px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: normalizeScheduleColor(section.color) }} />
                  <span className="truncate text-xs font-semibold text-[#F4D7D2]">{section.courseCode}</span>
                </div>
                <div className="flex flex-wrap justify-end gap-1.5">
                  {activePalette.colors.map(color => {
                    const selected = normalizeScheduleColor(section.color) === color;
                    return (
                      <button
                        key={color}
                        onClick={() => onCourseColorChange(section.courseCode, color)}
                        aria-label={`Set ${section.courseCode} color to ${color}`}
                        aria-pressed={selected}
                        className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${selected ? 'border-white ring-2 ring-[#B75D69]' : 'border-white/20'}`}
                        style={{ backgroundColor: color }}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      
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
                      <div
                        key={`${day}-${section.courseCode}-${section.sectionCode}-${slotIndex}`}
                        onContextMenu={(event) => handleContextMenu(event, section)}
                        className={`flex items-stretch overflow-hidden rounded-xl border border-l-4 ${isConflicting ? 'border-red-400/70 bg-red-500/15' : 'border-[#774C60]/60 bg-[#2A2134]'}`}
                        style={{ borderLeftColor: isConflicting ? '#F87171' : normalizeScheduleColor(section.color) }}
                      >
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
                          onClick={(event) => handleMoreClick(event, section)}
                          className="flex w-12 items-center justify-center border-l border-[#774C60]/40 text-[#EACDC2]/60 transition-colors hover:bg-[#774C60]/20 hover:text-[#F7EDE8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#EACDC2]"
                          aria-label={`Edit ${section.courseCode} ${section.sectionCode}`}
                        >
                          <MoreVertical className="h-5 w-5" />
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
                        
                        const backgroundColor = isConflicting ? '#DC2626' : normalizeScheduleColor(section.color);
                        const textColor = isConflicting ? '#FFFFFF' : getReadableTextColor(backgroundColor);


                        const blockId = `${section.courseCode}-${section.sectionCode}-${day}`;
                        const isExpanded = expandedBlock === blockId;

                        return (
                        <div
                            key={blockId}
                            onClick={() => handleCourseClick(section.courseCode, section.sectionCode, day)}
                            onContextMenu={(event) => handleContextMenu(event, section)}
                            className={`absolute left-0 right-0 mx-1 rounded-lg p-2 shadow-lg
                                    border-2 ${isConflicting ? 'border-red-400 animate-pulse' : 'border-white/20'}
                                    overflow-hidden group cursor-pointer
                                    transition-all duration-300 ease-out
                                    ${isExpanded ? 'z-50 scale-105 shadow-2xl ring-2 ring-[#EACDC2]' : 'hover:z-10 hover:shadow-xl hover:scale-102'}`}
                            style={{
                            top: `${(startPos / 840) * 100}%`,
                            height: `${(height / 840) * 100}%`,
                            minHeight: isExpanded ? '120px' : '40px',
                            backgroundColor,
                            color: textColor,
                            }}
                        >
                            <button
                            onClick={(e) => {
                                handleMoreClick(e, section);
                            }}
                            className="absolute top-1 right-1 w-5 h-5 bg-black/40 rounded-full flex items-center 
                                        justify-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity hover:bg-black/60 z-10"
                            aria-label={`Edit ${section.courseCode} ${section.sectionCode}`}
                            >
                            <MoreVertical className="w-3 h-3 text-white" />
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
      {courseMenu && selectedCourse && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          role="dialog"
          aria-label={`Edit ${courseMenu.section.courseCode} ${courseMenu.section.sectionCode}`}
          className="fixed z-[200] flex max-h-[min(620px,calc(100vh-32px))] w-[min(720px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl border border-[#774C60] bg-[#211A2B] text-[#EACDC2] shadow-2xl shadow-black/50 max-sm:max-h-[82vh] max-sm:w-[calc(100vw-16px)]"
          style={{ left: courseMenu.x, top: courseMenu.y }}
        >
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#774C60]/35 bg-[#211A2B] px-4 py-3.5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-lg font-bold text-[#F7EDE8]">{selectedCourse.courseCode}</p>
                <span className="rounded-full bg-[#372549] px-2 py-0.5 text-[11px] text-[#F4D7D2]">{courseMenu.section.sectionCode}</span>
                <span className="rounded-full bg-[#372549] px-2 py-0.5 text-[11px] text-[#EACDC2]/65">{courseMenu.section.sectionType?.toLowerCase()}</span>
              </div>
              <p className="mt-0.5 line-clamp-2 text-sm text-[#EACDC2]/65">{selectedCourse.courseTitle}</p>
            </div>
            <button
              onClick={() => setCourseMenu(null)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#EACDC2]/60 hover:bg-[#372549] hover:text-white"
              aria-label="Close course menu"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
            <div className="grid gap-5 md:grid-cols-[minmax(0,1.1fr)_minmax(260px,0.9fr)]">
              <section className="space-y-4 text-xs" aria-labelledby="course-info-heading">
                <div className="flex items-center gap-2 text-[#F4D7D2]">
                  <Info className="h-4 w-4" />
                  <h3 id="course-info-heading" className="font-semibold">Course and section information</h3>
                </div>
                <div className="grid gap-2 rounded-xl border border-[#774C60]/25 bg-[#1A1423]/35 p-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <p className="text-[10px] uppercase tracking-wide text-[#EACDC2]/40">Meeting time</p>
                    <p className="mt-1 leading-relaxed text-[#EACDC2]/80">{courseMenu.section.dateTime || 'Time to be arranged'}</p>
                  </div>
                  {courseMenu.section.room && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-[#EACDC2]/40">Room</p>
                      <p className="mt-1 text-[#EACDC2]/70">{courseMenu.section.room}</p>
                    </div>
                  )}
                  {courseMenu.section.instructor && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-[#EACDC2]/40">Instructor</p>
                      <p className="mt-1 text-[#EACDC2]/70">{courseMenu.section.instructor}</p>
                    </div>
                  )}
                  {courseMenu.section.quota && (
                    <div className="sm:col-span-2">
                      <p className="text-[10px] uppercase tracking-wide text-[#EACDC2]/40">Enrollment</p>
                      <p className="mt-1 text-[#EACDC2]/70">{courseMenu.section.enrolled}/{courseMenu.section.quota} enrolled · {courseMenu.section.available} available</p>
                    </div>
                  )}
                </div>
                <div className="rounded-xl border border-[#774C60]/25 bg-[#1A1423]/35 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-[#EACDC2]/40">Course color</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {activePalette.colors.map(color => {
                      const selected = normalizeScheduleColor(courseMenu.section.color) === color;
                      return (
                        <button
                          key={color}
                          onClick={() => {
                            onCourseColorChange(courseMenu.section.courseCode, color);
                            setCourseMenu(previous => previous ? {
                              ...previous,
                              section: { ...previous.section, color },
                            } : previous);
                          }}
                          aria-label={`Set ${courseMenu.section.courseCode} color to ${color}`}
                          aria-pressed={selected}
                          className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 ${selected ? 'border-white ring-2 ring-[#B75D69]' : 'border-white/20'}`}
                          style={{ backgroundColor: color }}
                        />
                      );
                    })}
                  </div>
                </div>
                {selectedCourse.prerequisites && (
                  <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-3">
                    <p className="font-semibold text-amber-200">Prerequisites</p>
                    <p className="mt-1 leading-relaxed text-amber-100/75">{selectedCourse.prerequisites}</p>
                  </div>
                )}
                {selectedCourse.description && (
                  <div>
                    <p className="font-semibold text-[#F4D7D2]">Description</p>
                    <p className="mt-1.5 leading-relaxed text-[#EACDC2]/65">{selectedCourse.description}</p>
                  </div>
                )}
              </section>

              <section className="border-t border-[#774C60]/35 pt-4 md:border-l md:border-t-0 md:pl-5 md:pt-0" aria-labelledby="swap-section-heading">
                <div className="mb-3 flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-[#B75D69]" />
                  <h3 id="swap-section-heading" className="text-xs font-semibold text-[#F4D7D2]">Swap {courseMenu.section.sectionType?.toLowerCase()} section</h3>
                </div>
                {alternativeSections.length > 0 ? (
                  <div className="space-y-2">
                    {alternativeSections.map(section => (
                      <button
                        key={section.sectionCode}
                        onClick={() => {
                          onSwapSection({
                            ...section,
                            courseCode: selectedCourse.courseCode,
                            courseTitle: selectedCourse.courseTitle,
                            credits: selectedCourse.credits,
                            color: courseMenu.section.color,
                          });
                          setCourseMenu(null);
                        }}
                        className="w-full rounded-xl border border-[#774C60]/35 bg-[#2A2134] p-3 text-left transition-colors hover:border-[#B75D69] hover:bg-[#372549]"
                      >
                        <span className="font-semibold text-[#F7EDE8]">{section.sectionCode}</span>
                        <span className="ml-2 text-[11px] text-emerald-300">{section.available} available</span>
                        <span className="mt-1.5 block text-[11px] leading-relaxed text-[#EACDC2]/60">{section.dateTime || 'Time to be arranged'}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl bg-[#1A1423]/45 p-3 text-xs text-[#EACDC2]/50">No alternative sections are available.</p>
                )}
              </section>
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[#774C60]/35 bg-[#211A2B] px-4 py-3">
            <p className="hidden text-xs text-[#EACDC2]/45 sm:block">Changes are saved automatically.</p>
            <button
              onClick={() => {
                onRemoveSection(courseMenu.section.courseCode);
                setCourseMenu(null);
              }}
              className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-red-400/25 bg-red-500/10 px-4 text-sm font-semibold text-red-200 transition-colors hover:bg-red-500/20 sm:w-auto"
            >
              <Trash2 className="h-4 w-4" />
              Remove course
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
