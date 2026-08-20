import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSubjectPage, parseTime } from './scrape-courses.mjs';

const fixture = `
<div class="course">
  <div class="subject">FINA 3303 - Intermediate Corporate Finance (3 units)</div>
  <table class="sections">
    <tr class="mainRow"><td>L1 (2819)</td><td>Mo 03:00PM - 04:20PM</td><td>Room A</td><td><div class="instructorList"><a>Teacher A</a></div></td><td></td><td>75</td><td>43</td><td>32</td><td>0</td><td></td></tr>
    <tr class="mobileInstructorRow"><td></td></tr>
    <tr class="otherRow"><td></td><td>Fr 10:30AM - 11:50AM</td><td>Room A</td><td><div class="instructorList"><a>Teacher A</a></div></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
    <tr class="mobileViewDetail"><td></td></tr>
    <tr class="mainRow"><td>L2 (2820)</td><td>TuTh 01:30PM - 02:50PM</td><td>Room B</td><td><div class="instructorList">TBA</div></td><td></td><td>80</td><td>0</td><td>80</td><td>0</td><td></td></tr>
  </table>
</div>`;

test('merges continuation meeting rows into their primary section', () => {
  const [course] = parseSubjectPage(fixture, 'FINA');
  const [section] = course.sections;

  assert.equal(section.dateTime, 'Mo 03:00PM - 04:20PM; Fr 10:30AM - 11:50AM');
  assert.deepEqual(section.parsedTime.timeslots, [
    { days: ['Monday'], startTime: '03:00PM', endTime: '04:20PM' },
    { days: ['Friday'], startTime: '10:30AM', endTime: '11:50AM' },
  ]);
  assert.deepEqual(section.parsedTime.days, ['Monday', 'Friday']);
  assert.equal(section.room, 'Room A');
  assert.equal(section.instructor, 'Teacher A');
});

test('stops continuation rows at the next primary section', () => {
  const [course] = parseSubjectPage(fixture, 'FINA');
  const secondSection = course.sections[1];

  assert.equal(secondSection.dateTime, 'TuTh 01:30PM - 02:50PM');
  assert.deepEqual(secondSection.parsedTime.timeslots, [
    { days: ['Tuesday', 'Thursday'], startTime: '01:30PM', endTime: '02:50PM' },
  ]);
  assert.equal(secondSection.instructor, 'TBA');
});

test('deduplicates identical timeslots while retaining different times', () => {
  const parsed = parseTime('Mo 09:00AM - 10:00AM; Mo 09:00AM - 10:00AM; Fr 11:00AM - 12:00PM');

  assert.equal(parsed.timeslots.length, 2);
  assert.deepEqual(parsed.days, ['Monday', 'Friday']);
});

test('leaves TBA sections without a parsed time', () => {
  assert.equal(parseTime('TBA'), undefined);
});
