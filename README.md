# NAVLE Study Lab

https://jcsegovia1.github.io/NAVLE-Test/
 
A dependency-free static study app generated from the comprehensive NAVLE question bank.

## What is included

- 5,350 multiple-choice questions
- Species/section study pools
- Weighted mixed NAVLE sessions
- Study mode with immediate feedback
- Exam mode with grading at the end
- 20 / 50 / 100 / 200-question sessions
- No duplicate questions within a session
- Missed-question review
- Local progress tracking with `localStorage`
- Question data split into separate JSON files so the browser does not load all 5,350 questions at once

## Deploy on GitHub Pages

1. Create a new GitHub repository.
2. Upload the **contents of this folder** to the repository root.
3. In GitHub, open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select your main branch and `/ (root)`, then save.
6. GitHub will provide the public Pages URL.

No build step, npm, framework, database, or server is required.

## Local preview

Because the app loads JSON with `fetch()`, do not just double-click `index.html`.
From the folder, run one of these:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Structure

- `index.html` — app shell
- `styles.css` — interface styling
- `app.js` — quiz/session/progress logic
- `data/index.json` — section metadata
- `data/*.json` — questions split by section
- `.nojekyll` — tells GitHub Pages to serve files directly

## Notes

Progress is stored only in the browser. Clearing site data or using another device/browser starts fresh.
