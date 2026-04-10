from __future__ import annotations

import asyncio
import random
from dataclasses import dataclass
from typing import Any, Awaitable, Callable, List

from .client import EnvironmentSocketClient, RemoteInstanceHandle
from .protocol import (
    TrainingEpisodeSummary,
    TrainingRunConfig,
    TrajectoryRecord,
)


PolicyFn = Callable[[dict[str, Any]], Awaitable[Any]]


async def random_discrete_policy(action_space: dict[str, Any]) -> int:
    if action_space.get("kind") != "discrete":
        raise ValueError(f"random_discrete_policy only supports discrete spaces, got {action_space!r}")
    return random.randrange(int(action_space["n"]))


async def run_episode(
    instance: RemoteInstanceHandle,
    run_config: TrainingRunConfig,
    policy: PolicyFn,
) -> tuple[TrainingEpisodeSummary, List[TrajectoryRecord]]:
    await instance.init(run_config.to_environment_config())
    action_space = await instance.get_action_space()
    observation = await instance.reset()

    checkpoint_count = 0
    total_reward = 0.0
    trajectory: List[TrajectoryRecord] = []

    for step_index in range(run_config.max_steps_per_episode):
        action = await policy(action_space)
        result = await instance.step(action)
        total_reward += result.reward
        observation = result.observation
        trajectory.append(
            TrajectoryRecord(
                step=observation.step,
                action=action,
                reward=result.reward,
                done=result.done,
                truncated=result.truncated,
                info=result.info,
            )
        )

        if step_index > 0 and step_index % run_config.checkpoint_interval == 0:
            await instance.save_state()
            checkpoint_count += 1

        if result.done:
            return (
                TrainingEpisodeSummary(
                    episode_index=0,
                    total_steps=step_index + 1,
                    total_reward=total_reward,
                    terminated=not result.truncated,
                    truncated=result.truncated,
                    checkpoint_count=checkpoint_count,
                ),
                trajectory,
            )

    return (
        TrainingEpisodeSummary(
            episode_index=0,
            total_steps=run_config.max_steps_per_episode,
            total_reward=total_reward,
            terminated=False,
            truncated=True,
            checkpoint_count=checkpoint_count,
        ),
        trajectory,
    )


@dataclass(slots=True)
class ParallelEvaluationSummary:
    total_episodes: int
    total_steps: int
    total_reward: float
    average_reward: float
    average_steps: float


async def evaluate_parallel(
    client: EnvironmentSocketClient,
    run_config: TrainingRunConfig,
    num_instances: int,
    policy: PolicyFn = random_discrete_policy,
) -> ParallelEvaluationSummary:
    instances = [await client.create_instance() for _ in range(num_instances)]
    try:
        tasks = [
            run_episode(instance, run_config, policy)
            for instance in instances
        ]
        results = await asyncio.gather(*tasks)
    finally:
        for instance in instances:
            await instance.destroy()

    summaries = [summary for summary, _trajectory in results]
    total_episodes = len(summaries)
    total_steps = sum(summary.total_steps for summary in summaries)
    total_reward = sum(summary.total_reward for summary in summaries)
    return ParallelEvaluationSummary(
        total_episodes=total_episodes,
        total_steps=total_steps,
        total_reward=total_reward,
        average_reward=total_reward / total_episodes if total_episodes else 0.0,
        average_steps=total_steps / total_episodes if total_episodes else 0.0,
    )
