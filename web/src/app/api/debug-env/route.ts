import { NextResponse } from "next/server";

export async function GET() {
  const razorpayKey = (process.env.RAZORPAY_KEY_ID ?? "").trim();
  const razorpaySecret = (process.env.RAZORPAY_KEY_SECRET ?? "").trim();
  const starterPlan = process.env.RAZORPAY_STARTER_PLAN_ID;

  // Actually test Razorpay auth
  let authTestResult = "not tested";
  if (razorpayKey && razorpaySecret) {
    try {
      const auth = Buffer.from(`${razorpayKey}:${razorpaySecret}`).toString("base64");
      const res = await fetch("https://api.razorpay.com/v1/plans?count=1", {
        headers: { Authorization: `Basic ${auth}` },
      });
      if (res.ok) {
        authTestResult = "SUCCESS - auth works!";
      } else {
        const errText = await res.text();
        authTestResult = `FAILED (${res.status}): ${errText}`;
      }
    } catch (e) {
      authTestResult = `ERROR: ${e}`;
    }
  }

  // Show char codes for key to catch invisible characters
  const keyCharCodes = razorpayKey
    ? razorpayKey.split("").map((c, i) => `${i}:${c}(${c.charCodeAt(0)})`).join(" ")
    : "empty";

  const secretCharCodes = razorpaySecret
    ? `length=${razorpaySecret.length}, first5codes=${razorpaySecret.substring(0, 5).split("").map(c => c.charCodeAt(0)).join(",")}`
    : "empty";

  return NextResponse.json({
    authTestResult,
    RAZORPAY_KEY_ID: razorpayKey
      ? `${razorpayKey.length} chars, full: ${razorpayKey}`
      : "MISSING",
    RAZORPAY_KEY_SECRET_INFO: secretCharCodes,
    RAZORPAY_STARTER_PLAN_ID: starterPlan ?? "MISSING",
    keyCharCodes,
  });
}
