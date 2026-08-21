import type { Course, TimetableSection } from './types';

interface CourseRefreshResponse {
  courses: Course[];
  refreshedAt: string;
}

export function mergeRefreshedSections(
  sections: TimetableSection[],
  courses: Course[]
): TimetableSection[] {
  const courseMap = new Map(courses.map(course => [course.courseCode, course]));

  return sections.map(section => {
    const course = courseMap.get(section.courseCode);
    const refreshed = course?.sections.find(candidate => candidate.sectionCode === section.sectionCode);
    if (!course || !refreshed) return section;

    return {
      ...section,
      ...refreshed,
      courseCode: section.courseCode,
      courseTitle: course.courseTitle,
      credits: course.credits,
      color: section.color,
    };
  });
}

export const courseAPI = {
  // Get all courses from static JSON
  getAllCourses: async (): Promise<Course[]> => {
    const response = await fetch('/courses_2610.json');
    if (!response.ok) {
      throw new Error('Failed to fetch courses');
    }
    return response.json();
  },

  // Refresh directly from HKUST through the server-side scraper.
  refreshCourses: async (): Promise<CourseRefreshResponse> => {
    const response = await fetch('/api/courses', { cache: 'no-store' });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || 'Failed to refresh courses');
    }
    return payload;
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

};
