import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [tailwindcss()],
  server: {
    proxy: {
      '/api/nvidia': {
        target: 'https://integrate.api.nvidia.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/nvidia/, '/v1'),
        secure: process.env.NODE_ENV === 'production',
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // Validasi: hanya izinkan POST ke /chat/completions
            if (req.method !== 'POST' || !req.url.includes('/chat/completions')) {
              res.statusCode = 403;
              res.end('Forbidden');
              return;
            }
            
            // Batasi body size (10MB)
            const contentLength = parseInt(req.headers['content-length'] || '0');
            if (contentLength > 10 * 1024 * 1024) {
              res.statusCode = 413;
              res.end('Payload too large');
              return;
            }
          });
          
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('🟡 Proxy Response:', proxyRes.statusCode);
          });
          
          proxy.on('error', (err, req, res) => {
            console.log('🔴 Proxy Error:', err.message);
          });
        },
      },
    },
  },
})