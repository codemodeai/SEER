export interface PlanConfig {
  name: string;
  price_usd: number;
  price_inr: number;
  calls: number;
  dodo_product_id: string;
  razorpay_plan_id: string;
}

export const PLANS: Record<string, PlanConfig> = {
  starter: {
    name: "Starter",
    price_usd: 19,
    price_inr: 1599,
    calls: 200,
    dodo_product_id: process.env["DODO_STARTER_PRODUCT_ID"] ?? "",
    razorpay_plan_id: process.env["RAZORPAY_STARTER_PLAN_ID"] ?? "",
  },
  pro: {
    name: "Pro",
    price_usd: 49,
    price_inr: 3999,
    calls: 1000,
    dodo_product_id: process.env["DODO_PRO_PRODUCT_ID"] ?? "",
    razorpay_plan_id: process.env["RAZORPAY_PRO_PLAN_ID"] ?? "",
  },
  agency: {
    name: "Agency",
    price_usd: 99,
    price_inr: 7999,
    calls: Infinity,
    dodo_product_id: process.env["DODO_AGENCY_PRODUCT_ID"] ?? "",
    razorpay_plan_id: process.env["RAZORPAY_AGENCY_PLAN_ID"] ?? "",
  },
};

/** Resolve plan name from a Dodo product ID */
export function planFromDodoProduct(productId: string): string | null {
  for (const [plan, config] of Object.entries(PLANS)) {
    if (config.dodo_product_id === productId) return plan;
  }
  return null;
}

/** Resolve plan name from a Razorpay plan ID */
export function planFromRazorpayPlan(planId: string): string | null {
  for (const [plan, config] of Object.entries(PLANS)) {
    if (config.razorpay_plan_id === planId) return plan;
  }
  return null;
}
