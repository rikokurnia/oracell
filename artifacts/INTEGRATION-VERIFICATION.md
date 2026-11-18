# Signed-feed frontend integration

- Read `services/aggregator/INTEGRATION_NOTES.md`, SDK exports and implementation, and the Rust core verifier before documenting the protocol.
- The frontend adapter accepted all four feeds from the running aggregator: CKB/USDT, BTC/USDT, ETH/USDT, SOL/USDT.
- Browser checks covered live values, source counts, anchor heights, real timestamps, pair search, and ascending/descending price sorting.
- Disconnecting the aggregator retained the last received prices with a connection notice.
- Reloading with the aggregator stopped rendered the supported catalog with unavailable prices and no invented values.
- Documentation search includes payload fields and verifier error names; section anchors and the SDK example match the real exports.
- Seven automated checks cover response shape, unsupported/malformed data, exact decimal formatting, empty catalogs, timestamp ages, and hosted URL policy.
- Root frontend typechecking and linting exclude the separately configured service, SDK, and Rust workspaces.
- Typecheck and production build passed with the aggregator stopped. No build-time API connection is required.
- Protected source-file hashes in services/, packages/, and contracts/ were checked against their pre-integration values.

Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` from the project root. Configure a publicly reachable HTTPS `NEXT_PUBLIC_ORACELL_AGGREGATOR_URL` before a hosted frontend build.
