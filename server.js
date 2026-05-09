const fs = require('fs');
const http = require('http');
const net = require('net');
const path = require('path');
const tls = require('tls');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 5500);
const PUBLIC_FILES = new Set(['.html', '.css', '.js', '.json', '.svg', '.png', '.jpg', '.jpeg', '.gif', '.ico']);

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
};

function loadEnvFile() {
  const envPath = path.join(ROOT, '.env');

  if (!fs.existsSync(envPath)) {
    return;
  }

  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) {
      continue;
    }

    const separator = trimmed.indexOf('=');
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, '');

    if (key && !process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  response.end(body);
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';

    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 10000) {
        reject(new Error('Message is too large.'));
        request.destroy();
      }
    });

    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

function hasEmailSettings() {
  return process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;
}

function encodeHeader(value) {
  return String(value).replace(/[\r\n]/g, ' ').trim();
}

function formatMessage({ from, to, replyTo, subject, text }) {
  return [
    `From: ${encodeHeader(from)}`,
    `To: ${encodeHeader(to)}`,
    `Reply-To: ${encodeHeader(replyTo)}`,
    `Subject: ${encodeHeader(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    '',
    text,
  ].join('\r\n');
}

function createSmtpSession(socket, host) {
  let activeSocket = socket;
  let buffer = '';
  const waiters = [];

  function attach(nextSocket) {
    activeSocket = nextSocket;
    buffer = '';
    activeSocket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      flush();
    });
    activeSocket.on('error', (error) => {
      while (waiters.length) {
        waiters.shift().reject(error);
      }
    });
  }

  function flush() {
    if (!waiters.length) {
      return;
    }

    const match = buffer.match(/(?:^|\r?\n)(\d{3}) [^\r\n]*(?:\r?\n|$)/);

    if (!match) {
      return;
    }

    const response = buffer.slice(0, match.index + match[0].length);
    buffer = buffer.slice(response.length);
    waiters.shift().resolve({ code: Number(match[1]), response });
  }

  function waitForResponse(expectedCode) {
    return new Promise((resolve, reject) => {
      waiters.push({
        resolve: (result) => {
          if (expectedCode && result.code !== expectedCode) {
            reject(new Error(`SMTP expected ${expectedCode}, got ${result.code}: ${result.response.trim()}`));
            return;
          }

          resolve(result);
        },
        reject,
      });
      flush();
    });
  }

  function send(command, expectedCode) {
    activeSocket.write(`${command}\r\n`);
    return waitForResponse(expectedCode);
  }

  function upgradeToTls() {
    return new Promise((resolve, reject) => {
      activeSocket.removeAllListeners('data');
      activeSocket.removeAllListeners('error');
      const secureSocket = tls.connect({ socket: activeSocket, servername: host }, () => {
        attach(secureSocket);
        resolve();
      });
      secureSocket.once('error', reject);
    });
  }

  attach(activeSocket);

  return {
    waitForResponse,
    send,
    upgradeToTls,
    end: () => activeSocket.end(),
  };
}

function connectSocket(host, port, secure) {
  return new Promise((resolve, reject) => {
    const socket = secure
      ? tls.connect({ host, port, servername: host }, () => resolve(socket))
      : net.connect({ host, port }, () => resolve(socket));

    socket.once('error', reject);
    socket.setTimeout(20000, () => {
      socket.destroy(new Error('SMTP connection timed out.'));
    });
  });
}

async function sendSmtpMail({ from, to, replyTo, subject, text }) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const socket = await connectSocket(host, port, secure);
  const session = createSmtpSession(socket, host);

  try {
    await session.waitForResponse(220);
    await session.send('EHLO brightcarehealthplans.com', 250);

    if (!secure) {
      await session.send('STARTTLS', 220);
      await session.upgradeToTls();
      await session.send('EHLO brightcarehealthplans.com', 250);
    }

    const auth = Buffer.from(`\u0000${user}\u0000${pass}`, 'utf8').toString('base64');
    await session.send(`AUTH PLAIN ${auth}`, 235);
    await session.send(`MAIL FROM:<${from}>`, 250);
    await session.send(`RCPT TO:<${to}>`, 250);
    await session.send('DATA', 354);

    const message = formatMessage({ from, to, replyTo, subject, text })
      .replace(/\r?\n/g, '\r\n')
      .replace(/^\./gm, '..');

    await session.send(`${message}\r\n.`, 250);
    await session.send('QUIT', 221).catch(() => {});
  } finally {
    session.end();
  }
}

async function handleContact(request, response) {
  if (!hasEmailSettings()) {
    sendJson(response, 500, { error: 'Email service is not configured yet.' });
    return;
  }

  let payload;
  try {
    payload = JSON.parse(await readBody(request));
  } catch (error) {
    sendJson(response, 400, { error: 'Please send a valid message.' });
    return;
  }

  const name = String(payload.name || '').trim();
  const email = String(payload.email || '').trim();
  const message = String(payload.message || '').trim();

  if (!name || !email || !message) {
    sendJson(response, 400, { error: 'Please fill out every field.' });
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    sendJson(response, 400, { error: 'Please enter a valid email address.' });
    return;
  }

  const recipient = process.env.CONTACT_TO || 'dot.edwardtuttle@gmail.com';
  const sender = process.env.CONTACT_FROM || process.env.SMTP_USER;

  try {
    await sendSmtpMail({
      from: sender,
      to: recipient,
      replyTo: email,
      subject: `Health plan inquiry from ${name}`,
      text: `Name: ${name}\nEmail: ${email}\n\nProject details:\n${message}`,
    });

    sendJson(response, 200, { ok: true });
  } catch (error) {
    console.error('Contact email failed:', error);
    sendJson(response, 500, { error: 'The message could not be sent right now.' });
  }
}

function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const requestedPath = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  const filePath = path.normalize(path.join(ROOT, requestedPath));

  if (!filePath.startsWith(ROOT) || !PUBLIC_FILES.has(path.extname(filePath).toLowerCase())) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('404 Not Found');
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('404 Not Found');
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, { 'Content-Type': contentTypes[extension] || 'application/octet-stream' });
    response.end(content);
  });
}

const server = http.createServer((request, response) => {
  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    });
    response.end();
    return;
  }

  if (request.method === 'POST' && request.url === '/api/contact') {
    handleContact(request, response);
    return;
  }

  if (request.method === 'GET' || request.method === 'HEAD') {
    serveStatic(request, response);
    return;
  }

  response.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
  response.end('Method Not Allowed');
});

server.listen(PORT, () => {
  console.log(`Serving site from ${ROOT} at http://localhost:${PORT}`);
});
