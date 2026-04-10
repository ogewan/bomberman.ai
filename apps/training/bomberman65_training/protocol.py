from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Optional


JsonDict = Dict[str, Any]


@dataclass(slots=True)
class TrainingObservation:
    step: int
    state: Optional[JsonDict] = None
    frame: Optional[JsonDict] = None

    @classmethod
    def from_dict(cls, payload: JsonDict) -> "TrainingObservation":
        return cls(
            step=int(payload["step"]),
            state=payload.get("state"),
            frame=payload.get("frame"),
        )


@dataclass(slots=True)
class TrainingStepResult:
    observation: TrainingObservation
    reward: float
    done: bool
    truncated: bool
    info: JsonDict = field(default_factory=dict)

    @classmethod
    def from_dict(cls, payload: JsonDict) -> "TrainingStepResult":
        return cls(
            observation=TrainingObservation.from_dict(payload["observation"]),
            reward=float(payload["reward"]),
            done=bool(payload["done"]),
            truncated=bool(payload["truncated"]),
            info=dict(payload.get("info", {})),
        )


@dataclass(slots=True)
class TrainingEpisodeSummary:
    episode_index: int
    total_steps: int
    total_reward: float
    terminated: bool
    truncated: bool
    checkpoint_count: int

    def to_dict(self) -> JsonDict:
        return asdict(self)


@dataclass(slots=True)
class TrainingRunConfig:
    env_type: str
    env_config: JsonDict
    episodes: int
    max_steps_per_episode: int
    checkpoint_interval: int = 100
    seed: Optional[int] = None

    def to_environment_config(self) -> JsonDict:
        payload: JsonDict = {
            "envType": self.env_type,
            "envConfig": self.env_config,
            "maxSteps": self.max_steps_per_episode,
        }
        if self.seed is not None:
            payload["seed"] = self.seed
        return payload

    def to_dict(self) -> JsonDict:
        return asdict(self)


@dataclass(slots=True)
class TrajectoryRecord:
    step: int
    action: Any
    reward: float
    done: bool
    truncated: bool
    info: JsonDict

    def to_dict(self) -> JsonDict:
        return asdict(self)


def serialize_payload(value: Any) -> Any:
    if hasattr(value, "to_dict"):
        return value.to_dict()
    if isinstance(value, list):
        return [serialize_payload(entry) for entry in value]
    if isinstance(value, dict):
        return {key: serialize_payload(entry) for key, entry in value.items()}
    return value
