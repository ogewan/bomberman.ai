# N64Wasm Feasibility Spike

Proof-of-concept scripts for validating N64Wasm automation capabilities.

## Prerequisites

1. Clone N64Wasm: `git clone https://github.com/nbarkhina/N64Wasm.git`
2. Obtain an N64 ROM file (not included — provide your own legally obtained ROM)
3. Install dependencies: `npm install puppeteer`

## Tests

### 1. Browser Automation Test (`browser-test.html`)
Open in a browser alongside the N64Wasm dist folder. Tests:
- Programmatic input injection
- Frame capture via WebGL readPixels
- Save/load state via Emscripten FS
- Frame stepping via `_runMainLoop()`

### 2. Headless Chromium Test (`headless-test.mjs`)
Runs N64Wasm in headless Chromium via Puppeteer. Tests:
- Headless execution feasibility
- Frame stepping performance measurement
- Multi-instance overhead
- Save/load state round-trip

Usage: `node headless-test.mjs --rom path/to/rom.z64 --n64wasm path/to/N64Wasm/dist`
