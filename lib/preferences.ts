import { Section, TimetableSection } from "./types";

export interface UserPreferences {
  // Time preferences
  noMorningClasses?: boolean;      // No classes before 10 AM
  noEveningClasses?: boolean;      // No classes after 6 PM
  noFridayClasses?: boolean;       // Prefer no Friday classes
  
  // Schedule compactness
  maximizeDaysOff?: boolean;       // Prefer fewer days per week
  minimizeGaps?: boolean;          // Minimize gaps between classes
  compactSchedule?: boolean;       // Classes close together
  
  // Instructor preferences
  preferredInstructors?: string[]; // List of preferred professors
  
  // Weights (1-10 scale)
  weights: {
    noMorning: number;
    noEvening: number;
    noFriday: number;
    daysOff: number;
    minimizeGaps: number;
    compact: number;
  };
}

export interface ScheduleCombination {
  sections: TimetableSection[];
  score: number;
  breakdown: {
    morningPenalty: number;
    eveningPenalty: number;
    fridayPenalty: number;
    daysOffBonus: number;
    gapPenalty: number;
    compactBonus: number;
  };
}
