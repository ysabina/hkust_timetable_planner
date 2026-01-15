'use client';

import { useState, useCallback } from 'react';
import type { TimetableSection, Conflict } from '../lib/types';

const COLORS = [
  'bg-[#B75D69]',
  'bg-[#774C60]',
  'bg-purple-600',
  'bg-blue-600',
  'bg-teal-600',
  'bg-green-600',
  'bg-yellow-600',
  'bg-orange-600',
];

export function useTimetable() {
  const [selectedSections, setSelectedSections] = useState<TimetableSection[]>([]);

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

  const parseTime = (time: string): number => {
    const match = time.match(/(\d+):(\d+)(AM|PM)/);
    if (!match) return 0;

    let [, hours, minutes, period] = match;
    let h = parseInt(hours);
    const m = parseInt(minutes);

    if (period === 'PM' && h !== 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;

    return h * 60 + m;
  };

  const addSection = useCallback((section: TimetableSection) => {
    setSelectedSections(prev => {
      // Check if this course+sectionType already exists
      const existingSectionOfType = prev.find(
        s => s.courseCode === section.courseCode && s.sectionType === section.sectionType
      );

      if (existingSectionOfType) {
        // Replace the existing section of this type
        return prev.map(s =>
          s.courseCode === section.courseCode && s.sectionType === section.sectionType
            ? { ...section, color: s.color } // Keep the same color
            : s
        );
      } else {
        // Add new section with a new color
        const color = COLORS[prev.length % COLORS.length];
        return [...prev, { ...section, color }];
      }
    });
  }, []);

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
  }, []);

  const conflicts = checkTimeConflicts(selectedSections);

  return {
    selectedSections,
    conflicts,
    addSection,
    removeSection,
    switchSection,
    clearAll,
  };
}
