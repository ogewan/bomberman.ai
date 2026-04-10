from __future__ import annotations

import asyncio
import json
import time
from pathlib import Path

from .client import EnvironmentSocketClient
from .protocol import TrainingRunConfig
from .rollout import evaluate_parallel


DEFAULT_SERVER_URL = "ws://localhost:4315"
DEFAULT_MAP_PATH = Path(__file__).resolve().parents[2] / "web" / "public" / "content" / "maps" / "training.json"


async def run_benchmark(server_url: str = DEFAULT_SERVER_URL) -> dict:
    map_payload = json.loads(DEFAULT_MAP_PATH.read_text(encoding="utf-8"))
    spawn_assignments = [
        {
            "spawnId": spawn["id"],
            "actorId": f"actor_{spawn['id']}",
            "controller": "bot",
        }
        for spawn in map_payload["spawns"]
    ]

    run_config = TrainingRunConfig(
        env_type="bomberman26",
        env_config={
            "map": map_payload,
            "spawnAssignments": spawn_assignments,
            "agentActorId": f"actor_{map_payload['spawns'][0]['id']}",
        },
        episodes=1,
        max_steps_per_episode=250,
        checkpoint_interval=50,
    )

    client = EnvironmentSocketClient(server_url)
    await client.connect()
    try:
        started_at = time.perf_counter()
        summary = await evaluate_parallel(client, run_config, num_instances=4)
        elapsed = time.perf_counter() - started_at
        return {
            "serverUrl": server_url,
            "numInstances": 4,
            "elapsedSeconds": elapsed,
            "episodes": summary.total_episodes,
            "totalSteps": summary.total_steps,
            "stepsPerSecond": summary.total_steps / elapsed if elapsed > 0 else 0.0,
            "averageReward": summary.average_reward,
            "averageSteps": summary.average_steps,
        }
    finally:
        await client.close()


if __name__ == "__main__":
    print(json.dumps(asyncio.run(run_benchmark()), indent=2))
