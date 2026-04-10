# Phase D Benchmarking

This folder captures the throughput and runtime measurements that drive the Phase D training-runtime decision.

## Expected Inputs

- `env-bomberman26` local throughput
- `env-bomberman26` remote throughput via `@bomberman65/env-server`
- `env-n64wasm` single-instance timings
- constrained `env-n64wasm` multi-instance sweep
- qualitative Mupen64Plus integration assessment

## Report Format

Start from [phase-d-report-template.json](/c:/wamp64/www/__active/bomberman26/docs/benchmarks/phase-d-report-template.json) and commit dated reports next to it.

## Current Recommendation Gate

Do not finalize the emulator-training runtime choice until the report includes:

- measured remote B26 throughput at 4/8/16 instances
- measured N64Wasm startup/reset/step/frame/save-state timings
- a written recommendation selecting either N64Wasm or Mupen64Plus for training
