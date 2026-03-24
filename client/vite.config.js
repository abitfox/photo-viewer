import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function terminalLogger() {
  return {
    name: 'terminal-logger',
    apply: 'serve',
    transformIndexHtml(html) {
      return {
        html,
        tags: [{
          tag: 'script',
          inject: 'head',
          children: `
            (function() {
              const originalLog = console.log;
              const originalError = console.error;
              const originalWarn = console.warn;
              const originalInfo = console.info;

              function sendToTerminal(type, args) {
                const message = Array.from(args).map(arg => {
                  if (typeof arg === 'object') {
                    try { return JSON.stringify(arg); } catch { return String(arg); }
                  }
                  return String(arg);
                }).join(' ');
                window.postMessage({ type: 'console', method: type, message }, '*');
              }

              console.log = (...args) => { sendToTerminal('log', args); originalLog.apply(console, args); };
              console.error = (...args) => { sendToTerminal('error', args); originalError.apply(console, args); };
              console.warn = (...args) => { sendToTerminal('warn', args); originalWarn.apply(console, args); };
              console.info = (...args) => { sendToTerminal('info', args); originalInfo.apply(console, args); };
            })();
          `,
        }],
      };
    },
    configureServer(server) {
      server.ws.on('connection', (socket) => {
        socket.on('message', (data) => {
          try {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'console') {
              const prefix = { log: '[HMR]', error: '[ERROR]', warn: '[WARN]', info: '[INFO]' }[msg.method] || '[LOG]';
              const color = { log: '\x1b[36m', error: '\x1b[31m', warn: '\x1b[33m', info: '\x1b[32m' }[msg.method] || '\x1b[37m';
              console.log(`${color}${prefix}\x1b[0m ${msg.message}`);
            }
          } catch {}
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), terminalLogger()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3456',
        changeOrigin: true,
      },
    },
  },
})
