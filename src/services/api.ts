import * as core from './api/core';
import * as auth from './api/auth';
import * as classrooms from './api/classrooms';
import * as students from './api/students';
import * as attendance from './api/attendance';
import * as grades from './api/grades';
import * as dashboard from './api/dashboard';

// Aggregate all service modules into the single 'api' object
// to maintain backward compatibility with the existing application structure.
export const api = {
  ...core,
  ...auth,
  ...classrooms,
  ...students,
  ...attendance,
  ...grades,
  ...dashboard
};
