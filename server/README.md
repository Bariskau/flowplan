# FlowPlan Signal Worker

Cloudflare Worker + Durable Object signaling server for FlowPlan P2P collaboration.

Current scope:

- room/session signaling
- host/join validation via room secret
- WebSocket presence broadcast
- offer/answer/ICE relay
- host disconnect room teardown
- duplicate-session rejection
- participant cap per room
- oversized signal payload rejection

This server does **not** carry plan data. Actual plan sync stays peer-to-peer over WebRTC.

## Local development

```bash
cd server
npm install
npm run dev
```

The Worker will listen on:

- `http://127.0.0.1:3320/health`
- `ws://127.0.0.1:3320/signal`

This matches FlowPlan's current local default.

## Deploy to Cloudflare

1. Log in to Cloudflare:

```bash
npx wrangler login
```

2. Deploy:

```bash
npm run deploy
```

3. Use the deployed endpoint in FlowPlan:

```text
wss://<your-worker>.<your-subdomain>.workers.dev/signal
```

## Notes

- Each room is one Durable Object instance keyed by `roomId`.
- Room lifetime is ephemeral. If the host disconnects, the room is closed.
- Join secrets must be at least 8 characters.
- Default room cap is 12 peers.
