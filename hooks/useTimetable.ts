'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { Course, TimetableSection, Conflict } from '../lib/types';
import { mergeRefreshedSections } from '../lib/api';
import { DEFAULT_PALETTE_ID, getSchedulePalette, normalizeScheduleColor } from '../lib/colorPalettes';

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
  const [activePaletteId, setActivePaletteId] = useState(DEFAULT_PALETTE_ID);
  
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
        localStorage.removeItem('timetable-palette');
        localStorage.removeItem('smart-planner-courses');
        localStorage.setItem('timetable-version', STORAGE_VERSION);
        storageLoadedRef.current = true;
        return;
        }

        const savedSections = localStorage.getItem('timetable-sections');
        const savedColors = localStorage.getItem('timetable-colors');
        const savedPalette = localStorage.getItem('timetable-palette');
        const restoredPaletteId = savedPalette
          ? getSchedulePalette(savedPalette).id
          : DEFAULT_PALETTE_ID;
      
      if (savedColors) {
        const colorsArray = JSON.parse(savedColors).map(([courseCode, color]: [string, string]) => [
          courseCode,
          normalizeScheduleColor(color),
        ]);
        courseColorsRef.current = new Map(colorsArray);
      }
      const restoredSections = savedSections
        ? JSON.parse(savedSections).map((section: TimetableSection) => ({
            ...section,
            color: courseColorsRef.current.get(section.courseCode) || normalizeScheduleColor(section.color),
          }))
        : [];
      restoreTimer = setTimeout(() => {
        storageLoadedRef.current = true;
        setActivePaletteId(restoredPaletteId);
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
      localStorage.setItem('timetable-palette', activePaletteId);
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  }, [activePaletteId, selectedSections]); // Run whenever schedule appearance changes
  

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

      let assignedColor = courseColorsRef.current.get(section.courseCode);

      if (assignedColor) {
        return [...prev, { ...section, color: assignedColor }];
      }

      const palette = getSchedulePalette(activePaletteId);
      const colorIndex = courseColorsRef.current.size % palette.colors.length;
      assignedColor = palette.colors[colorIndex];
      courseColorsRef.current.set(section.courseCode, assignedColor);
      return [...prev, { ...section, color: assignedColor }];
    });
  }, [activePaletteId]);

  const removeSection = useCallback((courseCode: string) => {
    setSelectedSections(prev => prev.filter(s => s.courseCode !== courseCode));
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
  }, []);

  const refreshSections = useCallback((courses: Course[]) => {
    setSelectedSections(previous => mergeRefreshedSections(previous, courses));
  }, []);

  const setPalette = useCallback((paletteId: string) => {
    const palette = getSchedulePalette(paletteId);
    const courseCodes = [...new Set([
      ...courseColorsRef.current.keys(),
      ...selectedSections.map(section => section.courseCode),
    ])];
    const recolored = new Map(courseCodes.map((courseCode, index) => [
      courseCode,
      palette.colors[index % palette.colors.length],
    ]));
    courseColorsRef.current = recolored;
    setActivePaletteId(palette.id);
    setSelectedSections(previous => previous.map(section => ({
      ...section,
      color: recolored.get(section.courseCode) || palette.colors[0],
    })));
  }, [selectedSections]);

  const setCourseColor = useCallback((courseCode: string, color: string) => {
    const normalizedColor = normalizeScheduleColor(color);
    courseColorsRef.current.set(courseCode, normalizedColor);
    setSelectedSections(previous => previous.map(section =>
      section.courseCode === courseCode ? { ...section, color: normalizedColor } : section
    ));
  }, []);

  const colorizeSections = useCallback((sections: TimetableSection[]) => {
    const palette = getSchedulePalette(activePaletteId);
    const previewColors = new Map(courseColorsRef.current);
    return sections.map(section => {
      if (!previewColors.has(section.courseCode)) {
        previewColors.set(section.courseCode, palette.colors[previewColors.size % palette.colors.length]);
      }
      return { ...section, color: previewColors.get(section.courseCode) };
    });
  }, [activePaletteId]);

  const conflicts = checkTimeConflicts(selectedSections);

  return {
    selectedSections,
    conflicts,
    addSection,
    removeSection,
    switchSection,
    refreshSections,
    activePaletteId,
    setPalette,
    setCourseColor,
    colorizeSections,
    clearAll,
  };
}
