'use strict';

const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const matter = require('gray-matter');
const { marked } = require('marked');
const sanitizeHtml = require('sanitize-html');

const app = express();
const PORT = process.env.PORT || 3000;
const POSTS_DIR = path.join(__dirname, 'posts');

app.use(express.urlencoded({ extended: false }));

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;

function slugify(title) {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

// Resolves a slug to a file path, refusing anything outside POSTS_DIR.
function postPath(slug) {
  if (!SLUG_RE.test(slug)) return null;
  const file = path.join(POSTS_DIR, `${slug}.md`);
  if (path.dirname(file) !== POSTS_DIR) return null;
  return file;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

function renderMarkdown(md) {
  return sanitizeHtml(marked.parse(md), {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2']),
    allowedAttributes: {
      a: ['href', 'title'],
      img: ['src', 'alt', 'title'],
      code: ['class']
    },
    allowedSchemes: ['http', 'https', 'mailto']
  });
}

async function readPost(slug) {
  const file = postPath(slug);
  if (!file) return null;
  let raw;
  try {
    raw = await fs.readFile(file, 'utf8');
  } catch {
    return null;
  }
  const { data, content } = matter(raw);
  return {
    slug,
    title: typeof data.title === 'string' ? data.title : slug,
    author: typeof data.author === 'string' ? data.author : '',
    date: data.date ? new Date(data.date) : null,
    content
  };
}

async function listPosts() {
  let files;
  try {
    files = await fs.readdir(POSTS_DIR);
  } catch {
    return [];
  }
  const slugs = files
    .filter((f) => f.endsWith('.md'))
    .map((f) => path.basename(f, '.md'))
    .filter((s) => SLUG_RE.test(s));

  const posts = (await Promise.all(slugs.map(readPost))).filter(Boolean);
  posts.sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
  return posts;
}

function formatDate(date) {
  return date ? date.toISOString().slice(0, 10) : '';
}

function layout(title, body) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 16px/1.6 system-ui, sans-serif; max-width: 44rem; margin: 0 auto; padding: 2rem 1rem; }
  header { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid #8884; padding-bottom: .5rem; margin-bottom: 2rem; }
  header a { text-decoration: none; }
  h1 { margin: 0 0 .25rem; font-size: 1.5rem; }
  ul.posts { list-style: none; padding: 0; }
  ul.posts li { margin-bottom: 1.25rem; }
  time { opacity: .65; font-size: .85rem; }
  pre { background: #8881; padding: .75rem; overflow-x: auto; border-radius: 6px; }
  blockquote { border-left: 3px solid #8886; margin-left: 0; padding-left: 1rem; opacity: .85; }
  label { display: block; margin-bottom: 1rem; }
  input, textarea { width: 100%; padding: .5rem; font: inherit; box-sizing: border-box; }
  textarea { min-height: 16rem; font-family: ui-monospace, monospace; }
  button { padding: .5rem 1rem; font: inherit; cursor: pointer; }
  .error { color: #c00; }
</style>
</head>
<body>
<header>
  <a href="/"><strong>Markdown Blog</strong></a>
  <a href="/new">New post</a>
</header>
${body}
</body>
</html>`;
}

app.get('/', async (req, res) => {
  const posts = await listPosts();
  const items = posts.length
    ? `<ul class="posts">${posts
        .map(
          (p) => `<li>
      <a href="/posts/${encodeURIComponent(p.slug)}"><strong>${escapeHtml(p.title)}</strong></a><br>
      <time>${escapeHtml(formatDate(p.date))}</time>${p.author ? ` &middot; ${escapeHtml(p.author)}` : ''}
    </li>`
        )
        .join('')}</ul>`
    : '<p>No posts yet. <a href="/new">Write the first one.</a></p>';

  res.send(layout('Markdown Blog', `<h1>Posts</h1>${items}`));
});

app.get('/new', (req, res) => {
  res.send(layout('New post', renderForm()));
});

function renderForm(values = {}, error = '') {
  return `<h1>New post</h1>
${error ? `<p class="error">${escapeHtml(error)}</p>` : ''}
<form method="post" action="/new">
  <label>Title
    <input name="title" required maxlength="120" value="${escapeHtml(values.title || '')}">
  </label>
  <label>Author
    <input name="author" maxlength="80" value="${escapeHtml(values.author || '')}">
  </label>
  <label>Content (Markdown)
    <textarea name="content" required>${escapeHtml(values.content || '')}</textarea>
  </label>
  <button type="submit">Publish</button>
</form>`;
}

app.post('/new', async (req, res) => {
  const title = String(req.body.title || '').trim();
  const author = String(req.body.author || '').trim();
  const content = String(req.body.content || '').trim();

  if (!title || !content) {
    return res.status(400).send(layout('New post', renderForm(req.body, 'Title and content are required.')));
  }

  const slug = slugify(title);
  const file = postPath(slug);
  if (!file) {
    return res
      .status(400)
      .send(layout('New post', renderForm(req.body, 'Title must contain some letters or numbers.')));
  }

  const front = `---\ntitle: ${JSON.stringify(title)}\n${author ? `author: ${JSON.stringify(author)}\n` : ''}date: ${new Date().toISOString().slice(0, 10)}\n---\n\n`;

  try {
    // 'wx' fails if the post already exists, so we never overwrite.
    await fs.writeFile(file, front + content + '\n', { flag: 'wx' });
  } catch (err) {
    if (err.code === 'EEXIST') {
      return res
        .status(409)
        .send(layout('New post', renderForm(req.body, `A post named "${slug}" already exists.`)));
    }
    throw err;
  }

  res.redirect(`/posts/${encodeURIComponent(slug)}`);
});

app.get('/posts/:slug', async (req, res) => {
  const post = await readPost(req.params.slug);
  if (!post) {
    return res.status(404).send(layout('Not found', '<h1>404</h1><p>That post does not exist.</p>'));
  }
  res.send(
    layout(
      post.title,
      `<article>
  <h1>${escapeHtml(post.title)}</h1>
  <time>${escapeHtml(formatDate(post.date))}</time>${post.author ? ` &middot; ${escapeHtml(post.author)}` : ''}
  ${renderMarkdown(post.content)}
</article>
<p><a href="/">&larr; All posts</a></p>`
    )
  );
});

app.use((req, res) => {
  res.status(404).send(layout('Not found', '<h1>404</h1><p>Page not found.</p>'));
});

app.listen(PORT, () => {
  console.log(`Blog running at http://localhost:${PORT}`);
});
