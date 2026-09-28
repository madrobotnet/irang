# URL capture transport audit

Date: 2026-09-27

## Finding

The previous capture path resolved a hostname in `validateDestination`, checked every returned address, and then passed the original hostname to global `fetch`. The fetch implementation performed its own DNS resolution before opening the socket. An attacker controlling DNS could therefore return a public address for validation and a private address for the connection (DNS rebinding).

## Transport design

`fetchUrlText` now carries the complete validated address list into a Node-compatible HTTP(S) transport. For each connection attempt, `requestPinned` installs a lookup callback that returns only one already validated IP address. It does not invoke DNS. If a validated address cannot be reached, the transport tries the next validated address, preserving dual-stack and multi-address reliability without opening an unchecked resolution path.

The request URL is not rewritten to an IP literal:

- HTTP retains the original `Host` header, including a non-default port.
- HTTPS explicitly sets TLS `servername` to the original hostname and leaves certificate verification enabled.
- Redirects remain manual. Each redirect URL goes through protocol, userinfo, hostname, and resolved-address validation before another request is made.
- No cookies or other inbound request headers are forwarded. The only application header is `Accept`.

The public boundary still rejects non-HTTP(S) URLs, URL userinfo, blocked local names, IP literals in private/reserved ranges, failed or empty DNS answers, and a hostname if any returned address is unsafe.

## Resource bounds and failure behavior

The 10-second abort signal now covers DNS validation, connection establishment, and response body reading. A caller-provided signal follows the same path. Response bodies are canceled on redirects, HTTP errors, unsupported content types, declared oversize content, streamed content exceeding 256 KiB, and aborts. Redirects remain capped at four.

URL capture persistence is unchanged: the inbox row and original URL are stored before enrichment. A resolution, transport, timeout, content, or extraction failure replaces the pending marker with the visible failure message; it does not remove the capture.

## Regression evidence

`src/server/inbox/url.test.ts` exercises observable boundaries and transport behavior:

- private/reserved DNS answers never reach transport;
- transport receives the validated addresses, and a redirect to a private answer is rejected before a second request;
- a loopback test server confirms the socket peer is the pinned address while `Host` remains the original hostname;
- a TLS test confirms the original SNI and first proves that an untrusted certificate is rejected, then succeeds only after adding the test CA;
- DNS validation aborts deterministically when the request signal fires;
- streamed oversize and in-progress aborted bodies close the server-side socket.

`src/server/inbox/service.test.ts` retains the database-backed regression that capture text and URL survive transport failure.
