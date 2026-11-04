# On_Haru

Original app: https://onharu.myeram.chatgpt.site/legacy/

The original app files are preserved in `public/legacy/`. The root redirects to `/legacy/`.

## Current Cloudflare edge preview

- URL: https://on-haru.laml6732.workers.dev/legacy/
- Cloudflare Worker: `on-haru`
- Worker source: [cloudflare/on-haru-edge-preview.js](cloudflare/on-haru-edge-preview.js)
- The Worker serves the existing GitHub `main` branch's `public/` files through the Cloudflare URL. App UI and files were not changed.
- This is an **edge proxy preview**, **not a Cloudflare Pages static-asset deployment**. Static files are fetched from `raw.githubusercontent.com`. Updates to `main` generally appear after cache expiry (60–300 seconds, plus any GitHub caching); they are not triggered by a GitHub deployment webhook. Production release should use a Git-integrated Pages or Workers Static Assets deployment.
- Changing the Worker source file in GitHub does **not** automatically redeploy Worker logic; a Cloudflare Worker deployment is needed.

## Local preview

```sh
python3 -m http.server 8080 --directory public
```

Open http://localhost:8080/legacy/.

## Recommended production deployment: Git-integrated Cloudflare Pages

1. In GitHub, grant the **Cloudflare Workers & Pages** app access to `laml6732-spec/On_haru` at https://github.com/settings/installations.
2. In Cloudflare **Workers & Pages**, create a Pages project connected to this GitHub repository. If Git connection reports an installation error, reinstall or reauthorize the Cloudflare GitHub app first.
3. Configure: project `on-haru`, production branch `main`, root directory `/`, empty build command, output directory `public`.
4. Deploy. Git pushes to `main` will then automatically trigger real static-asset deployments.

This deployment was initially attempted via the Cloudflare Pages API on 2026-11-04 but Cloudflare rejected Git integration with `8000011: internal issue with your Cloudflare Pages Git installation`. The Worker preview avoids this Git installation dependency.

**Browser data migration:** Personal records remain in browser storage scoped to their original domain. They do not automatically transfer to a different domain. Export a JSON backup in the original app before switching domains, then import it in the new app.
