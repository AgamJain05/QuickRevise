# 📦 Shared Types

This folder contains the **source of truth** for TypeScript types shared between client and server.

## ⚠️ Important: Deployment

Since client and server are deployed **separately** (Netlify + Render), they cannot access this shared folder at runtime.

### How It Works

1. **Development**: This folder serves as the reference
2. **Deployment**: Types are **copied** to:
   - `client/src/types/shared.ts`
   - `server/src/types/shared.ts`

### Updating Types

When you modify types:

1. Edit `shared/types/index.ts` (source of truth)
2. Copy changes to `client/src/types/shared.ts`
3. Copy changes to `server/src/types/shared.ts`

### Quick Sync Script (Optional)

Add to root `package.json`:

```json
{
  "scripts": {
    "sync-types": "cp shared/types/index.ts client/src/types/shared.ts && cp shared/types/index.ts server/src/types/shared.ts"
  }
}
```

Then run: `npm run sync-types`

### Why Not npm Workspace?

npm workspaces require a single deployment. Since we deploy client (Netlify) and server (Render) separately, the simplest solution is copying types.

### Alternative Approaches

| Approach | Complexity | When to Use |
|----------|------------|-------------|
| Copy files (current) | Simple | Separate deployments ✅ |
| npm workspace | Medium | Monorepo single deploy |
| Publish to npm | High | Large teams, versioned types |
