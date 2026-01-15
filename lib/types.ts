export interface ParsedTime {
  days: string[];
  startTime: string;
  endTime: string;
  timeslots?: Array<{
    days: string[];
    startTime: string;
    endTime: string;
  }>;
}

export interface Section {
  sectionCode: string;
  dateTime: string;
  room: string;
  instructor: string;
  taIaGta: string;
  quota: string;
  enrolled: string;
  available: string;
  wait: string;
  remarks: string;
  parsedTime?: ParsedTime;
  sectionType?: 'LECTURE' | 'LAB' | 'TUTORIAL' | 'OTHER';
  linkedSection?: string | null;
}

export interface Course {
  courseCode: string;
  courseTitle: string;
  department: string;
  credits?: number;
  sections: Section[];
}

export interface TimetableSection extends Section {
  courseCode: string;
  courseTitle: string;
  color?: string;
  credits?: number;
}

export interface Conflict {
  course1: string;
  section1: string;
  course2: string;
  section2: string;
  reason: string;
}
