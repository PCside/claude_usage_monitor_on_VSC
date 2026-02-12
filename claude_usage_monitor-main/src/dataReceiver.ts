import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface UsageData {
  fiveHour: {
    utilization: number;
    resetsAt: string;
  };
  sevenDay: {
    utilization: number;
    resetsAt: string;
  } | null;
  updatedAt: string;
}

const DATA_FILE_NAME = '.claude-usage-data.json';
const SERVER_PORT = 19876;
const FILE_DELETE_DELAY_MS = 20 * 1000; // 20 seconds

export class DataReceiver {
  private server: http.Server | null = null;
  private deleteTimeout: NodeJS.Timeout | null = null;
  private onDataCallback: ((data: UsageData) => void) | null = null;

  getDataFilePath(): string {
    return path.join(os.homedir(), DATA_FILE_NAME);
  }

  start(onData: (data: UsageData) => void): void {
    this.onDataCallback = onData;

    this.server = http.createServer((req, res) => {
      // CORS headers for Chrome extension
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      if (req.method === 'POST' && req.url === '/usage') {
        let body = '';

        req.on('data', (chunk) => {
          body += chunk.toString();
        });

        req.on('end', () => {
          try {
            const data: UsageData = JSON.parse(body);
            this.handleData(data);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
          } catch (error) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid JSON' }));
          }
        });
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    this.server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        console.log(`Port ${SERVER_PORT} is already in use`);
      } else {
        console.error('Server error:', error);
      }
    });

    this.server.listen(SERVER_PORT, '127.0.0.1', () => {
      console.log(`Claude Usage Monitor server listening on port ${SERVER_PORT}`);
    });

    // Also try to read existing data file on startup
    this.readExistingData();
  }

  private handleData(data: UsageData): void {
    // Write to file
    const filePath = this.getDataFilePath();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log('Usage data written to file');

    // Notify callback
    if (this.onDataCallback) {
      this.onDataCallback(data);
    }

    // Schedule file deletion
    this.scheduleFileDeletion();
  }

  private scheduleFileDeletion(): void {
    // Clear existing timeout if any
    if (this.deleteTimeout) {
      clearTimeout(this.deleteTimeout);
    }

    this.deleteTimeout = setTimeout(() => {
      const filePath = this.getDataFilePath();
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('Usage data file deleted (20s timeout)');
      }
    }, FILE_DELETE_DELAY_MS);
  }

  private readExistingData(): void {
    const filePath = this.getDataFilePath();
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const data: UsageData = JSON.parse(content);

        // Check if data is recent (within last minute)
        const updatedAt = new Date(data.updatedAt);
        const now = new Date();
        const ageMs = now.getTime() - updatedAt.getTime();

        if (ageMs < 60 * 1000) {
          // Data is fresh, use it
          if (this.onDataCallback) {
            this.onDataCallback(data);
          }
          // Schedule deletion for remaining time
          const remainingMs = Math.max(0, FILE_DELETE_DELAY_MS - ageMs);
          if (this.deleteTimeout) {
            clearTimeout(this.deleteTimeout);
          }
          this.deleteTimeout = setTimeout(() => {
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              console.log('Usage data file deleted');
            }
          }, remainingMs);
        } else {
          // Data is stale, delete it
          fs.unlinkSync(filePath);
        }
      } catch (error) {
        console.error('Error reading existing data file:', error);
      }
    }
  }

  stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }

    if (this.deleteTimeout) {
      clearTimeout(this.deleteTimeout);
      this.deleteTimeout = null;
    }

    // Delete file on stop
    const filePath = this.getDataFilePath();
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}
