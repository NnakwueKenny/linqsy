# QA Checklist Template

## Environment

- host OS:
- client device/browser:
- network conditions:

## Host Startup

- `linqsy start` launches successfully
- browser opens automatically (unless disabled)
- waiting page shows QR, URL, code

## Session Join

- client joins with valid code/url
- presence updates for join/leave are accurate
- reconnect flow restores correct state

## Transfer Flow

- upload succeeds for host
- upload succeeds for client
- download succeeds for recipient
- progress/status transitions are correct
- cancellation behavior is correct

## Failure Handling

- invalid join code handled cleanly
- disconnected network state handled cleanly
- failed transfer state is clear and recoverable

## Cleanup

- session end removes temp files
- stale/orphan cleanup works on restart

## UI/UX

- mobile layout remains usable
- loading/empty/error states render correctly
- accessibility checks for focus and labels pass
