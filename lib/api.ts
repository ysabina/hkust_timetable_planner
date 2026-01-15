import type { Course, Conflict } from './types';

export const courseAPI = {
  // Get all courses from static JSON
  getAllCourses: async (): Promise<Course[]> => {
    const response = await fetch('/courses_2530.json');
    if (!response.ok) {
      throw new Error('Failed to fetch courses');
    }
    return response.json();
  },

  // Get all departments (derived from courses)
  getDepartments: async (): Promise<string[]> => {
    const courses = await courseAPI.getAllCourses();
    const departments = [...new Set(courses.map(c => c.department))];
    return departments.sort();
  },

  // Get courses by department (filter locally)
  getCoursesByDepartment: async (dept: string): Promise<Course[]> => {
    const courses = await courseAPI.getAllCourses();
    return courses.filter(c => c.department === dept);
  },

  // Search courses (filter locally)
  searchCourses: async (query: string): Promise<Course[]> => {
    const courses = await courseAPI.getAllCourses();
    const lowerQuery = query.toLowerCase();
    return courses.filter(c =>
      c.courseCode.toLowerCase().includes(lowerQuery) ||
      c.courseTitle.toLowerCase().includes(lowerQuery) ||
      c.department.toLowerCase().includes(lowerQuery)
    );
  },

  // Get specific course (find locally)
  getCourse: async (code: string): Promise<Course> => {
    const courses = await courseAPI.getAllCourses();
    const course = courses.find(c => c.courseCode === code);
    if (!course) {
      throw new Error(`Course ${code} not found`);
    }
    return course;
  },

  // Check conflicts (no backend needed, handled by useTimetable hook)
  checkConflicts: async (sections: any[]): Promise<{ hasConflicts: boolean; conflicts: Conflict[] }> => {
    // This is already handled client-side in useTimetable.ts
    // Keeping this for compatibility, but it won't be used
    return { hasConflicts: false, conflicts: [] };
  },
};
