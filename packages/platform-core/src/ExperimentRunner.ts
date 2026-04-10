/**
 * ExperimentRunner — orchestrates the agent-environment interaction loop.
 *
 * Connects an Agent to a GameEnvironment via an ExperimentSession,
 * running the observe → decide → act → record loop. Supports
 * multi-episode runs, step delays for visualization, and callbacks
 * for UI/metrics integration.
 *
 * This is the main entry point for running experiments on the platform.
 */

import type {
  GameEnvironment,
} from './types/environment.js';
import type { Agent, AgentRuntimeCallbacks, AgentRuntimeConfig } from './AgentRuntime.js';
import {
  ExperimentSession,
  type SessionConfig,
  type StepRecord,
} from './ExperimentSession.js';

export type ExperimentRunnerConfig = AgentRuntimeConfig & {
  /** Checkpoint interval in steps. Default: 300. */
  readonly checkpointInterval?: number;
};

export class ExperimentRunner {
  private env: GameEnvironment;
  private agent: Agent;
  private config: ExperimentRunnerConfig;
  private callbacks: AgentRuntimeCallbacks;
  private session: ExperimentSession | null = null;
  private running = false;
  private aborted = false;

  constructor(
    env: GameEnvironment,
    agent: Agent,
    config: ExperimentRunnerConfig = {},
    callbacks: AgentRuntimeCallbacks = {},
  ) {
    this.env = env;
    this.agent = agent;
    this.config = config;
    this.callbacks = callbacks;
  }

  /** Get the current experiment session. */
  getSession(): ExperimentSession | null {
    return this.session;
  }

  /** Whether the runner is currently executing. */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Run the experiment.
   * Returns the completed session when done.
   */
  async run(): Promise<ExperimentSession> {
    if (this.running) throw new Error('ExperimentRunner is already running');
    this.running = true;
    this.aborted = false;

    // Create session
    const sessionConfig: SessionConfig = {
      envConfig: { envType: this.env.getInfo().envType, envConfig: {} },
      envInfo: this.env.getInfo(),
      agentInfo: this.agent.info,
      maxStepsPerEpisode: this.config.maxStepsPerEpisode,
      checkpointInterval: this.config.checkpointInterval ?? 300,
    };
    this.session = new ExperimentSession(sessionConfig);

    // Initialize agent
    await this.agent.init(this.env.getActionSpace());

    const maxEpisodes = this.config.episodes ?? 1;
    let globalStep = 0;

    try {
      this.session.start();

      for (let episode = 0; episode < maxEpisodes || maxEpisodes === 0; episode++) {
        if (this.aborted) break;

        this.callbacks.onEpisodeStart?.(episode);

        // Reset environment
        let observation = await this.env.reset();
        let episodeReward = 0;
        let episodeSteps = 0;

        while (!this.aborted) {
          // Agent selects action
          const action = await this.agent.selectAction(observation, globalStep);

          // Environment steps
          const result = await this.env.step(action);

          // Record step
          const record: StepRecord = {
            step: globalStep,
            action,
            reward: result.reward,
            done: result.done,
            truncated: result.truncated,
            timestamp: Date.now(),
          };
          this.session.recordStep(record);

          // Checkpoint if needed
          if (this.session.shouldCheckpoint(globalStep)) {
            const snapshot = await this.env.saveState();
            this.session.recordCheckpoint({
              step: globalStep,
              snapshot,
              timestamp: Date.now(),
            });
          }

          // Notify agent and callbacks
          this.agent.onStepResult?.(result.reward, result.done, result.info);
          this.callbacks.onStep?.(globalStep, result.observation, result.reward, result.done);

          episodeReward += result.reward;
          episodeSteps++;
          globalStep++;
          observation = result.observation;

          // Step delay for visualization
          if (this.config.stepDelayMs && this.config.stepDelayMs > 0) {
            await this.delay(this.config.stepDelayMs);
          }

          // Episode end
          if (result.done) {
            this.agent.onEpisodeEnd?.();
            this.session.recordEpisodeEnd(globalStep);
            this.session.recordMetric('episode_reward', episodeReward);
            this.session.recordMetric('episode_length', episodeSteps);
            this.callbacks.onEpisodeEnd?.(episode, episodeSteps, episodeReward);
            break;
          }
        }

        // Auto-reset check
        if (this.config.autoReset === false) break;
      }

      if (this.aborted) {
        this.session.abort();
      } else {
        this.session.complete();
        this.callbacks.onRunComplete?.(this.session.getEpisodes().length);
      }
    } catch (error) {
      this.session.abort();
      this.callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
      throw error;
    } finally {
      this.running = false;
    }

    return this.session;
  }

  /** Stop the experiment after the current step completes. */
  stop(): void {
    this.aborted = true;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      // Use globalThis.setTimeout for cross-environment compatibility
      (globalThis as unknown as { setTimeout: (fn: () => void, ms: number) => void }).setTimeout(resolve, ms);
    });
  }
}
