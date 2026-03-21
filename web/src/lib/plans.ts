export interface PlanConfig {
  name: string;
  priceUsd: number;
  priceInr: number;
  calls: number | "unlimited";
  dodoPriceId: string;
  razorpayPlanId: string;
}

export const PLANS: Record<string, PlanConfig> = {
  starter: {
    name: "Starter",
    priceUsd: 19,
    priceInr: 1599,
    calls: 200,
    dodoPriceId: process.env.DODO_STARTER_PRICE_ID ?? "",
    razorpayPlanId: process.env.RAZORPAY_STARTER_PLAN_ID ?? "",
  },
  pro: {
    name: "Pro",
    priceUsd: 49,
    priceInr: 3999,
    calls: 1000,
    dodoPriceId: process.env.DODO_PRO_PRICE_ID ?? "",
    razorpayPlanId: process.env.RAZORPAY_PRO_PLAN_ID ?? "",
  },
  agency: {
    name: "Agency",
    priceUsd: 99,
    priceInr: 7999,
    calls: "unlimited",
    dodoPriceId: process.env.DODO_AGENCY_PRICE_ID ?? "",
    razorpayPlanId: process.env.RAZORPAY_AGENCY_PLAN_ID ?? "",
  },
};

export function getPlanByDodoPriceId(priceId: string): string | null {
  for (const [key, plan] of Object.entries(PLANS)) {
    if (plan.dodoPriceId === priceId) return key;
  }
  return null;
}

export function getPlanByRazorpayPlanId(planId: string): string | null {
  for (const [key, plan] of Object.entries(PLANS)) {
    if (plan.razorpayPlanId === planId) return key;
  }
  return null;
}
