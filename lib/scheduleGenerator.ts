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
  
  // ✅ Helper function to normalize section codes for matching
  private normalizeSectionCode(code: string | null | undefined): string {
    if (!code) return '';
    return code.toUpperCase().replace(/[\s()]/g, '');
  }

  // ✅ Check if two sections are linked - with detailed logging
  private isSectionLinked(linkedSection: string | null | undefined, targetSection: string): boolean {
    if (!linkedSection) {
      console.log(`      ❌ No linkedSection field`);
      return false;
    }
    
    const normalized1 = this.normalizeSectionCode(linkedSection);
    const normalized2 = this.normalizeSectionCode(targetSection);
    
    console.log(`      🔍 Comparing: "${linkedSection}" (normalized: "${normalized1}") vs "${targetSection}" (normalized: "${normalized2}")`);
    
    // Try exact match after normalization
    if (normalized1 === normalized2) {
      console.log(`      ✅ EXACT MATCH!`);
      return true;
    }
    
    // Try matching just the section part (e.g., "L1" matches "L12213")
    const sectionPattern = /^([A-Z]+\d+)/i;
    const match1 = linkedSection.match(sectionPattern);
    const match2 = targetSection.match(sectionPattern);
    
    if (match1 && match2) {
      const part1 = match1[1].toUpperCase();
      const part2 = match2[1].toUpperCase();
      console.log(`      🔍 Pattern match: "${part1}" vs "${part2}"`);
      if (part1 === part2) {
        console.log(`      ✅ PATTERN MATCH!`);
        return true;
      }
    }
    
    console.log(`      ❌ NO MATCH`);
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

    const allCombinations = this.cartesianProduct(sectionsByCourse);
    const validCombinations = allCombinations.filter(combo => 
      !this.hasTimeConflict(combo)
    );
    const scoredCombinations = validCombinations.map(combo => ({
      sections: combo,
      ...this.scoreSchedule(combo, preferences)
    }));

    return scoredCombinations.sort((a, b) => b.score - a.score);
  }

  private cartesianProduct(sectionsByCourse: any[]): TimetableSection[][] {
    if (sectionsByCourse.length === 0) return [[]];

    const [first, ...rest] = sectionsByCourse;
    const combinations: TimetableSection[][] = [];

    console.log(`\n🎓 Processing course: ${first.courseCode}`);
    console.log(`   Lectures: ${first.lectures.length}, Labs: ${first.labs.length}, Tutorials: ${first.tutorials.length}`);

    for (const lecture of first.lectures) {
      console.log(`\n  📚 Lecture: ${lecture.sectionCode}`);
      
      // Check all labs
      console.log(`    🔬 Checking ${first.labs.length} labs:`);
      const linkedLab = first.labs.find((lab: TimetableSection) => {
        console.log(`    Lab: ${lab.sectionCode}, linkedSection: "${lab.linkedSection}"`);
        return this.isSectionLinked(lab.linkedSection, lecture.sectionCode);
      });
      
      // Check all tutorials
      console.log(`    📝 Checking ${first.tutorials.length} tutorials:`);
      const linkedTutorial = first.tutorials.find((tut: TimetableSection) => {
        console.log(`    Tutorial: ${tut.sectionCode}, linkedSection: "${tut.linkedSection}"`);
        return this.isSectionLinked(tut.linkedSection, lecture.sectionCode);
      });

      let labsToTry: (TimetableSection | null)[];
      let tutorialsToTry: (TimetableSection | null)[];

      if (linkedLab) {
        labsToTry = [linkedLab];
        console.log(`    ✅ Using ONLY linked lab: ${linkedLab.sectionCode}`);
      } else if (first.labs.length > 0) {
        labsToTry = first.labs;
        console.log(`    ⚠️ No linked lab found, using ALL ${first.labs.length} labs`);
      } else {
        labsToTry = [null];
        console.log(`    ℹ️ No labs for this course`);
      }

      if (linkedTutorial) {
        tutorialsToTry = [linkedTutorial];
        console.log(`    ✅ Using ONLY linked tutorial: ${linkedTutorial.sectionCode}`);
      } else if (first.tutorials.length > 0) {
        tutorialsToTry = first.tutorials;
        console.log(`    ⚠️ No linked tutorial found, using ALL ${first.tutorials.length} tutorials`);
      } else {
        tutorialsToTry = [null];
        console.log(`    ℹ️ No tutorials for this course`);
      }

      for (const lab of labsToTry) {
        for (const tutorial of tutorialsToTry) {
          const restCombos = this.cartesianProduct(rest);

          for (const restCombo of restCombos) {
            const combo = [lecture];
            if (lab) combo.push(lab);
            if (tutorial) combo.push(tutorial);
            combinations.push([...combo, ...restCombo]);
          }
        }
      }
    }

    console.log(`  ✨ Generated ${combinations.length} combinations for ${first.courseCode}\n`);
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

  // Normalize each component to 0-10 scale based on weights
  const totalWeight = preferences.weights.noMorning + 
                     preferences.weights.noEvening + 
                     preferences.weights.noFriday + 
                     preferences.weights.daysOff + 
                     preferences.weights.minimizeGaps;

  // Calculate weighted contributions (normalized to percentage of total weight)
  const morningScore = (10 - Math.min(10, breakdown.morningPenalty)) * (preferences.weights.noMorning / totalWeight);
  const eveningScore = (10 - Math.min(10, breakdown.eveningPenalty)) * (preferences.weights.noEvening / totalWeight);
  const fridayScore = (10 - Math.min(10, breakdown.fridayPenalty)) * (preferences.weights.noFriday / totalWeight);
  const daysOffScore = Math.min(10, breakdown.daysOffBonus) * (preferences.weights.daysOff / totalWeight);
  const gapScore = (10 - Math.min(10, breakdown.gapPenalty)) * (preferences.weights.minimizeGaps / totalWeight);

  // Sum all components and scale to 0-100
  const score = Math.round((morningScore + eveningScore + fridayScore + daysOffScore + gapScore) * 10);

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
    
    let [, hours, minutes, period] = match;
    let h = parseInt(hours);
    const m = parseInt(minutes);
    
    if (period === 'PM' && h !== 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    
    return h * 60 + m;
  }
}
