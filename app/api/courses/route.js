import { scrapeTermCourses } from '../../../scripts/scrape-courses.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export const preferredRegion = ['hkg1'];

let activeRefresh = null;

export async function GET() {
  try {
    // Coalesce simultaneous clicks so they do not launch duplicate full scrapes.
    if (!activeRefresh) {
      activeRefresh = scrapeTermCourses('2610', { concurrency: 12 })
        .finally(() => { activeRefresh = null; });
    }

    const courses = await activeRefresh;
    return Response.json(
      { courses, refreshedAt: new Date().toISOString() },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (error) {
    console.error('Live course refresh failed:', error);
    return Response.json(
      { error: 'Unable to refresh HKUST course data right now.' },
      { status: 502, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  }
}
