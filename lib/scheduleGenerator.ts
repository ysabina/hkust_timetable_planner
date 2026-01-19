import type { Course, Section, TimetableSection } from './types';
import type { UserPreferences, ScheduleCombination } from './preferences';

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
];

export class ScheduleGenerator {
  
  generateCombinations(
    courses: Course[], 
    preferences: UserPreferences
  ): ScheduleCombination[] {
    
    // Step 1: Convert Course objects to TimetableSections with colors
    const courseColorMap: { [key: string]: string } = {};
    let colorIndex = 0;
    
    const sectionsByCourse = courses.map(course => {
      // Assign color to this course if not already assigned
      if (!courseColorMap[course.courseCode]) {
        courseColorMap[course.courseCode] = COLORS[colorIndex % COLORS.length];
        colorIndex++;
      }
      
      const courseColor = courseColorMap[course.courseCode];
      
      // Convert sections to TimetableSection format
      const convertSection = (section: Section): TimetableSection => ({
        // Section fields
        sectionCode: section.sectionCode,
        dateTime: section.dateTime,
        room: section.room,
        instructor: section.instructor,
        taIaGta: section.taIaGta,
        quota: section.quota,
        enrolled: section.enrolled,
        available: section.available,
        wait: section.wait,
        remarks: section.remarks,
        parsedTime: section.parsedTime,
        sectionType: section.sectionType,
        linkedSection: section.linkedSection,
        
        // TimetableSection additional fields
        courseCode: course.courseCode,
        courseTitle: course.courseTitle,
        credits: course.credits,
        color: courseColor, // Same color for all sections of this course
      });
      
      return {
        courseCode: course.courseCode,
        lectures: course.sections
          .filter(s => s.sectionType === 'LECTURE')
          .map(convertSection),
        labs: course.sections
          .filter(s => s.sectionType === 'LAB')
          .map(convertSection),
        tutorials: course.sections
          .filter(s => s.sectionType === 'TUTORIAL')
          .map(convertSection),
      };
    });

    // Step 2: Generate all possible combinations (Cartesian product)
    const allCombinations = this.cartesianProduct(sectionsByCourse);

    // Step 3: Filter out combinations with time conflicts
    const validCombinations = allCombinations.filter(combo => 
      !this.hasTimeConflict(combo)
    );

    // Step 4: Score each combination
    const scoredCombinations = validCombinations.map(combo => ({
      sections: combo,
      ...this.scoreSchedule(combo, preferences)
    }));

    // Step 5: Sort by score (highest first)
    return scoredCombinations.sort((a, b) => b.score - a.score);
  }

  private cartesianProduct(sectionsByCourse: any[]): TimetableSection[][] {
    if (sectionsByCourse.length === 0) return [[]];

    const [first, ...rest] = sectionsByCourse;
    const combinations: TimetableSection[][] = [];

    // For each lecture in the first course
    for (const lecture of first.lectures) {
      // ✅ STEP 1: Find sections linked to this specific lecture
      const linkedLab = first.labs.find((lab: TimetableSection) => 
        lab.linkedSection === lecture.sectionCode
      );
      
      const linkedTutorial = first.tutorials.find((tut: TimetableSection) => 
        tut.linkedSection === lecture.sectionCode
      );

      // ✅ STEP 2: Determine which labs/tutorials to try
      let labsToTry: (TimetableSection | null)[];
      let tutorialsToTry: (TimetableSection | null)[];

      if (linkedLab) {
        // If there's a linked lab, ONLY use that one (e.g., L1 must use LA1)
        labsToTry = [linkedLab];
      } else if (first.labs.length > 0) {
        // If there are labs but no linked section, try all labs
        // (This handles cases where linking isn't enforced in data)
        labsToTry = first.labs;
      } else {
        // No labs at all for this course
        labsToTry = [null];
      }

      if (linkedTutorial) {
        // If there's a linked tutorial, ONLY use that one
        tutorialsToTry = [linkedTutorial];
      } else if (first.tutorials.length > 0) {
        // If there are tutorials but no linked section, try all
        tutorialsToTry = first.tutorials;
      } else {
        // No tutorials at all for this course
        tutorialsToTry = [null];
      }

      // ✅ STEP 3: Generate combinations
      for (const lab of labsToTry) {
        for (const tutorial of tutorialsToTry) {
          // Get combinations of remaining courses
          const restCombos = this.cartesianProduct(rest);

          // Add current course sections to each combination
          for (const restCombo of restCombos) {
            const combo = [lecture];
            if (lab) combo.push(lab);
            if (tutorial) combo.push(tutorial);
            combinations.push([...combo, ...restCombo]);
          }
        }
      }
    }

    return combinations;
  }

  private hasTimeConflict(sections: TimetableSection[]): boolean {
    for (let i = 0; i < sections.length; i++) {
      for (let j = i + 1; j < sections.length; j++) {
        if (this.sectionsOverlap(sections[i], sections[j])) {
          return true;
        }
      }
    }
    return false;
  }

  private sectionsOverlap(s1: TimetableSection, s2: TimetableSection): boolean {
    if (!s1.parsedTime || !s2.parsedTime) return false;

    const slots1 = s1.parsedTime.timeslots || [s1.parsedTime];
    const slots2 = s2.parsedTime.timeslots || [s2.parsedTime];

    for (const slot1 of slots1) {
      for (const slot2 of slots2) {
        const commonDays = slot1.days.filter(day => slot2.days.includes(day));
        if (commonDays.length > 0) {
          const start1 = this.parseTime(slot1.startTime);
          const end1 = this.parseTime(slot1.endTime);
          const start2 = this.parseTime(slot2.startTime);
          const end2 = this.parseTime(slot2.endTime);

          if (start1 < end2 && start2 < end1) {
            return true;
          }
        }
      }
    }
    return false;
  }

  private scoreSchedule(
    sections: TimetableSection[], 
    preferences: UserPreferences
  ): { score: number; breakdown: any } {
    
    let score = 100;
    const breakdown = {
      morningPenalty: 0,
      eveningPenalty: 0,
      fridayPenalty: 0,
      daysOffBonus: 0,
      gapPenalty: 0,
      compactBonus: 0,
    };

    breakdown.morningPenalty = this.calculateMorningPenalty(sections);
    breakdown.eveningPenalty = this.calculateEveningPenalty(sections);
    breakdown.fridayPenalty = this.calculateFridayPenalty(sections);
    breakdown.daysOffBonus = this.calculateDaysOffBonus(sections);
    breakdown.gapPenalty = this.calculateGapPenalty(sections);

    score -= breakdown.morningPenalty * preferences.weights.noMorning;
    score -= breakdown.eveningPenalty * preferences.weights.noEvening;
    score -= breakdown.fridayPenalty * preferences.weights.noFriday;
    score += breakdown.daysOffBonus * preferences.weights.daysOff;
    score -= breakdown.gapPenalty * preferences.weights.minimizeGaps;

    return { score: Math.max(0, score), breakdown };
  }

  private calculateMorningPenalty(sections: TimetableSection[]): number {
    let count = 0;
    sections.forEach(section => {
      if (section.parsedTime) {
        const slots = section.parsedTime.timeslots || [section.parsedTime];
        slots.forEach(slot => {
          const startTime = this.parseTime(slot.startTime);
          if (startTime < 600) { // Before 10:00 AM
            count += slot.days.length;
          }
        });
      }
    });
    return count * 2;
  }

  private calculateEveningPenalty(sections: TimetableSection[]): number {
    let count = 0;
    sections.forEach(section => {
      if (section.parsedTime) {
        const slots = section.parsedTime.timeslots || [section.parsedTime];
        slots.forEach(slot => {
          const endTime = this.parseTime(slot.endTime);
          if (endTime > 1080) { // After 6:00 PM
            count += slot.days.length;
          }
        });
      }
    });
    return count * 2;
  }

  private calculateFridayPenalty(sections: TimetableSection[]): number {
    let count = 0;
    sections.forEach(section => {
      if (section.parsedTime) {
        const slots = section.parsedTime.timeslots || [section.parsedTime];
        slots.forEach(slot => {
          if (slot.days.includes('Friday')) {
            count++;
          }
        });
      }
    });
    return count * 3;
  }

  private calculateDaysOffBonus(sections: TimetableSection[]): number {
    const daysUsed = new Set<string>();
    sections.forEach(section => {
      if (section.parsedTime) {
        const slots = section.parsedTime.timeslots || [section.parsedTime];
        slots.forEach(slot => {
          slot.days.forEach(day => daysUsed.add(day));
        });
      }
    });
    
    const daysOff = 5 - daysUsed.size;
    return daysOff * 5;
  }

  private calculateGapPenalty(sections: TimetableSection[]): number {
    const daySchedules: { [day: string]: Array<{ start: number; end: number }> } = {};
    
    sections.forEach(section => {
      if (section.parsedTime) {
        const slots = section.parsedTime.timeslots || [section.parsedTime];
        slots.forEach(slot => {
          slot.days.forEach(day => {
            if (!daySchedules[day]) daySchedules[day] = [];
            daySchedules[day].push({
              start: this.parseTime(slot.startTime),
              end: this.parseTime(slot.endTime),
            });
          });
        });
      }
    });

    let totalGapMinutes = 0;
    Object.values(daySchedules).forEach(schedule => {
      schedule.sort((a, b) => a.start - b.start);
      for (let i = 0; i < schedule.length - 1; i++) {
        const gap = schedule[i + 1].start - schedule[i].end;
        if (gap > 60) { // Gaps over 1 hour
          totalGapMinutes += gap;
        }
      }
    });

    return totalGapMinutes / 30;
  }

  private parseTime(time: string): number {
    const match = time.match(/(\d+):(\d+)(AM|PM)/);
    if (!match) return 0;
    
    let [, hours, minutes, period] = match;
    let h = parseInt(hours);
    const m = parseInt(minutes);
    
    if (period === 'PM' && h !== 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    
    return h * 60 + m;
  }
}
