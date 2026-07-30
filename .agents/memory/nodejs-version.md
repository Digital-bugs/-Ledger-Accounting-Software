---
name: Node.js version requirement
description: better-sqlite3 v13 requires NAPI 10, only available in Node.js 22+; project must use nodejs-24 module.
---

# Node.js Version Requirement

`better-sqlite3@13.x` is compiled with `NAPI_VERSION=10`, which was introduced in Node.js 22.0.0. Running it on Node.js 20 causes a silent segfault.

**Why:** The prebuilt binary targets NAPI 10; Node.js 20 only exposes NAPI 9. Loading the .node file segfaults immediately with exit code 139 and no error output.

**How to apply:** Always use the `nodejs-24` Replit module for this project. If dependencies are installed and `better-sqlite3` segfaults, check `node --version` first — it must be v22+.

Also: the prebuilt linux-x64.node requires `libstdc++.so.6`. Install the `gcc` system dependency if it's missing (needed for ldd resolution even with the prebuilt).
