const { app, BrowserWindow, Menu } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');

let mainWindow = null;
let server = null;
let serverPort = null;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.aac': 'audio/aac',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

function startServer(distDir, callback) {
  server = http.createServer((req, res) => {
    let reqUrl = decodeURI(req.url.split('?')[0]);
    if (reqUrl === '/' || reqUrl === '') {
      reqUrl = '/index.html';
    }

    const filePath = path.join(distDir, reqUrl);

    // Prevent directory traversal
    if (!filePath.startsWith(distDir)) {
      res.statusCode = 403;
      return res.end('Forbidden');
    }

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.statusCode = 404;
        return res.end('Not Found');
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const range = req.headers.range;

      if (range && (ext === '.mp4' || ext === '.mp3')) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
        const chunksize = end - start + 1;

        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${stats.size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': contentType
        });

        const stream = fs.createReadStream(filePath, { start, end });
        stream.pipe(res);
      } else {
        res.writeHead(200, {
          'Content-Length': stats.size,
          'Content-Type': contentType,
          'Accept-Ranges': 'bytes'
        });

        const stream = fs.createReadStream(filePath);
        stream.pipe(res);
      }
    });
  });

  server.listen(0, '127.0.0.1', () => {
    serverPort = server.address().port;
    callback(serverPort);
  });
}

function createWindow(port) {
  Menu.setApplicationMenu(null); // Clean window without browser menu bar

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 960,
    minHeight: 540,
    backgroundColor: '#040914',
    title: 'Deck & Tackle — What Sleeps Beneath Never Starves',
    webPreferences: {
      autoplayPolicy: 'no-user-gesture-required',
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadURL(`http://127.0.0.1:${port}/index.html`);

  // Handle F11 fullscreen toggle
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F11' && input.type === 'keyDown') {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
      event.preventDefault();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  const distDir = path.join(__dirname, 'dist');
  startServer(distDir, (port) => {
    createWindow(port);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(serverPort);
    }
  });
});

app.on('window-all-closed', () => {
  if (server) {
    server.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
