# Redline

A private, browser-based document comparison tool. Compare pasted text or Word documents, display changes in a Microsoft Word-style redline, copy the result as Markdown, or convert an existing tracked-changes `.docx` directly to Markdown.

## Features

- Compare pasted text or two `.docx` files
- Word-style inline insertions and deletions
- Convert Word Track Changes to Markdown
- Copy insertions as `**bold**` and deletions as `~~strikethrough~~`
- Local browser processing; document contents are not uploaded
- 10 MB file limit and bounded extracted text/XML processing
- Strict browser and Vercel security headers
- Weekly Dependabot dependency checks

See [PRIVACY.md](./PRIVACY.md) for the data flow, technical safeguards, limitations, and verification procedure.

## Local development

Requires Node.js 22.13 or later.

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

## Production build

```bash
pnpm build
```

The project uses Next.js static export. It can be deployed directly to Vercel with the default settings, or to Cloudflare Pages with `pnpm build` as the build command and `out` as the output directory.

Every build runs `pnpm privacy:check`. The build fails if application source code contains a prohibited outbound-network API. A browser Content Security Policy also sets `connect-src 'none'`, blocking runtime connections initiated by the page.
