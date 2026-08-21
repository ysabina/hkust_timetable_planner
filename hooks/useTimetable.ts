'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { Course, TimetableSection, Conflict } from '../lib/types';
import { mergeRefreshedSections } from '../lib/api';

const COLORS = [
  'bg-[#F75590]', // Wild Strawberry (Pink)
  'bg-[#FCE4D8]', // Powder Petal (Peach)
  'bg-[#FBD87F]', // Jasmine (Yellow)
  'bg-[#B5F8FE]', // Icy Aqua (Light Blue)
  'bg-[#10FFCB]', // Tropical Mint (Mint)
  'bg-[#E7B8FF]', // Lavender (Purple)
  'bg-[#FFD4D4]', // Light Coral
  'bg-[#C4A5E1]', // Soft Purple
  'bg-blue-600', // Deep Blue
  'bg-teal-600', // Teal
  'bg-orange-600', // Orange
  'bg-[#B75D69]', // Burgundy (kept as accent)
];
const STORAGE_VERSION = '1.0';

function parseTime(time: string): number {
  const match = time.match(/(\d+):(\d+)(AM|PM)/);
  if (!match) return 0;

  const [, hours, minutes, period] = match;
  let h = parseInt(hours);
  const m = parseInt(minutes);

  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;

  return h * 60 + m;
}

export function useTimetable() {
  const [selectedSections, setSelectedSections] = useState<TimetableSection[]>([]);
  
  // ✅ USE REF to track color assignments permanently
  const courseColorsRef = useRef<Map<string, string>>(new Map());
  const storageLoadedRef = useRef(false);

  // Load data from localStorage on mount
  useEffect(() => {
    let restoreTimer: ReturnType<typeof setTimeout> | undefined;
    try {
        const version = localStorage.getItem('timetable-version');
    
        // Clear if version mismatch
        if (version !== STORAGE_VERSION) {
        localStorage.removeItem('timetable-sections');
        localStorage.removeItem('timetable-colors');
        localStorage.removeItem('smart-planner-courses');
        localStorage.setItem('timetable-version', STORAGE_VERSION);
        storageLoadedRef.current = true;
        return;
        }

        const savedSections = localStorage.getItem('timetable-sections');
        const savedColors = localStorage.getItem('timetable-colors');
      
      if (savedColors) {
        const colorsArray = JSON.parse(savedColors);
        courseColorsRef.current = new Map(colorsArray);
        console.log('🎨 LOADED color assignments from localStorage');

      }
      const restoredSections = savedSections ? JSON.parse(savedSections) : [];
      restoreTimer = setTimeout(() => {
        storageLoadedRef.current = true;
        setSelectedSections(restoredSections);
      }, 0);
    } catch (error) {
      console.error('Error loading from localStorage:', error);
      storageLoadedRef.current = true;
    }
    return () => {
      if (restoreTimer) clearTimeout(restoreTimer);
    };
  }, []); // Empty array = run only once on mount

  // Save to localStorage whenever data changes
  useEffect(() => {
    if (!storageLoadedRef.current) return;
    try {
      localStorage.setItem('timetable-sections', JSON.stringify(selectedSections));
      
      // Convert Map to array for storage
      const colorsArray = Array.from(courseColorsRef.current.entries());
      localStorage.setItem('timetable-colors', JSON.stringify(colorsArray));
      
      console.log('💾 SAVED to localStorage');
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  }, [selectedSections]); // Run whenever selectedSections changes
  

  const checkTimeConflicts = useCallback((sections: TimetableSection[]): Conflict[] => {
    const conflicts: Conflict[] = [];

    for (let i = 0; i < sections.length; i++) {
      for (let j = i + 1; j < sections.length; j++) {
        const section1 = sections[i];
        const section2 = sections[j];

        if (!section1.parsedTime || !section2.parsedTime) continue;

        const timeslots1 = section1.parsedTime.timeslots || [section1.parsedTime];
        const timeslots2 = section2.parsedTime.timeslots || [section2.parsedTime];

        for (const slot1 of timeslots1) {
          for (const slot2 of timeslots2) {
            const commonDays = slot1.days.filter(day => slot2.days.includes(day));

            if (commonDays.length > 0) {
              const start1 = parseTime(slot1.startTime);
              const end1 = parseTime(slot1.endTime);
              const start2 = parseTime(slot2.startTime);
              const end2 = parseTime(slot2.endTime);

              if (start1 < end2 && start2 < end1) {
                conflicts.push({
                  course1: section1.courseCode,
                  section1: section1.sectionCode,
                  course2: section2.courseCode,
                  section2: section2.sectionCode,
                  reason: `Time overlap on ${commonDays.join(', ')}`
                });
              }
            }
          }
        }
      }
    }

    return conflicts;
  }, []);

  const addSection = useCallback((section: TimetableSection) => {
    setSelectedSections(prev => {
      // Check if this course+sectionType already exists
      const existingSectionOfType = prev.find(
        s => s.courseCode === section.courseCode && s.sectionType === section.sectionType
      );

      if (existingSectionOfType) {
        // Replace the existing section of this type (keep same color)
        return prev.map(s =>
          s.courseCode === section.courseCode && s.sectionType === section.sectionType
            ? { ...section, color: s.color }
            : s
        );
      }

      // ✅ Check if this course already has a color assigned in the ref
      let assignedColor = courseColorsRef.current.get(section.courseCode);

      if (assignedColor) {
        // Reuse existing color from ref
        console.log(`♻️ REUSING COLOR: ${section.courseCode} → ${assignedColor}`);
        return [...prev, { ...section, color: assignedColor }];
      }

      // ✅ NEW COURSE - assign next color based on ref map size (not state!)
      const colorIndex = courseColorsRef.current.size % COLORS.length;
      assignedColor = COLORS[colorIndex];
      
      // ✅ SAVE to ref so it persists even after removal
      courseColorsRef.current.set(section.courseCode, assignedColor);
      
      console.log(`🎨 NEW COURSE: ${section.courseCode} → Color ${colorIndex}: ${assignedColor}`);
      console.log(`📊 Total unique courses tracked: ${courseColorsRef.current.size}`);
      
      return [...prev, { ...section, color: assignedColor }];
    });
  }, []);

  const removeSection = useCallback((courseCode: string) => {
    setSelectedSections(prev => prev.filter(s => s.courseCode !== courseCode));
    // ✅ DON'T delete from courseColorsRef - keep the color reserved!
    console.log(`🗑️ REMOVED: ${courseCode} (color preserved in memory)`);
  }, []);

  const switchSection = useCallback((courseCode: string, newSection: TimetableSection) => {
    setSelectedSections(prev =>
      prev.map(section =>
        section.courseCode === courseCode && section.sectionType === newSection.sectionType
          ? { ...newSection, color: section.color }
          : section
      )
    );
  }, []);

  const clearAll = useCallback(() => {
    setSelectedSections([]);
    courseColorsRef.current.clear(); 
    localStorage.removeItem('timetable-sections');
    localStorage.removeItem('timetable-colors');
    console.log('🧹 CLEARED ALL - color assignments reset');
  }, []);

  const refreshSections = useCallback((courses: Course[]) => {
    setSelectedSections(previous => mergeRefreshedSections(previous, courses));
  }, []);

  const conflicts = checkTimeConflicts(selectedSections);

  return {
    selectedSections,
    conflicts,
    addSection,
    removeSection,
    switchSection,
    refreshSections,
    clearAll,
  };
}
