# Web Portal UI

## Run
- `npm run dev -w @sme/web-portal`

## Port
- `http://localhost:3102`

## School self-registration
- `http://localhost:3102/register-school`

## Login prerequisites
- Use a user mapped with IAM role `PARENT` and `PORTAL_VIEW` permission.
- Current auth endpoint issues token by email; password field is accepted in UI but ignored by backend for now.
