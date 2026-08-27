export interface CreditScoreInputs {
  profileComplete: boolean;
  hasVerifiedFarm: boolean;
  totalCreditIssued: number;
  totalCreditRepaid: number;
  harvestRecordCount: number;
  cropCount: number;
}

export interface CreditScoreResult {
  score: number;
  grade: "A" | "B" | "C" | "D";
  gradeLabel: string;
  gradeColor: string;
  breakdown: { label: string; points: number; max: number }[];
}

// Simple rule-based credit score (0-100) - not a machine-learning model,
// just a transparent weighted combination of behavior signals that are
// meaningful for lending trust: profile completeness, land verification,
// credit repayment history, and productive platform activity.
export function computeFarmerCreditScore(inputs: CreditScoreInputs): CreditScoreResult {
  const profilePoints = inputs.profileComplete ? 20 : 0;
  const farmPoints = inputs.hasVerifiedFarm ? 15 : 0;

  let repaymentPoints = 30;
  if (inputs.totalCreditIssued > 0) {
    const repaymentRatio = Math.min(1, inputs.totalCreditRepaid / inputs.totalCreditIssued);
    repaymentPoints = Math.round(repaymentRatio * 30);
  }

  const harvestPoints = Math.min(20, inputs.harvestRecordCount * 5);
  const activityPoints = Math.min(15, inputs.cropCount * 3);

  const score = profilePoints + farmPoints + repaymentPoints + harvestPoints + activityPoints;

  let grade: "A" | "B" | "C" | "D";
  let gradeLabel: string;
  let gradeColor: string;
  if (score >= 80) {
    grade = "A";
    gradeLabel = "Bohat Acha";
    gradeColor = "green";
  } else if (score >= 60) {
    grade = "B";
    gradeLabel = "Acha";
    gradeColor = "blue";
  } else if (score >= 40) {
    grade = "C";
    gradeLabel = "Theek Thak";
    gradeColor = "amber";
  } else {
    grade = "D";
    gradeLabel = "Behtar Karna Hai";
    gradeColor = "red";
  }

  return {
    score,
    grade,
    gradeLabel,
    gradeColor,
    breakdown: [
      { label: "Profile Complete", points: profilePoints, max: 20 },
      { label: "Verified Farm", points: farmPoints, max: 15 },
      { label: "Credit Repayment", points: repaymentPoints, max: 30 },
      { label: "Harvest Records", points: harvestPoints, max: 20 },
      { label: "Platform Activity", points: activityPoints, max: 15 },
    ],
  };
}