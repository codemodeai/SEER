// Fetches live USD→INR exchange rate with 1-hour cache
// Uses free exchangerate-api.com (no API key needed)

let cachedRate: { rate: number; fetchedAt: number } | null = null;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const FALLBACK_RATE = 93; // Reasonable fallback if API fails

export async function getUsdToInr(): Promise<number> {
  // Return cached rate if fresh
  if (cachedRate && Date.now() - cachedRate.fetchedAt < CACHE_TTL) {
    return cachedRate.rate;
  }

  try {
    const res = await fetch(
      "https://open.er-api.com/v6/latest/USD",
      { next: { revalidate: 3600 } } // Next.js fetch cache: 1 hour
    );

    if (res.ok) {
      const data = await res.json();
      const rate = data?.rates?.INR;
      if (typeof rate === "number" && rate > 50 && rate < 200) {
        cachedRate = { rate, fetchedAt: Date.now() };
        return rate;
      }
    }
  } catch (err) {
    console.error("Exchange rate fetch failed:", err);
  }

  // Fallback: use cached rate if exists (even if stale), otherwise fallback constant
  return cachedRate?.rate ?? FALLBACK_RATE;
}

// Convert USD to INR paise (for Razorpay)
export async function usdToInrPaise(usd: number): Promise<number> {
  const rate = await getUsdToInr();
  return Math.round(usd * rate * 100);
}

// Convert USD to INR (rounded)
export async function usdToInr(usd: number): Promise<number> {
  const rate = await getUsdToInr();
  return Math.round(usd * rate);
}
