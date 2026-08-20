import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import ts from 'typescript';

const generatorUrl = new URL('../lib/scheduleGenerator.ts', import.meta.url);
const dataUrl = new URL('../public/courses_2610.json', import.meta.url);
const source = await readFile(generatorUrl, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const { ScheduleGenerator } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const courses = JSON.parse(await readFile(dataUrl, 'utf8'));
const preferences = {
  weights: { noMorning: 5, noEvening: 3, noFriday: 7, daysOff: 8, minimizeGaps: 6, compact: 4 },
};

function timeToMinutes(time) {
  const match = time.match(/^(\d{1,2}):(\d{2})(AM|PM)$/);
  if (!match) return Number.NaN;
  let hours = Number(match[1]);
  if (match[3] === 'PM' && hours !== 12) hours += 12;
  if (match[3] === 'AM' && hours === 12) hours = 0;
  return hours * 60 + Number(match[2]);
}

assert.equal(new Set(courses.map(course => course.courseCode)).size, courses.length, 'Duplicate course codes');
let multiMeetingSections = 0;
for (const course of courses) {
  assert.equal(new Set(course.sections.map(section => section.sectionCode)).size, course.sections.length, `Duplicate sections in ${course.courseCode}`);
  for (const section of course.sections) {
    const timeslots = section.parsedTime?.timeslots || [];
    if (timeslots.length > 1) multiMeetingSections += 1;
    for (const timeslot of timeslots) {
      assert.ok(timeslot.days.length > 0, `Missing day in ${course.courseCode} ${section.sectionCode}`);
      assert.ok(timeToMinutes(timeslot.startTime) < timeToMinutes(timeslot.endTime), `Invalid time in ${course.courseCode} ${section.sectionCode}`);
    }
  }
}

let slowestCourse = { code: '', milliseconds: 0 };
let totalSchedules = 0;

for (const course of courses) {
  const generator = new ScheduleGenerator();
  const started = performance.now();
  const schedules = generator.generateCombinations([course], preferences);
  const milliseconds = performance.now() - started;

  assert.ok(schedules.length > 0, `${course.courseCode} produced no schedules`);
  assert.ok(schedules.every(schedule => Number.isFinite(schedule.score) && schedule.score >= 0 && schedule.score <= 100));
  assert.ok(schedules.every(schedule => schedule.sections.some(section => section.courseCode === course.courseCode)));
  assert.equal(generator.lastRunStats.truncated, false, `${course.courseCode} unexpectedly reached a search limit`);
  totalSchedules += schedules.length;
  if (milliseconds > slowestCourse.milliseconds) slowestCourse = { code: course.courseCode, milliseconds };
}

const worstCaseCodes = ['MATH 1013', 'PHYS 1112', 'ECON 2113', 'ECON 2123', 'MATH 1003', 'ISOM 2600'];
const worstCaseCourses = worstCaseCodes.map(code => {
  const course = courses.find(item => item.courseCode === code);
  assert.ok(course, `Missing stress-test course ${code}`);
  return course;
});
const worstCaseGenerator = new ScheduleGenerator();
const worstCaseStarted = performance.now();
const worstCaseSchedules = worstCaseGenerator.generateCombinations(worstCaseCourses, preferences);
const worstCaseMilliseconds = performance.now() - worstCaseStarted;

assert.ok(worstCaseSchedules.length > 0, 'Worst-case selection produced no schedules');
assert.ok(worstCaseMilliseconds < 5000, `Worst-case search took ${worstCaseMilliseconds.toFixed(0)}ms`);
assert.ok(worstCaseGenerator.lastRunStats.exploredNodes <= 250000);

const fina = courses.find(course => course.courseCode === 'FINA 3303');
assert.ok(fina, 'FINA 3303 is missing');
assert.deepEqual(fina.sections[0].parsedTime.timeslots, [
  { days: ['Monday'], startTime: '03:00PM', endTime: '04:20PM' },
  { days: ['Friday'], startTime: '10:30AM', endTime: '11:50AM' },
]);

const fridayConflict = {
  ...fina.sections[0],
  courseCode: 'TEST 1000',
  sectionCode: 'TEST',
  parsedTime: {
    days: ['Friday'],
    startTime: '10:30AM',
    endTime: '11:50AM',
    timeslots: [{ days: ['Friday'], startTime: '10:30AM', endTime: '11:50AM' }],
  },
};
assert.equal(worstCaseGenerator.sectionsOverlap(fina.sections[0], fridayConflict), true);

console.log(JSON.stringify({
  coursesTested: courses.length,
  multiMeetingSections,
  totalIndividualSchedules: totalSchedules,
  slowestCourse: { ...slowestCourse, milliseconds: Number(slowestCourse.milliseconds.toFixed(2)) },
  worstCase: {
    courses: worstCaseCodes,
    schedulesReturned: worstCaseSchedules.length,
    milliseconds: Number(worstCaseMilliseconds.toFixed(2)),
    ...worstCaseGenerator.lastRunStats,
  },
  mondayFridayRegression: 'passed',
}, null, 2));
