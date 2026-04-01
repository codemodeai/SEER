import { NextRequest, NextResponse } from "next/server";
import { getUsdToInr } from "@/lib/exchange-rate";
import { PLANS } from "@/lib/plans";

const GST_RATE = 18; // 18% GST on digital services in India

export async function GET(req: NextRequest) {
  const plan = req.nextUrl.searchParams.get("plan");
  const totalUsdParam = req.nextUrl.searchParams.get("totalUsd");

  if (!plan) {
    return NextResponse.json({ error: "Missing plan" }, { status: 400 });
  }

  let priceUsd: number;

  if (plan === "agency" && totalUsdParam) {
    priceUsd = parseFloat(totalUsdParam);
    if (isNaN(priceUsd) || priceUsd < 1 || priceUsd > 10000) {
      return NextResponse.json({ error: "Invalid price" }, { status: 400 });
    }
  } else {
    const planConfig = PLANS[plan];
    if (!planConfig) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }
    priceUsd = planConfig.priceUsd;
  }

  const exchangeRate = await getUsdToInr();
  const subtotalInr = Math.round(priceUsd * exchangeRate);
  const gstAmount = Math.round(subtotalInr * (GST_RATE / 100));
  const totalInr = subtotalInr + gstAmount;

  return NextResponse.json({
    priceUsd,
    exchangeRate: Math.round(exchangeRate * 100) / 100,
    subtotalInr,
    gstPercent: GST_RATE,
    gstAmount,
    totalInr,
    totalPaise: totalInr * 100,
  });
}
