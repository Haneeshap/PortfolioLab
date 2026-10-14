export type RuleStatus = "PASS" | "FAIL" | "NEEDS_DATA";

export type AssessmentStatus =
  | "NOT_READY"
  | "REVIEW_REQUIRED"
  | "READY_FOR_SUBMISSION"
  | "OUTDATED";

export type AssessmentInput = {
  ruleStatus: RuleStatus;
  checks: Array<{ status: RuleStatus }>;
  side: "BUY" | "SELL";
  sufficientCash: boolean | null;
  stale: boolean;
};

export type OrderAssessment = {
  status: AssessmentStatus;
  reason: string;
};

export function assessOrder(input: AssessmentInput): OrderAssessment {
  if (input.stale) {
    return {
      status: "OUTDATED",
      reason: "Order details or market information changed. Validate again.",
    };
  }

  const hasFailure =
    input.ruleStatus === "FAIL" ||
    input.checks.some((check) => check.status === "FAIL") ||
    (input.side === "BUY" && input.sufficientCash === false);

  if (hasFailure) {
    return {
      status: "NOT_READY",
      reason:
        "One or more order checks failed. Review the results before proceeding.",
    };
  }

  const needsData =
    input.ruleStatus === "NEEDS_DATA" ||
    input.checks.some((check) => check.status === "NEEDS_DATA") ||
    (input.side === "BUY" && input.sufficientCash === null);

  if (needsData) {
    return {
      status: "REVIEW_REQUIRED",
      reason:
        "No confirmed failure, but some checks need additional information.",
    };
  }

  return {
    status: "READY_FOR_SUBMISSION",
    reason:
      "Available informational checks passed. Execution is not guaranteed.",
  };
}