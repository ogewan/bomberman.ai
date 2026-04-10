import unittest

from bomberman65_training.protocol import (
    TrainingEpisodeSummary,
    TrainingObservation,
    TrainingRunConfig,
    TrainingStepResult,
)


class ProtocolTests(unittest.TestCase):
    def test_observation_round_trip(self) -> None:
        payload = {
            "step": 12,
            "state": {"tick": 12},
            "frame": None,
        }
        observation = TrainingObservation.from_dict(payload)
        self.assertEqual(observation.step, 12)
        self.assertEqual(observation.state, {"tick": 12})

    def test_step_result_round_trip(self) -> None:
        payload = {
            "observation": {"step": 4, "state": {"x": 1}},
            "reward": 1.25,
            "done": False,
            "truncated": False,
            "info": {"aliveActors": 2},
        }
        result = TrainingStepResult.from_dict(payload)
        self.assertEqual(result.reward, 1.25)
        self.assertFalse(result.done)
        self.assertEqual(result.info["aliveActors"], 2)

    def test_run_config_environment_payload(self) -> None:
        config = TrainingRunConfig(
            env_type="bomberman26",
            env_config={"map": {"id": "training"}},
            episodes=2,
            max_steps_per_episode=50,
            seed=123,
        )
        payload = config.to_environment_config()
        self.assertEqual(payload["envType"], "bomberman26")
        self.assertEqual(payload["maxSteps"], 50)
        self.assertEqual(payload["seed"], 123)

    def test_episode_summary_serializes(self) -> None:
        summary = TrainingEpisodeSummary(
            episode_index=0,
            total_steps=25,
            total_reward=3.5,
            terminated=True,
            truncated=False,
            checkpoint_count=2,
        )
        self.assertEqual(summary.to_dict()["total_reward"], 3.5)


if __name__ == "__main__":
    unittest.main()
