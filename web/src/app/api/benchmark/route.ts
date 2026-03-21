import { NextRequest, NextResponse } from "next/server";

const SEER_API_URL = "https://mcp.seermcp.com/mcp";

const TEST_PROMPTS = [
  { id: "short-1", category: "Short", prompt: "make a website" },
  { id: "short-2", category: "Short", prompt: "fix the bug" },
  { id: "short-3", category: "Short", prompt: "add dark mode" },
  { id: "specific-1", category: "Specific", prompt: "create a React login form with email and password fields" },
  { id: "specific-2", category: "Specific", prompt: "write a Python script to resize images to 800x600" },
  { id: "specific-3", category: "Specific", prompt: "add a rate limiter middleware to Express.js API" },
  { id: "redundant-1", category: "Redundant", prompt: "I want you to write me a function in JavaScript that will take an array of numbers as input and then go through each number one by one and check if that number is greater than 10 and if it is then add it to a new array and at the end return that new array with all the numbers that are greater than 10" },
  { id: "redundant-2", category: "Redundant", prompt: "Can you please help me create a REST API endpoint that will allow users to submit their feedback through a form and then store that feedback in a database and also send an email notification to the admin when new feedback is submitted" },
  { id: "redundant-3", category: "Redundant", prompt: "I need you to build a dashboard page that shows some charts and graphs displaying the user analytics data like how many users signed up each day and how many users are active and what pages they visit most frequently" },
  { id: "complex-1", category: "Complex", prompt: "Build a file upload component in React that supports drag and drop, shows a progress bar, validates file types to only accept images and PDFs, limits file size to 5MB, and uploads to an S3 bucket using presigned URLs" },
  { id: "complex-2", category: "Complex", prompt: "Create a caching layer for our API that uses Redis, implements cache invalidation when data is updated, has a TTL of 5 minutes for list endpoints and 1 hour for individual resources, and includes cache-hit metrics logging" },
  { id: "verbose-1", category: "Verbose", prompt: "I would like you to help me build an authentication system for my Next.js application. The system should support multiple authentication methods including email and password login, Google OAuth, and GitHub OAuth. When a user signs up with email and password, we need to hash the password using bcrypt before storing it. For OAuth providers, we need to handle the callback URLs properly. After successful authentication, we should generate a JWT token that expires in 7 days and store it in an HTTP-only cookie." },
  { id: "verbose-2", category: "Verbose", prompt: "I want to create a real-time chat application using WebSockets. The application should allow users to create chat rooms, join existing rooms, and send messages in real-time. Each message should show the sender's name, timestamp, and the message content. Users should be able to see who is currently online in each room. When a user joins a room, they should see the last 50 messages from the message history." },
  { id: "verbose-3", category: "Verbose", prompt: "Please help me set up a CI/CD pipeline for my Node.js project using GitHub Actions. The pipeline should run on every push to main and on pull requests. First, it should run the linting checks using ESLint. Then it should run the unit tests using Jest and generate a coverage report. If the tests pass, it should build the Docker image and tag it with the commit SHA. After building, it should push the image to AWS ECR." },
];

function estimateTokens(text: string): number {
  return Math.ceil(text.split(/\s+/).filter(Boolean).length * 1.3);
}

async function optimizeWithSeer(prompt: string, apiKey: string) {
  // Initialize
  await fetch(SEER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1, method: "initialize",
      params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "seer-benchmark", version: "1.0.0" } },
    }),
  });

  // Call optimize
  const res = await fetch(SEER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 2, method: "tools/call",
      params: { name: "seer_optimize", arguments: { prompt, model: "claude" } },
    }),
  });

  const data = await res.json() as { result?: { content?: Array<{ text?: string }> } };
  const text = data?.result?.content?.[0]?.text ?? "{}";
  const stripped = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

  try {
    const parsed = JSON.parse(stripped);
    return parsed.optimized ?? prompt;
  } catch {
    try {
      const parsed = JSON.parse(text);
      return parsed.optimized ?? prompt;
    } catch {
      return prompt;
    }
  }
}

export async function POST(req: NextRequest) {
  const { apiKey } = await req.json();
  if (!apiKey) {
    return NextResponse.json({ error: "API key required" }, { status: 400 });
  }

  const results = [];
  let totalOriginal = 0;
  let totalOptimized = 0;

  for (const p of TEST_PROMPTS) {
    try {
      const optimized = await optimizeWithSeer(p.prompt, apiKey);
      const origTokens = estimateTokens(p.prompt);
      const optTokens = estimateTokens(optimized);
      const savings = origTokens > 0 ? Math.round((1 - optTokens / origTokens) * 100) : 0;

      totalOriginal += origTokens;
      totalOptimized += optTokens;

      results.push({
        id: p.id,
        category: p.category,
        original: p.prompt,
        optimized,
        before: origTokens,
        after: optTokens,
        savings,
      });
    } catch {
      results.push({
        id: p.id,
        category: p.category,
        original: p.prompt,
        optimized: "",
        before: 0,
        after: 0,
        savings: 0,
        error: true,
      });
    }
  }

  const overallSavings = totalOriginal > 0 ? Math.round((1 - totalOptimized / totalOriginal) * 100) : 0;

  // Group by category
  const categories: Record<string, { original: number; optimized: number; count: number }> = {};
  for (const r of results) {
    if (!categories[r.category]) categories[r.category] = { original: 0, optimized: 0, count: 0 };
    categories[r.category].original += r.before;
    categories[r.category].optimized += r.after;
    categories[r.category].count += 1;
  }

  const categoryStats = Object.entries(categories).map(([name, stats]) => ({
    name,
    savings: stats.original > 0 ? Math.round((1 - stats.optimized / stats.original) * 100) : 0,
    count: stats.count,
  }));

  return NextResponse.json({
    totalOriginal,
    totalOptimized,
    overallSavings,
    categories: categoryStats,
    results,
  });
}
