import { NextResponse } from 'next/server';
import { clearScans, listScans } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const requested = parseInt(searchParams.get('limit') || '20', 10);
  const limit = Number.isNaN(requested) ? 20 : Math.max(1, Math.min(100, requested));

  try {
    const { scans, driver, note } = await listScans(limit);
    return NextResponse.json({ scans, dbDriver: driver, dbNote: note });
  } catch (err) {
    console.error('[history] read failed:', err);
    return NextResponse.json({ error: 'Could not read scan history.' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await clearScans();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[history] clear failed:', err);
    return NextResponse.json({ error: 'Could not clear scan history.' }, { status: 500 });
  }
}
