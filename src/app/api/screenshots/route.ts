import { NextRequest, NextResponse } from 'next/server';

/**
 * API route for AI agents to request model screenshots.
 *
 * Since Three.js rendering requires a browser context (WebGL),
 * this endpoint serves as a documentation/proxy endpoint.
 *
 * The actual rendering happens client-side. AI agents should:
 * 1. POST to this endpoint to trigger a screenshot capture
 * 2. The client stores screenshots in the app state
 * 3. GET from this endpoint retrieves the latest screenshots
 *
 * For server-side rendering, we store screenshots as base64 in memory.
 */

// In-memory screenshot store (for demo/dev - use proper storage in production)
let screenshotStore: Array<{
  angle: string;
  label: string;
  image_base64: string;
  width: number;
  height: number;
  timestamp: number;
  model_name: string;
  parameters: Record<string, unknown>;
}> = [];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const angle = searchParams.get('angle');
  const format = searchParams.get('format') || 'json';

  let results = screenshotStore;

  if (angle) {
    results = results.filter((s) => s.angle === angle);
  }

  if (format === 'image' && results.length > 0) {
    // Return first matching screenshot as raw PNG
    const shot = results[0];
    const buffer = Buffer.from(shot.image_base64, 'base64');
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `inline; filename="model_${shot.angle}.png"`,
        'X-Model-Name': shot.model_name,
        'X-Angle': shot.angle,
        'X-Timestamp': shot.timestamp.toString(),
      },
    });
  }

  // Return JSON with base64 data for AI consumption
  return NextResponse.json({
    screenshots: results.map((s) => ({
      angle: s.angle,
      label: s.label,
      image_base64: s.image_base64,
      width: s.width,
      height: s.height,
      timestamp: s.timestamp,
      model_name: s.model_name,
    })),
    count: results.length,
    available_angles: [
      'perspective', 'front', 'back', 'right', 'left',
      'top', 'bottom', 'iso_front_right', 'iso_front_left', 'iso_back_right',
    ],
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { screenshots, model_name, parameters } = body;

    if (!screenshots || !Array.isArray(screenshots)) {
      return NextResponse.json(
        { error: 'screenshots array required' },
        { status: 400 }
      );
    }

    // Store screenshots
    screenshotStore = screenshots.map((s: any) => ({
      angle: s.angle,
      label: s.label,
      image_base64: s.image_base64,
      width: s.width || 800,
      height: s.height || 600,
      timestamp: Date.now(),
      model_name: model_name || 'unknown',
      parameters: parameters || {},
    }));

    return NextResponse.json({
      success: true,
      stored: screenshotStore.length,
      message: `Stored ${screenshotStore.length} screenshots for model "${model_name}"`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Invalid request' },
      { status: 400 }
    );
  }
}

export async function DELETE() {
  screenshotStore = [];
  return NextResponse.json({ success: true, message: 'Screenshots cleared' });
}
