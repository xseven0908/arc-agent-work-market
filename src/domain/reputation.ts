import { parseUnits, formatUnits, type Hex } from "viem";
import type { AgentProfile, AgentReputation, WorkJob } from "./types.js";

const SCORE_PER_JOB = 8;
const MAX_JOB_SCORE = 40;
const MAX_QUALITY_SCORE = 50;
const IDENTITY_BONUS = 10;

/**
 * Reputation is proof-backed: a job contributes only when it is completed and
 * carries an Arc Testnet settlement proof. Draft, funded, submitted, expired,
 * and locally asserted jobs never increase the score.
 */
export function calculateReputation(
  agent: AgentProfile,
  jobs: readonly WorkJob[],
): AgentReputation {
  const settled = jobs.filter(
    (job) =>
      job.providerAgentId === agent.id &&
      job.status === "completed" &&
      job.settlement !== undefined &&
      job.settlement.chainId === 5042002 &&
      job.settlement.chainJobId === job.chainJobId,
  );

  const volume = settled.reduce(
    (total, job) => total + parseUnits(job.budgetUsdc, 6),
    0n,
  );
  const scored = settled.filter(
    (job): job is WorkJob & { evaluatorScore: number } =>
      job.evaluatorScore !== undefined,
  );
  const average =
    scored.length === 0
      ? null
      : scored.reduce((total, job) => total + job.evaluatorScore, 0) /
        scored.length;

  const jobScore = Math.min(MAX_JOB_SCORE, settled.length * SCORE_PER_JOB);
  const qualityScore =
    average === null ? 0 : Math.round((average / 100) * MAX_QUALITY_SCORE);
  const identityScore = agent.erc8004AgentId ? IDENTITY_BONUS : 0;

  return {
    agentId: agent.id,
    verifiedSettledJobs: settled.length,
    settledVolumeUsdc: formatUnits(volume, 6),
    averageEvaluatorScore: average,
    score: Math.min(100, jobScore + qualityScore + identityScore),
    evidenceTransactionHashes: settled.map(
      (job) => job.settlement?.transactionHash,
    ).filter((hash): hash is Hex => hash !== undefined),
  };
}
