"""Minimal REINFORCE (vanilla policy gradient) training on Bomberman 26.

Uses a linear policy (W @ features + b -> softmax -> action) with pure NumPy.
Connects to the env-server via WebSocket, runs episodes, and updates weights
using the REINFORCE gradient estimator.

Usage:
    python -m bomberman65_training.train --episodes 50 --server ws://localhost:4315
"""
from __future__ import annotations

import argparse
import asyncio
import json
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, List

import numpy as np

from .client import EnvironmentSocketClient
from .protocol import TrainingRunConfig

DEFAULT_SERVER_URL = "ws://localhost:4315"
DEFAULT_MAP_PATH = (
    Path(__file__).resolve().parents[2] / "web" / "public" / "content" / "maps" / "training.json"
)

NUM_FEATURES = 16
NUM_ACTIONS = 13

FEATURE_KEYS = [
    "self.x", "self.y", "self.z",
    "self.count", "self.power",
    "self.upgradeKick", "self.upgradeCarryPump", "self.upgradeShield",
    "self.stunTicksRemaining", "self.shieldTicksRemaining",
    "nearestOpponentDistance", "liveOpponentCount",
    "hasAdjacentBomb", "isHoldingBomb",
]


def extract_features(observation: dict[str, Any]) -> np.ndarray:
    """Extract a fixed-length feature vector from the B26 observation."""
    features = np.zeros(NUM_FEATURES, dtype=np.float64)
    agent = observation.get("state", {}).get("agentFeatures", {})
    self_info = agent.get("self", {})

    vals = [
        self_info.get("x", 0),
        self_info.get("y", 0),
        self_info.get("z", 0),
        self_info.get("count", 0),
        self_info.get("power", 0),
        self_info.get("upgradeKick", 0),
        self_info.get("upgradeCarryPump", 0),
        self_info.get("upgradeShield", 0),
        self_info.get("stunTicksRemaining", 0),
        self_info.get("shieldTicksRemaining", 0),
        agent.get("nearestOpponentDistance", -1),
        agent.get("liveOpponentCount", 0),
        agent.get("hasAdjacentBomb", 0),
        agent.get("isHoldingBomb", 0),
    ]
    for i, v in enumerate(vals):
        features[i] = float(v)
    return features


def softmax(logits: np.ndarray) -> np.ndarray:
    shifted = logits - np.max(logits)
    exps = np.exp(shifted)
    return exps / np.sum(exps)


@dataclass
class LinearPolicy:
    W: np.ndarray = field(default_factory=lambda: np.zeros((NUM_ACTIONS, NUM_FEATURES)))
    b: np.ndarray = field(default_factory=lambda: np.zeros(NUM_ACTIONS))

    def action_probs(self, features: np.ndarray) -> np.ndarray:
        logits = self.W @ features + self.b
        return softmax(logits)

    def select_action(self, features: np.ndarray) -> tuple[int, np.ndarray]:
        probs = self.action_probs(features)
        action = int(np.random.choice(NUM_ACTIONS, p=probs))
        return action, probs

    def save(self, path: str) -> None:
        data = {"W": self.W.tolist(), "b": self.b.tolist()}
        Path(path).write_text(json.dumps(data, indent=2))

    @classmethod
    def load(cls, path: str) -> "LinearPolicy":
        data = json.loads(Path(path).read_text())
        return cls(W=np.array(data["W"]), b=np.array(data["b"]))


@dataclass
class TrajectoryStep:
    features: np.ndarray
    action: int
    probs: np.ndarray
    reward: float


def compute_returns(rewards: List[float], gamma: float = 0.99) -> np.ndarray:
    returns = np.zeros(len(rewards))
    running = 0.0
    for t in reversed(range(len(rewards))):
        running = rewards[t] + gamma * running
        returns[t] = running
    return returns


def reinforce_update(
    policy: LinearPolicy,
    trajectory: List[TrajectoryStep],
    lr: float = 0.01,
    gamma: float = 0.99,
) -> None:
    """Update policy weights using REINFORCE gradient."""
    rewards = [s.reward for s in trajectory]
    returns = compute_returns(rewards, gamma)

    # Normalize returns for stability
    if len(returns) > 1:
        std = np.std(returns)
        if std > 1e-8:
            returns = (returns - np.mean(returns)) / std

    grad_W = np.zeros_like(policy.W)
    grad_b = np.zeros_like(policy.b)

    for t, step in enumerate(trajectory):
        # Gradient of log pi(a|s) for softmax: e_a - probs
        grad_log = -step.probs.copy()
        grad_log[step.action] += 1.0

        grad_W += returns[t] * np.outer(grad_log, step.features)
        grad_b += returns[t] * grad_log

    policy.W += lr * grad_W
    policy.b += lr * grad_b


async def train(
    server_url: str,
    map_path: Path,
    num_episodes: int = 50,
    max_steps: int = 500,
    lr: float = 0.01,
    gamma: float = 0.99,
    output_path: str | None = None,
) -> LinearPolicy:
    map_payload = json.loads(map_path.read_text(encoding="utf-8"))
    spawn_assignments = [
        {"spawnId": s["id"], "actorId": f"actor_{s['id']}", "controller": "bot"}
        for s in map_payload["spawns"]
    ]
    run_config = TrainingRunConfig(
        env_type="bomberman26",
        env_config={
            "map": map_payload,
            "spawnAssignments": spawn_assignments,
            "agentActorId": f"actor_{map_payload['spawns'][0]['id']}",
        },
        episodes=1,
        max_steps_per_episode=max_steps,
        checkpoint_interval=max_steps + 1,
    )

    policy = LinearPolicy()
    client = EnvironmentSocketClient(server_url)
    await client.connect()

    try:
        instance = await client.create_instance()
        rewards_history: List[float] = []
        start_time = time.perf_counter()

        for ep in range(num_episodes):
            await instance.init(run_config.to_environment_config())
            action_space = await instance.get_action_space()
            obs = await instance.reset()

            trajectory: List[TrajectoryStep] = []
            ep_reward = 0.0

            for step_idx in range(max_steps):
                obs_dict = obs if isinstance(obs, dict) else {"step": obs.step, "state": obs.state}
                features = extract_features(obs_dict)
                action, probs = policy.select_action(features)

                result = await instance.step(action)
                trajectory.append(TrajectoryStep(features, action, probs, result.reward))
                ep_reward += result.reward

                obs = result.observation
                if result.done:
                    break

            reinforce_update(policy, trajectory, lr=lr, gamma=gamma)
            rewards_history.append(ep_reward)

            avg_10 = np.mean(rewards_history[-10:]) if rewards_history else 0.0
            elapsed = time.perf_counter() - start_time
            print(
                f"Episode {ep + 1:4d}/{num_episodes} | "
                f"reward={ep_reward:7.3f} | "
                f"steps={len(trajectory):4d} | "
                f"avg10={avg_10:7.3f} | "
                f"elapsed={elapsed:.1f}s"
            )

        await instance.destroy()
    finally:
        await client.close()

    if output_path:
        policy.save(output_path)
        print(f"Weights saved to {output_path}")

    return policy


def main() -> None:
    parser = argparse.ArgumentParser(description="REINFORCE training on Bomberman 26")
    parser.add_argument("--episodes", type=int, default=50)
    parser.add_argument("--max-steps", type=int, default=500)
    parser.add_argument("--lr", type=float, default=0.01)
    parser.add_argument("--gamma", type=float, default=0.99)
    parser.add_argument("--server", default=DEFAULT_SERVER_URL)
    parser.add_argument("--map", default=str(DEFAULT_MAP_PATH))
    parser.add_argument("--output", default=None, help="Path to save weights JSON")
    args = parser.parse_args()

    asyncio.run(train(
        server_url=args.server,
        map_path=Path(args.map),
        num_episodes=args.episodes,
        max_steps=args.max_steps,
        lr=args.lr,
        gamma=args.gamma,
        output_path=args.output,
    ))


if __name__ == "__main__":
    main()
