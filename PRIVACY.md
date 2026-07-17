# Privacy architecture

## Summary

Redline is a static, browser-based application. Pasted text and selected Word documents are processed in the user's browser. The application does not intentionally transmit, persist, or share document contents.

## Document data flow

1. The browser gives the page temporary access to a file selected by the user.
2. The page reads the file into browser memory with `File.arrayBuffer()`.
3. Mammoth extracts ordinary Word text in browser memory. JSZip and `DOMParser` read tracked changes in browser memory.
4. The comparison and Markdown conversion run in browser memory.
5. If the user clicks **Copy Markdown**, the result is written to the operating system clipboard.
6. Refreshing or closing the page discards the application's in-memory state.

The application does not use a document database, server upload endpoint, cookies, `localStorage`, `sessionStorage`, or IndexedDB.

## Technical safeguards

- `pnpm privacy:check` statically scans application source directories for common outbound-network APIs, including `fetch`, XMLHttpRequest, WebSocket, EventSource, `sendBeacon`, Axios, Node HTTP clients, and network sockets.
- `prebuild` runs that check automatically. Vercel and local production builds fail when the scan finds a prohibited API.
- The page's Content Security Policy contains `connect-src 'none'`, instructing compatible browsers to block Fetch, XMLHttpRequest, WebSocket, EventSource, and beacon connections at runtime.
- Vercel responses add CSP and defense-in-depth headers that prevent framing, MIME sniffing, referrer leakage, and access to unnecessary browser capabilities.
- Word files are limited to 10 MB, extracted text to 2 million characters, and tracked-change XML to 5 million characters to reduce browser freezes and resource-exhaustion risk.
- Dependabot checks npm dependencies weekly and proposes updates through GitHub pull requests.
- The application is statically exported and has no application server or API route handling documents.

## Hosting metadata

The hosting provider can receive ordinary request metadata needed to serve the website, such as IP address, requested URL, timestamp, user agent, and operational logs. That is separate from document contents; the application code does not place document text or files into those requests.

## Limitations

These safeguards cover this application's source and browser behavior, but cannot control browser extensions, device-management or security software, clipboard managers, malware, hosting-account configuration, or later code changes. The static scan is a guardrail, not a formal proof: deliberately obscured network code or a newly introduced networking mechanism may require the checker to be updated.

The CSP permits inline scripts because the current Next.js static export uses inline hydration data. Outbound connections remain prohibited by `connect-src 'none'`.

## Verification

1. Run `pnpm privacy:check` and `pnpm build` before deployment.
2. In browser developer tools, clear the Network panel, select a non-confidential test document, and perform a comparison. Confirm that the operation creates no request containing document contents.
3. After the initial page load, switch developer tools to Offline mode and repeat the comparison. Document selection, comparison, conversion, and Markdown generation should continue to work.
4. In the Application panel, inspect Local Storage, Session Storage, IndexedDB, and Cookies and confirm that the application has not stored document contents.
5. Repeat these checks after material dependency, hosting, or application changes.
