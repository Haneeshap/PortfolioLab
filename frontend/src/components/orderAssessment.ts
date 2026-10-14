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
  input.checks.length === 0 ||
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

export type ValidatedRuleResult = {
  market: string;
  currency: string;
  side: "BUY" | "SELL";
  overallStatus: RuleStatus;
  checks: Array<{
    code: string;
    status: RuleStatus;
    explanation: string;
  }>;
  disclaimer: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isRuleStatus(value: unknown): value is RuleStatus {
  return (
    value === "PASS" ||
    value === "FAIL" ||
    value === "NEEDS_DATA"
  );
}

export function parseRuleResult(value: unknown): ValidatedRuleResult {
  if (!isRecord(value)) {
    throw new Error("Invalid business rules response.");
  }

  const checks = value.checks;

  if (
    typeof value.market !== "string" ||
    !["NSE", "BSE", "NYSE", "NASDAQ"].includes(value.market) ||
    typeof value.currency !== "string" ||
    value.currency.length === 0 ||
    (value.side !== "BUY" && value.side !== "SELL") ||
    !isRuleStatus(value.overallStatus) ||
    !Array.isArray(checks) ||
    checks.length === 0 ||
    typeof value.disclaimer !== "string" ||
    !checks.every(
      (check) =>
        isRecord(check) &&
        typeof check.code === "string" &&
        check.code.length > 0 &&
        isRuleStatus(check.status) &&
        typeof check.explanation === "string"
    )
  ) {
    throw new Error("Incomplete or invalid business rules response.");
  }

  const parsed = value as ValidatedRuleResult;

  // An overall PASS must not conceal an individual failure or missing data.
  if (
    parsed.overallStatus === "PASS" &&
    parsed.checks.some((check) => check.status !== "PASS")
  ) {
    throw new Error("Inconsistent business rules response.");
  }

  return parsed;
}
