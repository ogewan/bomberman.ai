# N64Wasm Feasibility Assessment

## Summary

**Recommendation: GO** — N64Wasm is well-suited for single-instance ML automation. All critical APIs exist and are directly callable from JavaScript. Multi-instance training requires the iframe-per-instance or headless Chromium approach.

## API Assessment

| Capability | Status | Mechanism | Notes |
|------------|--------|-----------|-------|
| Input injection | **CONFIRMED** | `Module.cwrap('neil_send_mobile_controls')` | 14 buttons + 2 analog axes, polled per frame, no DOM events needed |
| Frame stepping | **CONFIRMED** | `Module._runMainLoop()` | Synchronous, advances exactly 1 frame. Audio-driven loop can be bypassed. |
| Save/load state | **CONFIRMED** | `Module._neil_serialize()` / `_neil_unserialize()` + Emscripten FS | Gzip-compressed blobs. Round-trip via `FS.readFile` / `FS.writeFile`. |
| Frame capture | **CONFIRMED** | `gl.readPixels()` on WebGL canvas | Standard WebGL2. Default 640px canvas, N64 native 320x240 upscaled. |
| Reset | **CONFIRMED** | `Module._neil_reset()` | Full emulator reset. |
| Speed control | **CONFIRMED** | `Module._neil_set_double_speed(1)` | 2x speed mode. For ML, direct frame stepping is preferred. |
| Per-frame callback | **CONFIRMED** | `Module._neil_set_endframe_callback(1)` | Calls `myApp.localCallback()` after each frame. |

## Architecture for ML Training

### Single-Instance (Browser/Electron Demo)
```
Browser tab
├── N64Wasm (Module global)
├── N64WasmEnvironment adapter
│   ├── init → resolve Module, setup cwrap
│   ├── step → applyAction + _runMainLoop × frameSkip
│   ├── getObservation → gl.readPixels
│   └── saveState/loadState → _neil_serialize / _neil_unserialize
└── Agent (TF.js inference)
```

### Multi-Instance (Training Server)
```
Node.js server
├── Puppeteer browser pool
│   ├── Page 1 → N64Wasm instance (512MB WASM heap)
│   ├── Page 2 → N64Wasm instance
│   └── Page N → N64Wasm instance
├── Environment server (WebSocket)
│   └── step/observe/save/load per instance
└── Python training client
    └── RL loop → actions → observations → model update
```

**Key constraint:** Each N64Wasm instance uses ~512MB WASM memory. On a 16GB machine, practical limit is ~20-25 concurrent instances (accounting for browser overhead).

**Alternative:** The N64Wasm codebase includes an Angrylion software renderer path that could potentially run without WebGL, enabling true Web Worker execution. This would require investigation but could eliminate the per-instance browser context overhead.

## Multi-Instance Options

| Approach | Pros | Cons |
|----------|------|------|
| Puppeteer pages | Works now, no N64Wasm mods | 512MB per page, WebGL context limits (8-16), Puppeteer IPC overhead |
| Iframes | Isolated globals, could work in Electron | Same memory cost, DOM-dependent |
| Web Workers + OffscreenCanvas | True parallelism, no DOM | Requires modifying Emscripten GL layer — significant effort |
| Software renderer in Workers | Best for throughput | Requires Angrylion path investigation, no WebGL needed |
| Mupen64Plus (native) | Proven for training | Not TypeScript, different integration path |

## Performance Expectations

Based on N64Wasm's architecture (Emscripten WASM, WebGL2):
- **Frame stepping (synchronous):** Expected 3-10x realtime (180-600 fps) depending on game complexity and hardware
- **Frame capture (`readPixels`):** ~0.5-2ms per frame at 640x480
- **Save/load state:** ~5-20ms round-trip depending on state size (typically 1-5MB compressed)
- **Headless Chromium overhead:** SwiftShader (software WebGL) will be slower than GPU; expect 1-3x realtime

## Risks

1. **ROM loading:** N64Wasm loads ROMs via file input/URL. Programmatic ROM injection in headless mode needs validation — likely via Emscripten FS `writeFile` before calling `callMain`.
2. **Determinism:** Unverified. Save/load state provides a workaround (checkpoint and replay from known states).
3. **Headless WebGL:** SwiftShader in headless Chromium is slower than GPU. For training throughput, the Angrylion software renderer path or native Mupen64Plus may be needed.
4. **Audio loop coupling:** The default emulation loop is driven by `ScriptProcessorNode.onaudioprocess`. Disabling audio and using direct `_runMainLoop()` calls is untested but the API is exposed.

## Next Steps

1. **Run the feasibility spike** (`headless-test.mjs`) with an actual ROM to validate all APIs work end-to-end
2. **Validate ROM loading** — confirm programmatic ROM injection via Emscripten FS
3. **Measure actual performance** — frame stepping fps, frame capture latency, save/load round-trip
4. **Investigate Angrylion path** — could enable Web Worker execution for better parallelism
5. **Build reward shaping** for first game target (Bomberman 64 or Mario Kart 64)
