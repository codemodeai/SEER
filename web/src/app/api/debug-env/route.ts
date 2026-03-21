import { NextResponse } from "next/server";

export async function GET() {
  const razorpayKey = process.env.RAZORPAY_KEY_ID;
  const razorpaySecret = process.env.RAZORPAY_KEY_SECRET;
  const starterPlan = process.env.RAZORPAY_STARTER_PLAN_ID;
  const proPlan = process.env.RAZORPAY_PRO_PLAN_ID;
  const agencyPlan = process.env.RAZORPAY_AGENCY_PLAN_ID;

  return NextResponse.json({
    RAZORPAY_KEY_ID: razorpayKey
      ? `present (${razorpayKey.length} chars, starts with: ${razorpayKey.substring(0, 12)})`
      : "MISSING",
    RAZORPAY_KEY_SECRET: razorpaySecret
      ? `present (${razorpaySecret.length} chars)`
      : "MISSING",
    RAZORPAY_STARTER_PLAN_ID: starterPlan
      ? `present (${starterPlan.substring(0, 10)}...)`
      : "MISSING",
    RAZORPAY_PRO_PLAN_ID: proPlan
      ? `present (${proPlan.substring(0, 10)}...)`
      : "MISSING",
    RAZORPAY_AGENCY_PLAN_ID: agencyPlan
      ? `present (${agencyPlan.substring(0, 10)}...)`
      : "MISSING",
    DODO_API_KEY: process.env.DODO_API_KEY ? "present" : "MISSING",
  });
}
