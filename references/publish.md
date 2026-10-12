# Publishing a figure to the community gallery

The community gallery is the repository `wheresryan22/anatomy-community`. People share plain HTML figures there: a build script that writes standalone pages next to itself, as the skill's examples do. React and Next.js figures can't be submitted. The gallery shows every figure in the light theme, so a published figure needs its light page (`build.mjs --light`); a dark page is optional.

Publish only when the user asks to share or publish a figure. Never push, fork or open a pull request yourself: prepare everything locally, show it, and give the user the commands to run.

## Steps

1. **Check the figure is finished.** Its pages are built and up to date, the line check passes, and `--audit` passes if it has pipes, cables or round parts. A figure that fails these will fail the gallery's checks too.
2. **Ask the user for what only they can give:**
   - their GitHub username (the author);
   - a title (at most 80 characters);
   - the license: MIT (the default) or CC-BY-4.0;
   - confirmation that it is their own work and they are happy to share it.
   The prompt is the request that made the figure; reuse it, trimmed to 600 characters.
3. **Get a local clone of the gallery.** If the user has none, give them the commands to fork and clone it (`gh repo fork wheresryan22/anatomy-community --clone`), and wait.
4. **Publish into the clone:**
   ```sh
   node <skill>/scripts/publish.mjs <figure folder> --into <clone> --id <kebab-id> \
     --title "..." --author <github user> --prompt "..." \
     [--agent "Claude Code"|OpenCode|Codex|Other] [--model "..."] [--license MIT|CC-BY-4.0] \
     [--tags a,b] [--audit] [--pages dark.html,light.html]
   ```
   Pass `--agent` for the agent you are running in. It copies the figure's source into `figures/<id>/src/`, points its kit imports at the clone's `.skill/` link, records the kit fingerprint, rebuilds the pages there and takes `poster.png`.
   - If it says a file reaches outside the figure folder and the skill, copy what that file needs into the figure folder, rebuild, and publish again.
   - If it can't tell which pages are the figure, pass `--pages`.
5. **Validate inside the clone:** `node scripts/validate.mjs figures/<id>` must end `passed`. Fix what it names. It runs the same checks as the gallery's CI, which also fetches the exact skill version from GitHub.
6. **Show the user** the poster and the result, then give them the git and `gh` commands the publish script printed. They run them.

## What the gallery rejects

- network calls or outside addresses;
- `eval` or `new Function`;
- frames, cookies, or reaching the page around the figure;
- build imports other than the skill, the figure's own files and `node:fs`, `node:path`, `node:url`, `node:crypto` or `node:process`;
- reading environment variables;
- files other than source text under `src/`;
- pages that the build does not reproduce exactly.
Write figures that way from the start if the user plans to share them.
