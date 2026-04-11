"""Unit tests for the REINFORCE training policy (no server required)."""
import unittest

import numpy as np

from bomberman65_training.train import (
    LinearPolicy,
    TrajectoryStep,
    compute_returns,
    extract_features,
    reinforce_update,
    softmax,
)


class TestSoftmax(unittest.TestCase):
    def test_sums_to_one(self):
        probs = softmax(np.array([1.0, 2.0, 3.0]))
        self.assertAlmostEqual(float(np.sum(probs)), 1.0, places=6)

    def test_all_equal_gives_uniform(self):
        probs = softmax(np.zeros(5))
        np.testing.assert_allclose(probs, 0.2, atol=1e-6)

    def test_handles_large_values(self):
        probs = softmax(np.array([1000.0, 1000.0, 0.0]))
        self.assertAlmostEqual(float(np.sum(probs)), 1.0, places=6)


class TestExtractFeatures(unittest.TestCase):
    def test_extracts_from_agent_features(self):
        obs = {
            "state": {
                "agentFeatures": {
                    "self": {"x": 3, "y": 4, "z": 0, "count": 1, "power": 2,
                             "upgradeKick": 1, "upgradeCarryPump": 0, "upgradeShield": 0,
                             "stunTicksRemaining": 0, "shieldTicksRemaining": 0},
                    "nearestOpponentDistance": 5,
                    "liveOpponentCount": 2,
                    "hasAdjacentBomb": 0,
                    "isHoldingBomb": 0,
                }
            }
        }
        features = extract_features(obs)
        self.assertEqual(len(features), 16)
        self.assertAlmostEqual(features[0], 3.0)
        self.assertAlmostEqual(features[1], 4.0)
        self.assertAlmostEqual(features[3], 1.0)  # count
        self.assertAlmostEqual(features[10], 5.0)  # nearest opponent

    def test_missing_fields_default_to_zero(self):
        features = extract_features({"state": {}})
        self.assertEqual(len(features), 16)
        expected = np.zeros(16)
        expected[10] = -1.0  # nearestOpponentDistance defaults to -1
        np.testing.assert_array_equal(features, expected)


class TestLinearPolicy(unittest.TestCase):
    def test_action_probs_sum_to_one(self):
        policy = LinearPolicy()
        features = np.random.randn(16)
        probs = policy.action_probs(features)
        self.assertAlmostEqual(float(np.sum(probs)), 1.0, places=6)
        self.assertEqual(len(probs), 13)

    def test_select_action_in_range(self):
        policy = LinearPolicy()
        features = np.random.randn(16)
        action, probs = policy.select_action(features)
        self.assertGreaterEqual(action, 0)
        self.assertLess(action, 13)
        self.assertAlmostEqual(float(np.sum(probs)), 1.0, places=6)


class TestComputeReturns(unittest.TestCase):
    def test_single_reward(self):
        returns = compute_returns([1.0], gamma=0.99)
        np.testing.assert_allclose(returns, [1.0])

    def test_discounting(self):
        returns = compute_returns([0.0, 0.0, 1.0], gamma=0.5)
        # G_2 = 1.0, G_1 = 0 + 0.5*1.0 = 0.5, G_0 = 0 + 0.5*0.5 = 0.25
        np.testing.assert_allclose(returns, [0.25, 0.5, 1.0])


class TestReinforceUpdate(unittest.TestCase):
    def test_weights_change_after_update(self):
        policy = LinearPolicy()
        W_before = policy.W.copy()
        b_before = policy.b.copy()

        features = np.random.randn(16)
        probs = policy.action_probs(features)
        trajectory = [
            TrajectoryStep(features=features, action=3, probs=probs, reward=1.0),
            TrajectoryStep(features=features, action=5, probs=probs, reward=0.5),
        ]
        reinforce_update(policy, trajectory, lr=0.1, gamma=0.99)

        self.assertFalse(np.allclose(policy.W, W_before))
        self.assertFalse(np.allclose(policy.b, b_before))


if __name__ == "__main__":
    unittest.main()
