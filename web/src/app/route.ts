import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';


export async function GET() {
  try {
    // Try reading root index.html first, then local public/index.html
    const rootPath = path.resolve(process.cwd(), '..', 'index.html');
    const localPublicPath = path.resolve(process.cwd(), 'public', 'index.html');
    const localPath = path.resolve(process.cwd(), 'index.html');

    let html = '';
    if (fs.existsSync(rootPath)) {
      html = fs.readFileSync(rootPath, 'utf8');
    } else if (fs.existsSync(localPublicPath)) {
      html = fs.readFileSync(localPublicPath, 'utf8');
    } else if (fs.existsSync(localPath)) {
      html = fs.readFileSync(localPath, 'utf8');
    } else {
      return new NextResponse('Landing page index.html not found', { status: 404 });
    }

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    return new NextResponse('Error loading landing page: ' + String(error), { status: 500 });
  }
}
