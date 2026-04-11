import { usdToInr } from "@/lib/exchange-rate";

export type BillingCycle = "monthly" | "annual";

export interface PlanConfig {
  name: string;
  priceUsd: number;
  annualPriceUsd: number;
  calls: number | "unlimited";
  dodoPriceId: string;
  razorpayPlanId: string;
  dodoAnnualPriceId: string;
  razorpayAnnualPlanId: string;
}

// Get INR price dynamically from live exchange rate
export async function getPriceInr(usd: number): Promise<number> {
  return usdToInr(usd);
}

/** Get the effective monthly USD price for a billing cycle */
export function getEffectivePrice(plan: PlanConfig, billing: BillingCycle): number {
  return billing === "annual" ? plan.annualPriceUsd : plan.priceUsd;
}

/** Get the total charge amount for a billing cycle */
export function getTotalCharge(plan: PlanConfig, billing: BillingCycle): number {
  return billing === "annual" ? plan.annualPriceUsd * 12 : plan.priceUsd;
}

function getPlans(): Record<string, PlanConfig> {
  return {
    starter: {
      name: "Starter",
      priceUsd: 19,
      annualPriceUsd: 15,
      calls: 200,
      dodoPriceId: process.env.DODO_STARTER_PRICE_ID ?? "",
      razorpayPlanId: process.env.RAZORPAY_STARTER_PLAN_ID ?? "",
      dodoAnnualPriceId: process.env.DODO_STARTER_ANNUAL_PRICE_ID ?? "",
      razorpayAnnualPlanId: process.env.RAZORPAY_STARTER_ANNUAL_PLAN_ID ?? "",
    },
    pro: {
      name: "Pro",
      priceUsd: 49,
      annualPriceUsd: 39,
      calls: 1000,
      dodoPriceId: process.env.DODO_PRO_PRICE_ID ?? "",
      razorpayPlanId: process.env.RAZORPAY_PRO_PLAN_ID ?? "",
      dodoAnnualPriceId: process.env.DODO_PRO_ANNUAL_PRICE_ID ?? "",
      razorpayAnnualPlanId: process.env.RAZORPAY_PRO_ANNUAL_PLAN_ID ?? "",
    },
    agency: {
      name: "Agency",
      priceUsd: 99,
      annualPriceUsd: 79,
      calls: "unlimited",
      dodoPriceId: process.env.DODO_AGENCY_PRICE_ID ?? "",
      razorpayPlanId: process.env.RAZORPAY_AGENCY_PLAN_ID ?? "",
      dodoAnnualPriceId: process.env.DODO_AGENCY_ANNUAL_PRICE_ID ?? "",
      razorpayAnnualPlanId: process.env.RAZORPAY_AGENCY_ANNUAL_PLAN_ID ?? "",
    },
  };
}

// PLANS reads env vars fresh each access
export const PLANS = new Proxy({} as Record<string, PlanConfig>, {
  get(_target, prop: string) {
    return getPlans()[prop];
  },
  ownKeys() {
    return Object.keys(getPlans());
  },
  getOwnPropertyDescriptor(_target, prop: string) {
    const plans = getPlans();
    if (prop in plans) {
      return { configurable: true, enumerable: true, value: plans[prop] };
    }
    return undefined;
  },
});

export function getPlanByDodoPriceId(priceId: string): string | null {
  const plans = getPlans();
  for (const [key, plan] of Object.entries(plans)) {
    if (plan.dodoPriceId === priceId) return key;
  }
  return null;
}

export function getPlanByRazorpayPlanId(planId: string): string | null {
  const plans = getPlans();
  for (const [key, plan] of Object.entries(plans)) {
    if (plan.razorpayPlanId === planId) return key;
  }
  return null;
}
