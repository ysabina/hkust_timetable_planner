import axios from 'axios';
import type { Course, Conflict } from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const courseAPI = {
  // Get all departments
  getDepartments: async (): Promise<string[]> => {
    const { data } = await api.get('/api/departments');
    return data;
  },

  // Get all courses
  getAllCourses: async (): Promise<Course[]> => {
    const { data } = await api.get('/api/courses');
    return data;
  },

  // Get courses by department
  getCoursesByDepartment: async (dept: string): Promise<Course[]> => {
    const { data } = await api.get(`/api/courses/${dept}`);
    return data;
  },

  // Search courses
  searchCourses: async (query: string): Promise<Course[]> => {
    const { data } = await api.get(`/api/search?q=${encodeURIComponent(query)}`);
    return data;
  },

  // Get specific course
  getCourse: async (code: string): Promise<Course> => {
    const { data } = await api.get(`/api/course/${code}`);
    return data;
  },

  // Check conflicts
  checkConflicts: async (sections: any[]): Promise<{ hasConflicts: boolean; conflicts: Conflict[] }> => {
    const { data } = await api.post('/api/check-conflicts', { sections });
    return data;
  },
};
