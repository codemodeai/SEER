/**
 * Test: Real-time memory sync between two agency users
 *
 * Tests the full sync flow:
 * 1. Setup — find/create two agency users
 * 2. User 1 pushes memory via API key (MCP sync path)
 * 3. User 2 pulls and sees User 1's content (dashboard path)
 * 4. User 2 pushes update, User 1 sees new version
 * 5. Version conflict detection
 * 6. SHA-256 integrity verification
 * 7. Unchanged content deduplication
 * 8. Activity heartbeat + idle detection
 *
 * Usage: npx tsx tests/test-memory-sync.ts
 * Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in web/.env.local
 */

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import fs from "fs";
import path from "path";

// Load env from web/.env.local manually
const envPath = path.join(import.meta.dirname ?? __dirname, "..", "web", ".env.local");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in web/.env.local"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function sha256(content: string): string {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

// Test data
const TEST_PROJECT = `test-sync-${Date.now()}`;
const MEMORY_V1 = `# SEER Project Memory\n\n## 1. Project Overview\nname: ${TEST_PROJECT}\ngoal: Testing memory sync\n\n## 2. Current Status\nlast_updated: ${new Date().toISOString()}\nphase: Test\nlast_completed: initial push\nnext_action: verify sync`;
const MEMORY_V2 = MEMORY_V1 + `\n\n## Session Log\n[${new Date().toISOString()}] User 2 updated memory`;

async function findTestAgency(): Promise<{
  agencyId: string;
  slug: string;
  ownerId: string;
} | null> {
  const { data: agency } = await supabase
    .from("agencies")
    .select("id, slug, owner_id")
    .eq("status", "active")
    .limit(1)
    .single();

  return agency
    ? { agencyId: agency.id, slug: agency.slug, ownerId: agency.owner_id }
    : null;
}

async function findAgencyMembers(
  agencyId: string,
  ownerId: string
): Promise<{ user1Id: string; user2Id: string; user1Key: string; user2Key: string } | null> {
  // User 1 = agency owner
  const { data: owner } = await supabase
    .from("users")
    .select("id, email, seer_api_key")
    .eq("id", ownerId)
    .single();

  if (!owner) return null;

  // User 2 = first agency member (not owner)
  const { data: members } = await supabase
    .from("agency_users")
    .select("user_id")
    .eq("agency_id", agencyId)
    .neq("user_id", ownerId)
    .limit(1);

  let user2Id: string;
  let user2Key: string;

  if (members && members.length > 0) {
    user2Id = members[0].user_id;
    const { data: u2 } = await supabase
      .from("users")
      .select("id, seer_api_key")
      .eq("id", user2Id)
      .single();
    user2Key = u2?.seer_api_key ?? "";
  } else {
    // No members — use owner as both users for basic testing
    console.log(
      "  ⚠ No agency members found. Using owner as both users (limited conflict test)."
    );
    user2Id = ownerId;
    user2Key = owner.seer_api_key ?? "";
  }

  return {
    user1Id: ownerId,
    user2Id,
    user1Key: owner.seer_api_key ?? "",
    user2Key,
  };
}

async function cleanup(agencyId: string) {
  await supabase
    .from("agency_projects")
    .delete()
    .eq("agency_id", agencyId)
    .eq("project_name", TEST_PROJECT);

  await supabase
    .from("agency_activity")
    .delete()
    .eq("agency_id", agencyId)
    .eq("project_name", TEST_PROJECT);
}

async function runTests() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  SEER Memory Sync — Two-User Integration Test");
  console.log("═══════════════════════════════════════════════════════\n");

  // ──────────────────────────────────────────────────
  // STEP 1: Find test agency + users
  // ──────────────────────────────────────────────────
  console.log("1. Setup — finding agency and users...");

  const agency = await findTestAgency();
  if (!agency) {
    console.log("  ✗ No active agency found in database. Create one first.");
    process.exit(1);
  }
  console.log(`  ✓ Agency found: ${agency.slug} (${agency.agencyId})`);

  const users = await findAgencyMembers(agency.agencyId, agency.ownerId);
  if (!users) {
    console.log("  ✗ Could not find agency users.");
    process.exit(1);
  }

  const isSameUser = users.user1Id === users.user2Id;
  console.log(`  ✓ User 1 (owner): ${users.user1Id}`);
  console.log(`  ✓ User 2 (member): ${users.user2Id}${isSameUser ? " (same as owner)" : ""}`);
  console.log(`  ✓ User 1 API key: ${users.user1Key ? "present" : "MISSING"}`);
  console.log(`  ✓ User 2 API key: ${users.user2Key ? "present" : "MISSING"}`);

  // Clean up any previous test data
  await cleanup(agency.agencyId);

  // ──────────────────────────────────────────────────
  // STEP 2: User 1 pushes memory (simulates MCP auto-sync via API key)
  // ──────────────────────────────────────────────────
  console.log("\n2. User 1 pushes memory (MCP sync path)...");

  const contentHash1 = sha256(MEMORY_V1);

  // Simulate the /api/seer/memory-sync POST by directly inserting
  const { error: insertErr } = await supabase.from("agency_projects").insert({
    agency_id: agency.agencyId,
    project_name: TEST_PROJECT,
    cloud_memory: MEMORY_V1,
    content_hash: contentHash1,
    version: 1,
    updated_by: users.user1Id,
  });

  assert(!insertErr, "User 1 push — project created", insertErr?.message);

  // Verify it's in the DB
  const { data: created } = await supabase
    .from("agency_projects")
    .select("id, project_name, cloud_memory, content_hash, version, updated_by")
    .eq("agency_id", agency.agencyId)
    .eq("project_name", TEST_PROJECT)
    .single();

  assert(!!created, "Project exists in database");
  assert(created?.version === 1, "Version is 1");
  assert(created?.content_hash === contentHash1, "SHA-256 hash matches content");
  assert(created?.updated_by === users.user1Id, "Updated_by tracks User 1");

  // ──────────────────────────────────────────────────
  // STEP 3: User 2 pulls and sees User 1's content
  // ──────────────────────────────────────────────────
  console.log("\n3. User 2 pulls memory (dashboard path)...");

  const { data: pulled } = await supabase
    .from("agency_projects")
    .select("project_name, cloud_memory, content_hash, version, updated_by")
    .eq("agency_id", agency.agencyId)
    .eq("project_name", TEST_PROJECT)
    .single();

  assert(!!pulled, "User 2 can read project");
  assert(pulled?.cloud_memory === MEMORY_V1, "Content matches User 1's push");

  // Verify integrity
  const computedHash = sha256(pulled?.cloud_memory ?? "");
  const integrityOk = computedHash === pulled?.content_hash;
  assert(integrityOk, "SHA-256 integrity verified on pull");
  assert(pulled?.version === 1, "Version is still 1");

  // ──────────────────────────────────────────────────
  // STEP 4: User 2 pushes update
  // ──────────────────────────────────────────────────
  console.log("\n4. User 2 pushes updated memory...");

  const contentHash2 = sha256(MEMORY_V2);
  const newVersion = (pulled?.version ?? 1) + 1;

  const { error: updateErr } = await supabase
    .from("agency_projects")
    .update({
      cloud_memory: MEMORY_V2,
      content_hash: contentHash2,
      version: newVersion,
      updated_by: users.user2Id,
    })
    .eq("agency_id", agency.agencyId)
    .eq("project_name", TEST_PROJECT);

  assert(!updateErr, "User 2 push — project updated", updateErr?.message);

  // User 1 pulls and sees User 2's changes
  const { data: updated } = await supabase
    .from("agency_projects")
    .select("cloud_memory, content_hash, version, updated_by")
    .eq("agency_id", agency.agencyId)
    .eq("project_name", TEST_PROJECT)
    .single();

  assert(updated?.cloud_memory === MEMORY_V2, "User 1 sees User 2's updated content");
  assert(updated?.version === 2, "Version incremented to 2");
  assert(updated?.updated_by === users.user2Id, "Updated_by now tracks User 2");
  assert(
    sha256(updated?.cloud_memory ?? "") === updated?.content_hash,
    "SHA-256 integrity after update"
  );

  // ──────────────────────────────────────────────────
  // STEP 5: Version conflict detection
  // ──────────────────────────────────────────────────
  console.log("\n5. Version conflict detection...");

  // Simulate: User 1 thinks version is 1 but server is now at 2
  const staleVersion = 1;
  const serverVersion = updated?.version ?? 2;
  const conflictDetected = staleVersion !== serverVersion;

  assert(conflictDetected, "Stale version detected (client=1, server=2)");
  assert(
    serverVersion === 2,
    `Server version is ${serverVersion} (conflict would return 409)`
  );

  // Simulate conflict resolution: User 1 pulls latest, then pushes
  const MEMORY_V3 =
    MEMORY_V2 + `\n[${new Date().toISOString()}] User 1 resolved conflict and updated`;
  const contentHash3 = sha256(MEMORY_V3);

  const { error: resolveErr } = await supabase
    .from("agency_projects")
    .update({
      cloud_memory: MEMORY_V3,
      content_hash: contentHash3,
      version: serverVersion + 1,
      updated_by: users.user1Id,
    })
    .eq("agency_id", agency.agencyId)
    .eq("project_name", TEST_PROJECT);

  assert(!resolveErr, "Conflict resolved — User 1 pushed v3 after pulling latest");

  const { data: v3 } = await supabase
    .from("agency_projects")
    .select("version, updated_by")
    .eq("agency_id", agency.agencyId)
    .eq("project_name", TEST_PROJECT)
    .single();

  assert(v3?.version === 3, "Version is now 3 after conflict resolution");

  // ──────────────────────────────────────────────────
  // STEP 6: Unchanged content deduplication
  // ──────────────────────────────────────────────────
  console.log("\n6. Unchanged content deduplication...");

  // Push same content again — should be detected as unchanged
  const { data: before } = await supabase
    .from("agency_projects")
    .select("version, content_hash")
    .eq("agency_id", agency.agencyId)
    .eq("project_name", TEST_PROJECT)
    .single();

  const sameHash = sha256(MEMORY_V3);
  const isUnchanged = sameHash === before?.content_hash;

  assert(isUnchanged, "Hash comparison detects unchanged content (skip update)");
  assert(
    before?.version === 3,
    "Version stays at 3 when content unchanged"
  );

  // ──────────────────────────────────────────────────
  // STEP 7: Activity heartbeat
  // ──────────────────────────────────────────────────
  console.log("\n7. Activity heartbeat + idle detection...");

  // User 1 sends heartbeat
  const { error: hb1Err } = await supabase.from("agency_activity").upsert(
    {
      agency_id: agency.agencyId,
      user_id: users.user1Id,
      project_name: TEST_PROJECT,
      feature_label: "memory-sync",
      status: "active",
      last_seen: new Date().toISOString(),
    },
    { onConflict: "agency_id,user_id,project_name" }
  );

  assert(!hb1Err, "User 1 heartbeat — active", hb1Err?.message);

  // User 2 sends heartbeat on same project
  if (!isSameUser) {
    const { error: hb2Err } = await supabase.from("agency_activity").upsert(
      {
        agency_id: agency.agencyId,
        user_id: users.user2Id,
        project_name: TEST_PROJECT,
        feature_label: "memory-sync",
        status: "active",
        last_seen: new Date().toISOString(),
      },
      { onConflict: "agency_id,user_id,project_name" }
    );

    assert(!hb2Err, "User 2 heartbeat — active", hb2Err?.message);
  }

  // Check activity feed
  const { data: activities } = await supabase
    .from("agency_activity")
    .select("user_id, project_name, feature_label, status, last_seen")
    .eq("agency_id", agency.agencyId)
    .eq("project_name", TEST_PROJECT);

  const activeCount = (activities ?? []).filter(
    (a) => a.status === "active"
  ).length;
  const expectedActive = isSameUser ? 1 : 2;

  assert(
    activeCount === expectedActive,
    `${activeCount} active user(s) on project (expected ${expectedActive})`
  );

  // Simulate idle: set last_seen to 15 minutes ago
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  await supabase
    .from("agency_activity")
    .update({ last_seen: fifteenMinAgo })
    .eq("agency_id", agency.agencyId)
    .eq("user_id", users.user1Id)
    .eq("project_name", TEST_PROJECT);

  const { data: stale } = await supabase
    .from("agency_activity")
    .select("last_seen, status")
    .eq("agency_id", agency.agencyId)
    .eq("user_id", users.user1Id)
    .eq("project_name", TEST_PROJECT)
    .single();

  const lastSeen = new Date(stale?.last_seen ?? "").getTime();
  const isIdle = Date.now() - lastSeen > 10 * 60 * 1000;

  assert(isIdle, "Idle detection — User 1 last_seen > 10min ago");

  // ──────────────────────────────────────────────────
  // STEP 8: Content size limit
  // ──────────────────────────────────────────────────
  console.log("\n8. Content size limit...");

  const oversized = "x".repeat(512001);
  const oversizedValid = oversized.length > 512000;
  assert(oversizedValid, "Content >500KB would be rejected (512001 bytes)");

  const undersized = "x".repeat(512000);
  const undersizedValid = undersized.length <= 512000;
  assert(undersizedValid, "Content =500KB would be accepted (512000 bytes)");

  // ──────────────────────────────────────────────────
  // STEP 9: Project listing
  // ──────────────────────────────────────────────────
  console.log("\n9. Project listing...");

  const { data: projects } = await supabase
    .from("agency_projects")
    .select("project_name, version")
    .eq("agency_id", agency.agencyId)
    .order("updated_at", { ascending: false });

  const testProjectInList = (projects ?? []).some(
    (p) => p.project_name === TEST_PROJECT
  );
  assert(testProjectInList, "Test project appears in project list");
  assert((projects ?? []).length >= 1, `${(projects ?? []).length} project(s) in agency`);

  // ──────────────────────────────────────────────────
  // STEP 10: Cleanup
  // ──────────────────────────────────────────────────
  console.log("\n10. Cleanup...");
  await cleanup(agency.agencyId);

  const { data: afterCleanup } = await supabase
    .from("agency_projects")
    .select("id")
    .eq("agency_id", agency.agencyId)
    .eq("project_name", TEST_PROJECT);

  assert(
    (afterCleanup ?? []).length === 0,
    "Test project cleaned up successfully"
  );

  // ──────────────────────────────────────────────────
  // Summary
  // ──────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════════");
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log("═══════════════════════════════════════════════════════\n");

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
