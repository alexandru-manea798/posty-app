# Contributing to Posty App

Thanks for your interest in contributing a post or improvement!

## Adding a new post

You can add a post either through the running app or by hand.

### Option 1: Use the "New post" form

1. Start the app: `npm start`
2. Open `http://localhost:3000/new`
3. Fill in a title and Markdown content, then submit.

The app will slugify your title, add front matter (`title` and `date`), and
save the post to `posts/<slug>.md`.

### Option 2: Add a Markdown file directly

1. Create a new file in `posts/` named `your-post-slug.md`. The slug must:
   - be lowercase
   - use only letters, numbers, and hyphens
   - start with a letter or number
2. Add front matter at the top of the file:

   ```markdown
   ---
   title: "Your Post Title"
   date: 2026-08-18
   ---

   Your Markdown content goes here.
   ```

3. Save the file. It will show up automatically on the home page, sorted by
   date (newest first).

## Style guidelines

- Keep titles short and descriptive.
- Use standard Markdown (headings, lists, code blocks, links). It is rendered
  and sanitized automatically.
- Prefer relative dates in `YYYY-MM-DD` format for the front matter `date`.

## Local setup

```bash
npm install
npm start
```

Then visit `http://localhost:3000`.

## Submitting changes

1. Create a branch off `main`.
2. Make your changes (new post, docs, or code).
3. Open a pull request describing what you added or changed.
