# Environment Server

WebSocket host for remote `GameEnvironment` execution.

## Scope

- Hosts multiple concurrent environment instances
- Accepts JSON `RemoteEnvironmentRequest` payloads
- Returns JSON `RemoteEnvironmentResponse` payloads
- Primary runtime target: `bomberman26`

`n64wasm` is intentionally rejected in this Node host because it still depends on a browser/WebGL execution environment.

## Default Port

`4315`

Override with:

```bash
BOMBERMAN65_ENV_SERVER_PORT=5001
```
