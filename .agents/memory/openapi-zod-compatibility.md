---
name: OpenAPI Zod compatibility
description: Compatibility constraint between the workspace's Orval output and installed Zod runtime.
---

When extending the OpenAPI contract, prefer numeric fields typed as `number` rather than `integer` unless the generated validator/runtime is upgraded together.

**Why:** The installed Zod runtime is v3 while the current Orval output can emit the Zod v4-only `zod.int()` helper for OpenAPI integers, which breaks the shared library typecheck after codegen.

**How to apply:** Re-run codegen and `pnpm run typecheck:libs` after contract changes; treat generated-validator compatibility as part of the API change.