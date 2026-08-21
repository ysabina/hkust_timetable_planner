#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import https from 'node:https';
import { load } from 'cheerio';

const BASE_URL = 'https://w5.ab.ust.hk/wcq/cgi-bin';
const DAY_NAMES = {
  Mo: 'Monday',
  Tu: 'Tuesday',
  We: 'Wednesday',
  Th: 'Thursday',
  Fr: 'Friday',
  Sa: 'Saturday',
  Su: 'Sunday',
};

function readOption(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

const term = readOption('term', '2610');
const output = resolve(readOption('output', `public/courses_${term}.json`));
const concurrency = Number(readOption('concurrency', '6'));

if (!/^\d{4}$/.test(term)) {
  throw new Error(`Invalid term code: ${term}`);
}
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 12) {
  throw new Error('Concurrency must be an integer between 1 and 12');
}

function cleanText(value) {
  return value.replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '; ').trim();
}

function cellText(cell) {
  const clone = cell.clone();
  clone.find('br').replaceWith('\n');
  return cleanText(clone.text());
}

function fetchHtml(url, redirectsLeft = 3) {
  return new Promise((resolveHtml, reject) => {
    const request = https.get(url, {
      headers: { 'User-Agent': 'hkust-timetable-planner/1.0 (course data refresh)' },
    }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        if (redirectsLeft === 0) {
          reject(new Error(`Too many redirects for ${url}`));
          return;
        }
        resolveHtml(fetchHtml(new URL(response.headers.location, url), redirectsLeft - 1));
        return;
      }
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`${response.statusCode} ${response.statusMessage} for ${url}`));
        return;
      }

      response.setEncoding('utf8');
      let html = '';
      response.on('data', (chunk) => {
        html += chunk;
        // The HKUST server occasionally leaves a completed chunked response open.
        if (html.includes('</html>')) {
          resolveHtml(html);
          request.destroy();
        }
      });
      response.on('end', () => resolveHtml(html));
      response.on('error', (error) => {
        if (!html.includes('</html>')) reject(error);
      });
    });
    request.setTimeout(90_000, () => request.destroy(new Error(`Timed out fetching ${url}`)));
    request.on('error', reject);
  });
}

async function fetchWithRetry(url, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetchHtml(url);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((done) => setTimeout(done, attempt * 1_000));
    }
  }
  throw lastError;
}

function parseDays(dayCodes) {
  const matches = dayCodes.match(/Mo|Tu|We|Th|Fr|Sa|Su/g) ?? [];
  return matches.map((day) => DAY_NAMES[day]);
}

export function parseTime(dateTime) {
  const pattern = /((?:Mo|Tu|We|Th|Fr|Sa|Su)+)\s+(\d{1,2}:\d{2}(?:AM|PM))\s*-\s*(\d{1,2}:\d{2}(?:AM|PM))/g;
  const timeslots = [];
  const seen = new Set();
  let match;

  while ((match = pattern.exec(dateTime)) !== null) {
    const timeslot = { days: parseDays(match[1]), startTime: match[2], endTime: match[3] };
    const key = JSON.stringify(timeslot);
    if (timeslot.days.length > 0 && !seen.has(key)) {
      timeslots.push(timeslot);
      seen.add(key);
    }
  }

  if (timeslots.length === 0) return undefined;
  return {
    days: [...new Set(timeslots.flatMap((slot) => slot.days))],
    startTime: timeslots[0].startTime,
    endTime: timeslots[0].endTime,
    timeslots,
  };
}

function sectionMetadata(sectionCode) {
  const shortCode = sectionCode.split(/\s+/)[0].toUpperCase();
  if (shortCode.startsWith('LA')) {
    return { sectionType: 'LAB', linkedSection: sectionCode.replace(/^LA/i, 'L') };
  }
  if (shortCode.startsWith('T')) {
    return { sectionType: 'TUTORIAL', linkedSection: null };
  }
  return { sectionType: 'LECTURE', linkedSection: null };
}

function uniqueNonEmpty(values) {
  return [...new Set(values.filter(Boolean))];
}

function linkedMeetingRows($, mainRow) {
  const rows = [$(mainRow)];
  let sibling = $(mainRow).next();

  while (sibling.length > 0 && !sibling.hasClass('mainRow')) {
    if (sibling.hasClass('otherRow')) rows.push(sibling);
    sibling = sibling.next();
  }

  return rows;
}

function peopleFromCell($, cell) {
  const links = cell.find('.instructorList').first().children('a')
    .map((_, item) => cleanText($(item).text()))
    .get();
  return links.length ? links : [cellText(cell)];
}

function parseCourseDetails($, course) {
  const table = course.find('.courseattr > .popupdetail > table').first();
  const rows = table.children('tbody').children('tr').length
    ? table.children('tbody').children('tr')
    : table.children('tr');
  const details = {};

  rows.each((_, rowElement) => {
    const row = $(rowElement);
    const heading = cleanText(row.children('th').first().text())
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, ' ')
      .trim();
    const value = cellText(row.children('td').first());
    if (heading && value) details[heading] = value;
  });

  const prerequisites = details['PRE REQUISITE'] || details.PREREQUISITE || '';
  const corequisites = details['CO REQUISITE'] || details.COREQUISITE || '';
  const exclusions = details.EXCLUSION || details.EXCLUSIONS || '';
  const description = details.DESCRIPTION || '';
  const attributes = details.ATTRIBUTES || '';
  const learningOutcomes = details['INTENDED LEARNING OUTCOMES'] || details.INTENDEDLEARNINGOUTCOMES || '';
  const knownHeadings = new Set([
    'PRE REQUISITE',
    'PREREQUISITE',
    'CO REQUISITE',
    'COREQUISITE',
    'EXCLUSION',
    'EXCLUSIONS',
    'DESCRIPTION',
    'ATTRIBUTES',
    'INTENDED LEARNING OUTCOMES',
    'INTENDEDLEARNINGOUTCOMES',
  ]);
  const additionalDetails = Object.fromEntries(
    Object.entries(details).filter(([heading]) => !knownHeadings.has(heading))
  );

  return {
    ...(description ? { description } : {}),
    ...(prerequisites ? { prerequisites } : {}),
    ...(corequisites ? { corequisites } : {}),
    ...(exclusions ? { exclusions } : {}),
    ...(attributes ? { attributes } : {}),
    ...(learningOutcomes ? { learningOutcomes } : {}),
    ...(Object.keys(additionalDetails).length ? { details: additionalDetails } : {}),
  };
}

export function parseSubjectPage(html, expectedDepartment) {
  const $ = load(html);
  const courses = [];

  $('.course').each((_, courseElement) => {
    const course = $(courseElement);
    const courseTitle = cleanText(course.find('.subject').first().text());
    const titleMatch = courseTitle.match(/^([A-Z]+)\s+([0-9]{3,4}[A-Z]?)\s+-\s+.*?\((\d+(?:\.\d+)?)\s+units?\)$/i);
    if (!titleMatch) return;

    const department = titleMatch[1].toUpperCase();
    const courseCode = `${department} ${titleMatch[2].toUpperCase()}`;
    const courseDetails = parseCourseDetails($, course);
    const sections = [];

    course.find('table.sections tr.mainRow').each((__, rowElement) => {
      const cells = $(rowElement).children('td');
      if (cells.length < 10) return;

      const sectionCode = cellText(cells.eq(0));
      if (!sectionCode) return;
      const meetingRows = linkedMeetingRows($, rowElement);
      const meetingCells = meetingRows.map((row) => row.children('td'));
      const dateTime = uniqueNonEmpty(meetingCells.map((rowCells) => cellText(rowCells.eq(1)))).join('; ');
      const rooms = uniqueNonEmpty(meetingCells.map((rowCells) => cellText(rowCells.eq(2))));
      const instructors = uniqueNonEmpty(meetingCells.flatMap((rowCells) => peopleFromCell($, rowCells.eq(3))));
      const assistants = uniqueNonEmpty(meetingCells.flatMap((rowCells) => peopleFromCell($, rowCells.eq(4))));
      const metadata = sectionMetadata(sectionCode);
      const parsedTime = parseTime(dateTime);

      sections.push({
        sectionCode,
        dateTime,
        room: rooms.join('; '),
        instructor: instructors.join('; '),
        taIaGta: assistants.join('; '),
        quota: cellText(cells.eq(5).clone().find('.quotadetail').remove().end()),
        enrolled: cellText(cells.eq(6)),
        available: cellText(cells.eq(7)),
        wait: cellText(cells.eq(8)),
        remarks: cellText(cells.eq(9).find('.popupdetail').first()),
        ...metadata,
        ...(parsedTime ? { parsedTime } : {}),
      });
    });

    if (department === expectedDepartment && sections.length > 0) {
      courses.push({
        courseCode,
        courseTitle,
        department,
        credits: Number(titleMatch[3]),
        ...courseDetails,
        sections,
      });
    }
  });

  return courses;
}

async function mapConcurrent(items, limit, work) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await work(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export async function scrapeTermCourses(scrapeTerm, options = {}) {
  const scrapeConcurrency = options.concurrency ?? 6;
  const logger = options.logger ?? (() => {});
  if (!/^\d{4}$/.test(scrapeTerm)) throw new Error(`Invalid term code: ${scrapeTerm}`);
  if (!Number.isInteger(scrapeConcurrency) || scrapeConcurrency < 1 || scrapeConcurrency > 12) {
    throw new Error('Concurrency must be an integer between 1 and 12');
  }

  const indexUrl = `${BASE_URL}/${scrapeTerm}/subject/ACCT`;
  logger(`Discovering subjects from ${indexUrl}`);
  const indexHtml = await fetchWithRetry(indexUrl);
  const indexPage = load(indexHtml);
  const departments = [...new Set(indexPage('#subjectItems a[href*="/subject/"]').map((_, link) => cleanText(indexPage(link).text())).get())];

  if (departments.length === 0) throw new Error(`No subjects found for term ${scrapeTerm}`);
  logger(`Found ${departments.length} subjects. Fetching with concurrency ${scrapeConcurrency}...`);

  const pages = await mapConcurrent(departments, scrapeConcurrency, async (department, index) => {
    const url = `${BASE_URL}/${scrapeTerm}/subject/${department}`;
    const html = department === 'ACCT' ? indexHtml : await fetchWithRetry(url);
    const courses = parseSubjectPage(html, department);
    logger(`[${index + 1}/${departments.length}] ${department}: ${courses.length} courses`);
    return courses;
  });

  const courses = pages.flat().sort((a, b) => a.courseCode.localeCompare(b.courseCode));
  const sectionCount = courses.reduce((total, course) => total + course.sections.length, 0);
  if (courses.length === 0 || sectionCount === 0) throw new Error('Scrape produced no usable course data');

  return courses;
}

async function main() {
  const courses = await scrapeTermCourses(term, { concurrency, logger: console.log });
  const sectionCount = courses.reduce((total, course) => total + course.sections.length, 0);

  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(courses, null, 2)}\n`);
  console.log(`Wrote ${courses.length} courses and ${sectionCount} sections to ${output}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
