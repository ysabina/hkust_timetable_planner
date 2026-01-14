'use client';

import { useState, useCallback, useEffect } from 'react';
import type { TimetableSection, Conflict } from '../lib/types';  
import { courseAPI } from '../lib/api';

// Updated color palette matching your design
const COURSE_COLORS = [
  { bg: 'bg-[#372549]', text: 'text-white', border: 'border-[#372549]' },      // Midnight Violet
  { bg: 'bg-[#774C60]', text: 'text-white', border: 'border-[#774C60]' },      // Mauve Shadow
  { bg: 'bg-[#B75D69]', text: 'text-white', border: 'border-[#B75D69]' },      // Dusty Mauve
  { bg: 'bg-purple-600', text: 'text-white', border: 'border-purple-600' },
  { bg: 'bg-rose-500', text: 'text-white', border: 'border-rose-500' },
  { bg: 'bg-pink-600', text: 'text-white', border: 'border-pink-600' },
  { bg: 'bg-fuchsia-600', text: 'text-white', border: 'border-fuchsia-600' },
  { bg: 'bg-violet-600', text: 'text-white', border: 'border-violet-600' },
];

export function useTimetable() {
  const [selectedSections, setSelectedSections] = useState<TimetableSection[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [colorIndex, setColorIndex] = useState(0);

  // Add section to timetable
  const addSection = useCallback((section: TimetableSection) => {
    setSelectedSections((prev) => {
      // Remove any existing section from the same course
      const filtered = prev.filter((s) => s.courseCode !== section.courseCode);
      
      // Assign color
      const colorScheme = COURSE_COLORS[colorIndex % COURSE_COLORS.length];
      const sectionWithColor = {
        ...section,
        color: colorScheme.bg,
      };
      
      setColorIndex((prev) => prev + 1);
      return [...filtered, sectionWithColor];
    });
  }, [colorIndex]);

  // Remove section from timetable
  const removeSection = useCallback((courseCode: string) => {
    setSelectedSections((prev) => prev.filter((s) => s.courseCode !== courseCode));
  }, []);

  // Switch section for a course
  const switchSection = useCallback((courseCode: string, newSection: TimetableSection) => {
    setSelectedSections((prev) => {
      const oldSection = prev.find((s) => s.courseCode === courseCode);
      const filtered = prev.filter((s) => s.courseCode !== courseCode);
      
      const colorScheme = COURSE_COLORS[colorIndex % COURSE_COLORS.length];
      const sectionWithColor = {
        ...newSection,
        color: oldSection?.color || colorScheme.bg,
      };
      
      return [...filtered, sectionWithColor];
    });
  }, [colorIndex]);

  // Clear all sections
  const clearAll = useCallback(() => {
    setSelectedSections([]);
    setConflicts([]);
    setColorIndex(0);
  }, []);

  // Check for conflicts whenever sections change
  useEffect(() => {
    const checkConflicts = async () => {
      if (selectedSections.length < 2) {
        setConflicts([]);
        return;
      }

      try {
        const result = await courseAPI.checkConflicts(selectedSections);
        setConflicts(result.conflicts);
      } catch (error) {
        console.error('Error checking conflicts:', error);
      }
    };

    checkConflicts();
  }, [selectedSections]);

  return {
    selectedSections,
    conflicts,
    addSection,
    removeSection,
    switchSection,
    clearAll,
  };
}
