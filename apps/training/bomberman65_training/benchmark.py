"""B26 remote throughput benchmark with multi-instance sweep.

Usage:
    python -m bomberman65_training.benchmark
    python -m bomberman65_training.benchmark --instances 1,4,8,16 --steps 500
"""
from __future__ import annotations

import argparse
import asyncio
import json
import platform
import time
from pathlib import Path

from .client import EnvironmentSocketClient
from .protocol import TrainingRunConfig
from .rollout import evaluate_parallel

DEFAULT_SERVER_URL = "ws://localhost:4315"
DEFAULT_MAP_PATH = Path(__file__).resolve().parents[2] / "web" / "public" / "content" / "maps" / "training.json"


def get_machine_info() -> dict:
    import os
    try:
        ram_bytes = os.sysconf("SC_PAGE_SIZE") * os.sysconf("SC_PHYS_PAGES")
        ram_gb = round(ram_bytes / (1024**3), 1)
    except (ValueError, AttributeError):
        try:
            import ctypes
            kernel32 = ctypes.windll.kernel32  # type: ignore[attr-defined]
            mem = ctypes.c_ulonglong(0)
            kernel32.GetPhysicallyInstalledSystemMemory(ctypes.byref(mem))
            ram_gb = round(mem.value / (1024 * 1024), 1)
        except Exception:
            ram_gb = 0
    return {
        "cpu": platform.processor() or platform.machine(),
        "ramGb": ram_gb,
        "os": f"{platform.system()} {platform.release()}",
        "python": platform.python_version(),
    }


async def run_benchmark(
    server_url: str = DEFAULT_SERVER_URL,
    instance_counts: list[int] | None = None,
    steps_per_episode: int = 500,
) -> dict:
    if instance_counts is None:
        instance_counts = [1, 4, 8, 16]

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
        max_steps_per_episode=steps_per_episode,
        checkpoint_interval=steps_per_episode + 1,
    )

    client = EnvironmentSocketClient(server_url)
    await client.connect()

    results: dict[str, object] = {}
    multi_instance: dict[str, object] = {}

    try:
        for n in instance_counts:
            print(f"  Benchmarking {n} instance(s)...", flush=True)
            started_at = time.perf_counter()
            summary = await evaluate_parallel(client, run_config, num_instances=n)
            elapsed = time.perf_counter() - started_at

            total_sps = summary.total_steps / elapsed if elapsed > 0 else 0.0
            per_instance_sps = total_sps / n if n > 0 else 0.0

            entry = {
                "instances": n,
                "elapsedSeconds": round(elapsed, 3),
                "totalSteps": summary.total_steps,
                "stepsPerSecond": round(total_sps, 1),
                "perInstanceStepsPerSecond": round(per_instance_sps, 1),
                "averageReward": round(summary.average_reward, 4),
                "averageSteps": round(summary.average_steps, 1),
            }

            if n == 1:
                results["remoteSingleInstanceStepsPerSecond"] = round(total_sps, 1)
            multi_instance[str(n)] = entry

            print(
                f"    -> {summary.total_steps} steps in {elapsed:.2f}s = "
                f"{total_sps:.0f} steps/s ({per_instance_sps:.0f}/instance)",
                flush=True,
            )
    finally:
        await client.close()

    results["remoteMultiInstance"] = multi_instance
    return {
        "machine": get_machine_info(),
        "serverUrl": server_url,
        "stepsPerEpisode": steps_per_episode,
        "bomberman26": results,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="B26 remote throughput benchmark")
    parser.add_argument("--server", default=DEFAULT_SERVER_URL)
    parser.add_argument("--instances", default="1,4,8,16", help="Comma-separated instance counts")
    parser.add_argument("--steps", type=int, default=500, help="Steps per episode")
    args = parser.parse_args()

    instance_counts = [int(x.strip()) for x in args.instances.split(",")]
    report = asyncio.run(run_benchmark(args.server, instance_counts, args.steps))
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
