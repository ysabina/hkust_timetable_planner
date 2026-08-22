import type { Course, Section, TimetableSection } from './types';
import type { UserPreferences, ScheduleCombination } from './preferences';

const COLORS = [
  'bg-[#F75590]',
  'bg-[#FCE4D8]',
  'bg-[#FBD87F]',
  'bg-[#B5F8FE]',
  'bg-[#10FFCB]',
  'bg-[#E7B8FF]',
  'bg-[#FFD4D4]',
  'bg-[#C4A5E1]',
  'bg-blue-600',
  'bg-teal-600',
  'bg-orange-600',
];

export class ScheduleGenerator {
  private static readonly MAX_RANKED_SCHEDULES = 50;
  private static readonly MAX_SEARCH_NODES = 250000;

  public lastRunStats = {
    exploredNodes: 0,
    candidateSchedules: 0,
    returnedSchedules: 0,
    totalCartesianProducts: '0',
    courseOptionCounts: [] as Array<{ courseCode: string; options: number }>,
    truncated: false,
  };
  
  // ✅ Helper function to normalize section codes for matching
  private normalizeSectionCode(code: string | null | undefined): string {
    if (!code) return '';
    return code.toUpperCase().replace(/[\s()]/g, '');
  }

  // Check whether a lab/tutorial is tied to a specific lecture section.
  private isSectionLinked(linkedSection: string | null | undefined, targetSection: string): boolean {
    if (!linkedSection) return false;
    
    const normalized1 = this.normalizeSectionCode(linkedSection);
    const normalized2 = this.normalizeSectionCode(targetSection);
    
    // Try exact match after normalization
    if (normalized1 === normalized2) return true;
    
    // Try matching just the section part (e.g., "L1" matches "L12213")
    const sectionPattern = /^([A-Z]+\d+)/i;
    const match1 = linkedSection.match(sectionPattern);
    const match2 = targetSection.match(sectionPattern);
    
    if (match1 && match2) {
      const part1 = match1[1].toUpperCase();
      const part2 = match2[1].toUpperCase();
      if (part1 === part2) return true;
    }
    return false;
  }
  
  generateCombinations(
    courses: Course[], 
    preferences: UserPreferences
  ): ScheduleCombination[] {
    
    const courseColorMap: { [key: string]: string } = {};
    let colorIndex = 0;
    
    const sectionsByCourse = courses.map(course => {
      if (!courseColorMap[course.courseCode]) {
        courseColorMap[course.courseCode] = COLORS[colorIndex % COLORS.length];
        colorIndex++;
      }
      
      const courseColor = courseColorMap[course.courseCode];
      
      const convertSection = (section: Section): TimetableSection => ({
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
        courseCode: course.courseCode,
        courseTitle: course.courseTitle,
        credits: course.credits,
        color: courseColor,
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

    const courseOptions = sectionsByCourse
      .map(course => ({
        courseCode: course.courseCode,
        options: this.buildCourseOptions(course),
      }))
      .sort((a, b) => a.options.length - b.options.length);

    const totalCartesianProducts = courseOptions
      .reduce((product, course) => product * BigInt(course.options.length), BigInt(1))
      .toString();
    const courseOptionCounts = courseOptions.map(course => ({
      courseCode: course.courseCode,
      options: course.options.length,
    }));

    if (courseOptions.some(course => course.options.length === 0)) {
      this.lastRunStats = {
        exploredNodes: 0,
        candidateSchedules: 0,
        returnedSchedules: 0,
        totalCartesianProducts,
        courseOptionCounts,
        truncated: false,
      };
      return [];
    }

    return this.findBestCombinations(
      courseOptions,
      preferences,
      totalCartesianProducts,
      courseOptionCounts
    );
  }

  private buildCourseOptions(course: {
    lectures: TimetableSection[];
    labs: TimetableSection[];
    tutorials: TimetableSection[];
  }): TimetableSection[][] {
    const primarySections = course.lectures.length > 0 ? course.lectures : [null];
    const options: TimetableSection[][] = [];

    for (const lecture of primarySections) {
      const linkedLabs = lecture
        ? course.labs.filter(lab => this.isSectionLinked(lab.linkedSection, lecture.sectionCode))
        : [];
      const linkedTutorials = lecture
        ? course.tutorials.filter(tutorial => this.isSectionLinked(tutorial.linkedSection, lecture.sectionCode))
        : [];
      const labsToTry: (TimetableSection | null)[] = linkedLabs.length > 0
        ? linkedLabs
        : course.labs.length > 0 ? course.labs : [null];
      const tutorialsToTry: (TimetableSection | null)[] = linkedTutorials.length > 0
        ? linkedTutorials
        : course.tutorials.length > 0 ? course.tutorials : [null];

      for (const lab of labsToTry) {
        for (const tutorial of tutorialsToTry) {
          const option = [lecture, lab, tutorial].filter(
            (section): section is TimetableSection => section !== null
          );
          if (option.length > 0 && !this.hasTimeConflict(option)) options.push(option);
        }
      }
    }

    return options;
  }

  private findBestCombinations(courseOptions: Array<{
    courseCode: string;
    options: TimetableSection[][];
  }>, preferences: UserPreferences, totalCartesianProducts: string,
  courseOptionCounts: Array<{ courseCode: string; options: number }>): ScheduleCombination[] {
    const bestCombinations: ScheduleCombination[] = [];
    let exploredNodes = 0;
    let validSchedules = 0;
    let truncated = false;

    const rankCombination = (sections: TimetableSection[]) => {
      const combination: ScheduleCombination = {
        sections,
        ...this.scoreSchedule(sections, preferences),
      };
      bestCombinations.push(combination);
      bestCombinations.sort((a, b) => b.score - a.score);
      if (bestCombinations.length > ScheduleGenerator.MAX_RANKED_SCHEDULES) {
        bestCombinations.pop();
      }
    };

    const visit = (courseIndex: number, selected: TimetableSection[]) => {
      if (exploredNodes >= ScheduleGenerator.MAX_SEARCH_NODES) {
        truncated = true;
        return;
      }

      if (courseIndex === courseOptions.length) {
        validSchedules += 1;
        rankCombination(selected);
        return;
      }

      for (const option of courseOptions[courseIndex].options) {
        if (exploredNodes >= ScheduleGenerator.MAX_SEARCH_NODES) {
          truncated = true;
          break;
        }
        exploredNodes += 1;
        const conflicts = option.some(section =>
          selected.some(existing => this.sectionsOverlap(section, existing))
        );
        if (!conflicts) visit(courseIndex + 1, [...selected, ...option]);
      }
    };

    visit(0, []);
    this.lastRunStats = {
      exploredNodes,
      candidateSchedules: validSchedules,
      returnedSchedules: bestCombinations.length,
      totalCartesianProducts,
      courseOptionCounts,
      truncated,
    };
    return bestCombinations;
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
): Pick<ScheduleCombination, 'score' | 'breakdown'> {
  
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
  breakdown.compactBonus = Math.max(0, 10 - Math.min(10, breakdown.gapPenalty));

  // Normalize each component to 0-10 scale based on weights
  const totalWeight = preferences.weights.noMorning + 
                     preferences.weights.noEvening + 
                     preferences.weights.noFriday + 
                     preferences.weights.daysOff + 
                     preferences.weights.minimizeGaps +
                     preferences.weights.compact;

  if (totalWeight === 0) return { score: 50, breakdown };

  // Calculate weighted contributions (normalized to percentage of total weight)
  const morningScore = (10 - Math.min(10, breakdown.morningPenalty)) * (preferences.weights.noMorning / totalWeight);
  const eveningScore = (10 - Math.min(10, breakdown.eveningPenalty)) * (preferences.weights.noEvening / totalWeight);
  const fridayScore = (10 - Math.min(10, breakdown.fridayPenalty)) * (preferences.weights.noFriday / totalWeight);
  const daysOffScore = Math.min(10, breakdown.daysOffBonus) * (preferences.weights.daysOff / totalWeight);
  const gapScore = (10 - Math.min(10, breakdown.gapPenalty)) * (preferences.weights.minimizeGaps / totalWeight);
  const compactScore = breakdown.compactBonus * (preferences.weights.compact / totalWeight);

  // Sum all components and scale to 0-100
  const score = Math.round((morningScore + eveningScore + fridayScore + daysOffScore + gapScore + compactScore) * 10);

  return { score: Math.min(100, Math.max(0, score)), breakdown };
}


  private calculateMorningPenalty(sections: TimetableSection[]): number {
    let count = 0;
    sections.forEach(section => {
      if (section.parsedTime) {
        const slots = section.parsedTime.timeslots || [section.parsedTime];
        slots.forEach(slot => {
          const startTime = this.parseTime(slot.startTime);
          if (startTime < 600) {
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
          if (endTime > 1080) {
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
        if (gap > 60) {
          totalGapMinutes += gap;
        }
      }
    });

    return totalGapMinutes / 30;
  }

  private parseTime(time: string): number {
    const match = time.match(/(\d+):(\d+)(AM|PM)/);
    if (!match) return 0;
    
    const [, hours, minutes, period] = match;
    let h = parseInt(hours);
    const m = parseInt(minutes);
    
    if (period === 'PM' && h !== 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    
    return h * 60 + m;
  }
}
