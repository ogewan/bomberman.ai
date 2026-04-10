# Bomberman 65 Training Sidecar

Python-side training and evaluation client for the Bomberman 65 environment server.

## What It Covers

- Connects to `@bomberman65/env-server` over WebSocket
- Creates and manages multiple remote environment instances
- Runs rollout/evaluation loops against `env-bomberman26`
- Records trajectories, checkpoints, and scalar summaries
- Provides benchmark helpers for throughput comparisons

## Quick Start

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt

# Start the TypeScript environment server in another shell
# Then run a simple rollout benchmark
python -m bomberman65_training.benchmark
```

## Layout

- `bomberman65_training/protocol.py`: Python-facing schema definitions
- `bomberman65_training/client.py`: async multi-instance WebSocket client
- `bomberman65_training/rollout.py`: rollout and parallel evaluation helpers
- `bomberman65_training/benchmark.py`: throughput benchmark entrypoint
- `tests/`: serializer and client-shape tests
