import { usdToInr } from "@/lib/exchange-rate";

export interface PlanConfig {
  name: string;
  priceUsd: number;
  calls: number | "unlimited";
  dodoPriceId: string;
  razorpayPlanId: string;
}

// Get INR price dynamically from live exchange rate
export async function getPriceInr(usd: number): Promise<number> {
  return usdToInr(usd);
}

function getPlans(): Record<string, PlanConfig> {
  return {
    starter: {
      name: "Starter",
      priceUsd: 19,
      calls: 200,
      dodoPriceId: process.env.DODO_STARTER_PRICE_ID ?? "",
      razorpayPlanId: process.env.RAZORPAY_STARTER_PLAN_ID ?? "",
    },
    pro: {
      name: "Pro",
      priceUsd: 49,
      calls: 1000,
      dodoPriceId: process.env.DODO_PRO_PRICE_ID ?? "",
      razorpayPlanId: process.env.RAZORPAY_PRO_PLAN_ID ?? "",
    },
    agency: {
      name: "Agency",
      priceUsd: 99,
      calls: "unlimited",
      dodoPriceId: process.env.DODO_AGENCY_PRICE_ID ?? "",
      razorpayPlanId: process.env.RAZORPAY_AGENCY_PLAN_ID ?? "",
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
