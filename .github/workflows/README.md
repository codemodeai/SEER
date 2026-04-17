# GitHub Actions — SEER Windows Build

## Secrets required

Add these in GitHub → Settings → Secrets and variables → Actions:

| Secret | Value |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |

`GITHUB_TOKEN` is provided automatically by GitHub Actions.

## How to trigger a build

### Option 1 — Create a release tag (recommended)
```bash
git tag v1.0.0
git push origin v1.0.0
```
This triggers the workflow → builds → publishes a GitHub Release with `SEER_v1.0.0_x64-setup.exe` attached.

### Option 2 — Manual run
GitHub → Actions → "Build Windows Installer" → Run workflow

## What the workflow produces

`SEER_v1.0.0_x64-setup.exe` — a standard Windows NSIS installer with:
- Welcome screen
- License agreement (EULA)
- Installation directory picker (default: `C:\Program Files\SEER\`)
- Progress bar
- Finish screen with "Launch SEER" checkbox
- Desktop + Start Menu shortcuts
- Registered in Add/Remove Programs
- Built-in uninstaller

## What's bundled inside the installer

1. `SEER.exe` — the Tauri desktop app
2. `seer-agent.exe` — the local agent (standalone, no Node.js required)
