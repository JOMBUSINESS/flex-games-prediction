# FLEX GAMES frontends

The public website and administrator console are separate applications in this repository:

- Public website: `/website/`
- Member dashboard: `/website/dashboard.html`
- Admin console: `/admin/`

After GitHub Pages is enabled for this repository, the expected project-site paths are:

- `https://JOMBUSINESS.github.io/flex-games-prediction/website/`
- `https://JOMBUSINESS.github.io/flex-games-prediction/admin/`

## API connection

Both apps load the API origin from `website/assets/config.js`. It currently points to the Render service hostname declared in `render.yaml`. If Render gives the service a different hostname, update that value to the exact Render URL.

In Render, set `FRONTEND_ORIGINS` to the exact GitHub Pages origin, without a trailing slash, for example:

`https://JOMBUSINESS.github.io`

Keep the backend's `SESSION_SECRET`, database, Resend and other secrets configured in Render. Never put secrets in frontend files.

## Publish

The workflow at `.github/workflows/pages.yml` deploys the repository contents to GitHub Pages when changes are pushed to the default branch. In GitHub repository Settings → Pages, choose **GitHub Actions** as the build and deployment source.

## Important browser-session note

The GitHub Pages frontend and Render API are on different sites. The API currently uses secure cross-site session cookies, but some browsers or privacy settings block third-party cookies. For reliable long-term sign-in, use a custom domain arrangement that places the website and API under the same registrable domain, or move the frontend to a host/domain arrangement that supports first-party API cookies.

The admin console also requires an existing account with an administrator role. Create or promote the first administrator using the backend's documented super-admin bootstrap script; do not expose bootstrap credentials in this repository.


## Deployment verification

After selecting GitHub Actions as the Pages source, a new push triggers the Pages workflow. Check the Actions tab for the latest `Deploy FLEX GAMES frontends to GitHub Pages` run. If the workflow still fails at `Configure Pages`, confirm Pages is enabled for this repository and GitHub Actions is selected as its source, then rerun the workflow.
