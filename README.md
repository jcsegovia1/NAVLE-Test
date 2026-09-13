# NAVLE Study Lab — completion-first version

Static GitHub Pages study app for the 5,350-question NAVLE bank.

## New study behavior

- A question is **completed the first time you answer it correctly**.
- Completed questions are removed from normal future Study, Exam, and Mixed NAVLE sessions.
- Questions answered incorrectly remain active.
- At the end of a session, **Retry missed** creates a test using only the missed questions.
- If you miss questions again, another retry round is offered. This continues until the retry set is fully cleared.
- Every section card shows **remaining**, **completed**, and a visible completion progress bar.
- Fully cleared sections show **Complete ✓** and offer optional **Review completed** or **Reset section** actions.
- Mixed NAVLE sessions preserve the approximate species weighting, using only questions that remain active.
- Existing progress from the previous version is migrated automatically: any question you had already answered correctly is treated as completed.

## Replace files in your existing GitHub repo

For the upgrade, overwrite these files from this package:

- `app.js`
- `styles.css`
- `index.html`
- `data/index.json`

The individual question JSON files are unchanged, but the full package includes them too for convenience.

Commit/push the changes. `index.html` includes `?v=2` cache-busting on the CSS and JS links, which helps Safari and GitHub Pages load the new version immediately.

## Progress storage

Progress still uses browser `localStorage` under the existing key `navle-study-lab-v1`, so replacing the files does **not** intentionally wipe your existing saved progress.
