const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf'
};

const COMPRESSIBLE = new Set([
  'text/html; charset=utf-8',
  'text/css; charset=utf-8',
  'application/javascript; charset=utf-8',
  'application/json; charset=utf-8',
  'application/xml; charset=utf-8',
  'text/plain; charset=utf-8',
  'image/svg+xml'
]);

function send404(req, res) {
  const custom404Path = path.join(PUBLIC_DIR, '404.html');
  const headers = {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'SAMEORIGIN'
  };

  if (fs.existsSync(custom404Path)) {
    const content = fs.readFileSync(custom404Path);
    res.writeHead(404, headers);
    if (req.method === 'HEAD') {
      res.end();
    } else {
      res.end(content);
    }
  } else {
    const fallbackHtml = `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>404 Bulunamadı</title></head><body><h1>404 Sayfa Bulunamadı</h1><p><a href="/">Ana Sayfa</a></p></body></html>`;
    res.writeHead(404, headers);
    if (req.method === 'HEAD') {
      res.end();
    } else {
      res.end(fallbackHtml);
    }
  }
}

const server = http.createServer((req, res) => {
  // Only accept GET and HEAD requests
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain', 'Allow': 'GET, HEAD' });
    res.end('Method Not Allowed');
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  // Security check: reject null bytes or parent directory traversal
  if (pathname.includes('\0') || pathname.includes('..')) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Bad Request');
    return;
  }

  // Clean route resolution
  let filePath = path.join(PUBLIC_DIR, pathname);

  try {
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    } else if (!path.extname(filePath)) {
      const htmlCandidate = filePath + '.html';
      const indexCandidate = path.join(filePath, 'index.html');
      if (fs.existsSync(htmlCandidate)) {
        filePath = htmlCandidate;
      } else if (fs.existsSync(indexCandidate)) {
        filePath = indexCandidate;
      }
    }
  } catch (e) {
    send404(req, res);
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      send404(req, res);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Caching headers strategy:
    // Versioned assets or files in /assets/ with query -> immutable 1 year
    // HTML pages -> max-age=60, stale-while-revalidate=600
    // Unversioned static assets -> max-age=600, stale-while-revalidate=86400
    const hasVersionQuery = parsedUrl.searchParams.has('v');
    const isHtml = ext === '.html';

    const cacheControl = hasVersionQuery
      ? 'public, max-age=31536000, immutable'
      : isHtml
        ? 'public, max-age=60, stale-while-revalidate=600'
        : 'public, max-age=600, stale-while-revalidate=86400';

    // Tight Security Headers
    const csp = "default-src 'self'; script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https:; connect-src 'self' https://api.github.com https://cloudflareinsights.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self';";

    const headers = {
      'Content-Type': contentType,
      'Cache-Control': cacheControl,
      'Content-Security-Policy': csp,
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Frame-Options': 'SAMEORIGIN',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
    };

    // If HEAD request, send headers and finish immediately without body
    if (req.method === 'HEAD') {
      headers['Content-Length'] = stats.size;
      res.writeHead(200, headers);
      res.end();
      return;
    }

    // Compression check (Brotli > Gzip > Deflate)
    const acceptEncoding = req.headers['accept-encoding'] || '';
    const shouldCompress = COMPRESSIBLE.has(contentType) && stats.size > 1024;

    if (shouldCompress && /\bbr\b/.test(acceptEncoding) && zlib.createBrotliCompress) {
      headers['Content-Encoding'] = 'br';
      res.writeHead(200, headers);
      const raw = fs.createReadStream(filePath);
      const brotli = zlib.createBrotliCompress();
      raw.pipe(brotli).pipe(res);
    } else if (shouldCompress && /\bgzip\b/.test(acceptEncoding)) {
      headers['Content-Encoding'] = 'gzip';
      res.writeHead(200, headers);
      const raw = fs.createReadStream(filePath);
      const gzip = zlib.createGzip({ level: 6 });
      raw.pipe(gzip).pipe(res);
    } else if (shouldCompress && /\bdeflate\b/.test(acceptEncoding)) {
      headers['Content-Encoding'] = 'deflate';
      res.writeHead(200, headers);
      const raw = fs.createReadStream(filePath);
      const deflate = zlib.createDeflate();
      raw.pipe(deflate).pipe(res);
    } else {
      headers['Content-Length'] = stats.size;
      res.writeHead(200, headers);
      fs.createReadStream(filePath).pipe(res);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Bitrox Landing Server] Listening on port ${PORT}`);
});
