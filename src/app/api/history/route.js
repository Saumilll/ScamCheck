import { NextResponse } from 'next/server';
import { clearScans, listScans } from '@/lib/db';
import { PRIVACY, isHistoryEnabled } from '@/lib/privacy';
import { getVisitorId } from '@/lib/visitor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

// Returns ONLY the scans that belong to the visitor's own anonymous cookie.
export async function GET(request) {
  if (!isHistoryEnabled()) {
    return NextResponse.json({ enabled: false, scans: [], retentionDays: PRIVACY.retentionDays }, { headers: NO_STORE });
  }

  const { searchParams } = new URL(request.url);
  const requested = parseInt(searchParams.get('limit') || String(PRIVACY.maxHistory), 10);
  const limit = Number.isNaN(requested) ? PRIVACY.maxHistory : Math.max(1, Math.min(PRIVACY.maxHistory, requested));

  try {
    const ownerId = await getVisitorId({ create: false });
    const { scans, driver, note } = await listScans(ownerId, limit);
    return NextResponse.json(
      { enabled: true, scans, dbDriver: driver, dbNote: note, retentionDays: PRIVACY.retentionDays },
      { headers: NO_STORE }
    );
  } catch (err) {
    console.error('[history] read failed:', err);
    return NextResponse.json({ error: 'Could not read scan history.' }, { status: 500, headers: NO_STORE });
  }
}

// Deletes ONLY this visitor's scans.
export async function DELETE() {
  try {
    const ownerId = await getVisitorId({ create: false });
    await clearScans(ownerId);
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch (err) {
    console.error('[history] clear failed:', err);
    return NextResponse.json({ error: 'Could not clear scan history.' }, { status: 500, headers: NO_STORE });
  }
}
