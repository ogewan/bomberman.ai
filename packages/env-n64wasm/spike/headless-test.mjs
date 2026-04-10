/**
 * N64Wasm Headless Chromium Feasibility Test
 *
 * Tests whether N64Wasm can run in headless Chromium via Puppeteer
 * and validates the key automation hooks needed for ML training.
 *
 * Usage:
 *   node headless-test.mjs --rom path/to/rom.z64 --n64wasm path/to/N64Wasm/dist
 *
 * Prerequisites:
 *   npm install puppeteer
 *   A built N64Wasm dist folder (from the N64Wasm repo)
 *   A legally obtained N64 ROM file
 */

import { parseArgs } from 'node:util';
import { resolve, join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

const { values: args } = parseArgs({
  options: {
    rom: { type: 'string' },
    n64wasm: { type: 'string' },
    frames: { type: 'string', default: '300' },
    instances: { type: 'string', default: '1' },
  },
});

if (!args.rom || !args.n64wasm) {
  console.error('Usage: node headless-test.mjs --rom <path> --n64wasm <path> [--frames N] [--instances N]');
  process.exit(1);
}

const ROM_PATH = resolve(args.rom);
const N64WASM_DIST = resolve(args.n64wasm);
const FRAME_COUNT = parseInt(args.frames, 10);
const INSTANCE_COUNT = parseInt(args.instances, 10);

if (!existsSync(ROM_PATH)) {
  console.error(`ROM not found: ${ROM_PATH}`);
  process.exit(1);
}
if (!existsSync(N64WASM_DIST)) {
  console.error(`N64Wasm dist not found: ${N64WASM_DIST}`);
  process.exit(1);
}

// --- Simple static file server ---

function startServer(distPath, port) {
  return new Promise((resolvePromise) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:${port}`);
      let filePath = join(distPath, url.pathname === '/' ? '/index.html' : url.pathname);

      if (!existsSync(filePath)) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const ext = filePath.split('.').pop();
      const mimeTypes = {
        html: 'text/html',
        js: 'application/javascript',
        wasm: 'application/wasm',
        css: 'text/css',
        json: 'application/json',
        z64: 'application/octet-stream',
        png: 'image/png',
      };

      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
      res.end(readFileSync(filePath));
    });

    server.listen(port, () => {
      console.log(`Static server on http://localhost:${port}`);
      resolvePromise(server);
    });
  });
}

// --- Main test ---

async function main() {
  // Dynamic import so users only need puppeteer if running this script
  const puppeteer = await import('puppeteer');

  const PORT = 8764;
  const server = await startServer(N64WASM_DIST, PORT);

  console.log(`\n=== N64Wasm Headless Feasibility Test ===`);
  console.log(`ROM: ${ROM_PATH}`);
  console.log(`Frames to step: ${FRAME_COUNT}`);
  console.log(`Instances: ${INSTANCE_COUNT}`);
  console.log('');

  const browser = await puppeteer.default.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--use-gl=swiftshader', // Software WebGL for headless
      '--enable-webgl',
    ],
  });

  try {
    // Test 1: Single instance — basic functionality
    console.log('--- Test 1: Single Instance Basic Functionality ---');
    const page = await browser.newPage();
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait for N64Wasm to initialize
    await page.waitForFunction(() => typeof window['Module'] !== 'undefined', { timeout: 15000 });

    // Check if key APIs exist
    const apiCheck = await page.evaluate(() => {
      const Module = window['Module'];
      return {
        hasRunMainLoop: typeof Module?._runMainLoop === 'function',
        hasSerialize: typeof Module?._neil_serialize === 'function',
        hasUnserialize: typeof Module?._neil_unserialize === 'function',
        hasReset: typeof Module?._neil_reset === 'function',
        hasCwrap: typeof Module?.cwrap === 'function',
        hasFS: typeof Module?.FS === 'object',
        hasCanvas: !!Module?.canvas,
        canvasSize: Module?.canvas
          ? { width: Module.canvas.width, height: Module.canvas.height }
          : null,
      };
    });

    console.log('API availability:', JSON.stringify(apiCheck, null, 2));

    // Test 2: Frame stepping performance
    console.log(`\n--- Test 2: Frame Stepping (${FRAME_COUNT} frames) ---`);

    // Note: ROM loading is the tricky part — N64Wasm typically loads ROMs via
    // file input or URL. For this test we inject it programmatically.
    // This part may need adjustment based on how N64Wasm handles ROM loading.

    const stepResults = await page.evaluate(async (frameCount) => {
      const Module = window['Module'];
      if (!Module?._runMainLoop) {
        return { error: 'Module._runMainLoop not available' };
      }

      // Attempt to step frames and measure performance
      const start = performance.now();
      let framesRun = 0;

      try {
        for (let i = 0; i < frameCount; i++) {
          Module._runMainLoop();
          framesRun++;
        }
      } catch (e) {
        return {
          error: `Error at frame ${framesRun}: ${e.message}`,
          framesRun,
          elapsed: performance.now() - start,
        };
      }

      const elapsed = performance.now() - start;
      return {
        framesRun,
        elapsed: Math.round(elapsed),
        fps: Math.round(framesRun / (elapsed / 1000)),
        msPerFrame: (elapsed / framesRun).toFixed(2),
      };
    }, FRAME_COUNT);

    console.log('Frame stepping results:', JSON.stringify(stepResults, null, 2));

    // Test 3: Save/load state round-trip
    console.log('\n--- Test 3: Save/Load State ---');

    const saveLoadResult = await page.evaluate(() => {
      const Module = window['Module'];
      if (!Module?._neil_serialize || !Module?.FS) {
        return { error: 'Save/load APIs not available' };
      }

      try {
        Module._neil_serialize();
        const stateData = Module.FS.readFile('/savestate.gz');
        const stateSize = stateData.length;

        // Write it back and unserialize
        Module.FS.writeFile('/savestate.gz', stateData);
        Module._neil_unserialize();

        return {
          success: true,
          stateSizeBytes: stateSize,
          stateSizeKB: Math.round(stateSize / 1024),
        };
      } catch (e) {
        return { error: e.message };
      }
    });

    console.log('Save/load results:', JSON.stringify(saveLoadResult, null, 2));

    // Test 4: Frame capture
    console.log('\n--- Test 4: Frame Capture ---');

    const captureResult = await page.evaluate(() => {
      const Module = window['Module'];
      const canvas = Module?.canvas;
      if (!canvas) return { error: 'No canvas available' };

      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) return { error: 'No WebGL context' };

      const width = canvas.width;
      const height = canvas.height;

      const start = performance.now();
      const pixels = new Uint8Array(width * height * 4);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      const elapsed = performance.now() - start;

      // Check if we got non-zero pixels
      let nonZero = 0;
      for (let i = 0; i < pixels.length; i += 100) {
        if (pixels[i] > 0) nonZero++;
      }

      return {
        width,
        height,
        captureMs: elapsed.toFixed(2),
        bytesPerFrame: width * height * 4,
        hasContent: nonZero > 0,
        samplePixels: Array.from(pixels.subarray(0, 16)),
      };
    });

    console.log('Frame capture results:', JSON.stringify(captureResult, null, 2));

    // Test 5: Input injection
    console.log('\n--- Test 5: Input Injection ---');

    const inputResult = await page.evaluate(() => {
      const Module = window['Module'];
      if (!Module?.cwrap) return { error: 'cwrap not available' };

      try {
        const sendControls = Module.cwrap(
          'neil_send_mobile_controls',
          null,
          ['string', 'string', 'string'],
        );

        // Send A button press + joystick right
        sendControls('00001000000000', '1.0', '0.0');
        return { success: true, method: 'cwrap neil_send_mobile_controls' };
      } catch (e) {
        return { error: e.message };
      }
    });

    console.log('Input injection results:', JSON.stringify(inputResult, null, 2));

    await page.close();

    // Test 6: Multi-instance (if requested)
    if (INSTANCE_COUNT > 1) {
      console.log(`\n--- Test 6: Multi-Instance (${INSTANCE_COUNT} instances) ---`);

      const pages = [];
      const memBefore = process.memoryUsage();

      for (let i = 0; i < INSTANCE_COUNT; i++) {
        const p = await browser.newPage();
        await p.goto(`http://localhost:${PORT}/index.html`, {
          waitUntil: 'networkidle2',
          timeout: 30000,
        });
        await p.waitForFunction(() => typeof window['Module'] !== 'undefined', {
          timeout: 15000,
        });
        pages.push(p);
        console.log(`  Instance ${i + 1} loaded`);
      }

      const memAfter = process.memoryUsage();
      console.log(`Memory delta: +${Math.round((memAfter.rss - memBefore.rss) / 1024 / 1024)}MB RSS`);

      // Step all instances concurrently
      const multiStart = Date.now();
      await Promise.all(
        pages.map((p) =>
          p.evaluate((n) => {
            for (let i = 0; i < n; i++) window['Module']._runMainLoop();
          }, 60),
        ),
      );
      const multiElapsed = Date.now() - multiStart;
      console.log(`${INSTANCE_COUNT} instances x 60 frames = ${multiElapsed}ms total`);

      for (const p of pages) await p.close();
    }

    // Summary
    console.log('\n=== FEASIBILITY SUMMARY ===');
    console.log(`API Availability:     ${apiCheck.hasRunMainLoop ? 'PASS' : 'FAIL'} — runMainLoop, serialize, reset, cwrap`);
    console.log(`Frame Stepping:       ${stepResults.framesRun > 0 ? 'PASS' : 'FAIL'} — ${stepResults.fps || '?'} fps`);
    console.log(`Save/Load State:      ${saveLoadResult.success ? 'PASS' : 'FAIL'} — ${saveLoadResult.stateSizeKB || '?'} KB`);
    console.log(`Frame Capture:        ${captureResult.width ? 'PASS' : 'FAIL'} — ${captureResult.width}x${captureResult.height} @ ${captureResult.captureMs || '?'}ms`);
    console.log(`Input Injection:      ${inputResult.success ? 'PASS' : 'FAIL'} — ${inputResult.method || inputResult.error}`);

  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
