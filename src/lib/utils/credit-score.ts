export interface CreditScoreInputs {
  profileComplete: boolean;
  hasVerifiedFarm: boolean;
  totalCreditIssued: number;
  totalCreditRepaid: number;
  harvestRecordCount: number;
  cropCount: number;
  /** Kisan hamare saath kitne din se hai. */
  relationshipDays: number;
  /** Us ke naam par kitne asal, darj shuda kaam hue. */
  meaningfulEventCount: number;
}

/**
 * Kam az kam itna saboot chahiye, tab score dikhaya jata hai.
 *
 * Sirf din ginna kaafi nahi: koi kisan chhe mahine purana ho sakta hai
 * aur us ne ek hi dafa kuch kiya ho. Aur sirf kaam ginna bhi kaafi
 * nahi: ek hafte mein teen cheezein kar lene se ye nahi kaha ja sakta
 * ke banda kaisa hai. Is liye dono shartein sath poori honi chahiyen.
 */
export const MIN_RELATIONSHIP_DAYS = 30;
export const MIN_MEANINGFUL_EVENTS = 3;

export type CreditScoreResult =
  | {
      /** Abhi itna record nahi ke koi darja diya ja sake. */
      state: "building";
      relationshipDays: number;
      meaningfulEventCount: number;
    }
  | {
      state: "active";
      score: number;
      grade: "A" | "B" | "C" | "D";
      gradeLabel: string;
      gradeColor: string;
      breakdown: { label: string; points: number; max: number }[];
    };

// Simple rule-based credit score (0-100) - not a machine-learning model,
// just a transparent weighted combination of behavior signals that are
// meaningful for lending trust: profile completeness, land verification,
// credit repayment history, and productive platform activity.
//
// SABOOT NA HO TO KOI DARJA NAHI.
//
// Pehle ye function har haal mein ek adad deta tha, aur naye kisan ko
// 30 milte the -- yani laal "D", "Behtar Karna Hai". Wo jhoot tha. Us
// ne kuch bura nahi kiya tha; us ka hisaab shuru hi nahi hua tha.
//
// Adad wahan se aata tha jahan se nahi aana chahiye: jis kisan ko kabhi
// udhaar diya hi nahi gaya, us ki wapsi ke tees ke tees number
// bakhsh diye jate the. Ye alag masla hai aur naye score wale nizam
// mein hal hoga; yahan sirf itna kiya gaya hai ke jab tak saboot na ho,
// koi darja dikhaya hi na jaye.
export function computeFarmerCreditScore(inputs: CreditScoreInputs): CreditScoreResult {
  if (
    inputs.relationshipDays < MIN_RELATIONSHIP_DAYS ||
    inputs.meaningfulEventCount < MIN_MEANINGFUL_EVENTS
  ) {
    return {
      state: "building",
      relationshipDays: inputs.relationshipDays,
      meaningfulEventCount: inputs.meaningfulEventCount,
    };
  }

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
    state: "active",
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