import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'

dotenv.config()

// Vite plugin to intercept MediaPipe WASM/data requests from ANY path
// and serve the correct files from public/mediapipe/.
// This is needed because Emscripten's dynamically-evaluated SIMD code
// resolves .wasm paths relative to the Worker's URL, not /mediapipe/.
function mediapipeWasmPlugin() {
  const MEDIAPIPE_FILES = new Set([
    'holistic_solution_simd_wasm_bin.wasm',
    'holistic_solution_simd_wasm_bin.data',
    'holistic_solution_simd_wasm_bin.js',
    'holistic_solution_wasm_bin.wasm',
    'holistic_solution_wasm_bin.js',
    'holistic_solution_packed_assets.data',
    'holistic_solution_packed_assets_loader.js',
    'holistic.binarypb',
    'pose_landmark_full.tflite',
    'pose_landmark_heavy.tflite',
    'pose_landmark_lite.tflite',
  ]);

  return {
    name: 'mediapipe-wasm-redirect',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const filename = req.url?.split('/').pop()?.split('?')[0];
        if (filename && MEDIAPIPE_FILES.has(filename)) {
          const filePath = path.resolve('public', 'mediapipe', filename);
          if (fs.existsSync(filePath)) {
            // Set correct MIME types
            let contentType = 'application/octet-stream';
            if (filename.endsWith('.wasm')) contentType = 'application/wasm';
            else if (filename.endsWith('.js')) contentType = 'application/javascript';
            else if (filename.endsWith('.data')) contentType = 'application/octet-stream';
            else if (filename.endsWith('.tflite')) contentType = 'application/octet-stream';

            res.setHeader('Content-Type', contentType);
            res.setHeader('Access-Control-Allow-Origin', '*');
            fs.createReadStream(filePath).pipe(res);
            return; // Don't call next()
          }
        }
        next();
      });
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [mediapipeWasmPlugin(), react(), tailwindcss()],
  assetsInclude: ['**/*.glb', '**/*.gltf', '**/*.fbx', '**/*.obj', '**/*.onnx', '**/*.wasm'],
  build: {
    rollupOptions: {
      external: [],
    },
  },
  optimizeDeps: {
    exclude: ['three']
  },
  define: {
    global: 'globalThis',
  },
  server: {
    allowedHosts: ['localhost', '127.0.0.1', "linzo-meet.vercel.app", "linzo-meet-backend.onrender.com"],
    headers: {
      // Relaxed COOP/COEP to allow CDN resources (like ONNX WASM files) to load
      // 'Cross-Origin-Embedder-Policy': 'require-corp',  // Commented out to allow CDN WASM loading
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
    fs: {
      // Allow serving files from the public directory
      strict: false
    },
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  publicDir: 'public'
})
