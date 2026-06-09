import { badRequest } from "./errors";

export const ORG_LIMITS = {
  maxProjects: 10,
  maxMembersPerOrg: 20,
  maxPipelineRunsPerMonth: 50,
} as const;

/**
 * Throws a `badRequest` AppError if `current >= max`.
 */
export function checkLimit(current: number, max: number, label: string): void {
  if (current >= max) {
    throw badRequest(
      `Limit reached: ${label} (${current}/${max}). Upgrade your plan to add more.`,
    );
  }
}
