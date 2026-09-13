# NAVLE Study Lab

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
