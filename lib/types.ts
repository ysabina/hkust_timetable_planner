export interface ParsedTime {
  days: string[];
  startTime: string;
  endTime: string;
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
}

export interface Course {
  courseCode: string;
  courseTitle: string;
  department: string;
  sections: Section[];
}

export interface TimetableSection extends Section {
  courseCode: string;
  courseTitle: string;
  color?: string;
}

export interface Conflict {
  section1: string;
  section2: string;
  course1: string;
  course2: string;
}
