# Evertas MGA Dashboard

## Auth

### Bootstrapping first user

```bash
# swap for prod url
curl -X POST 'http://127.0.0.1:54321/auth/v1/admin/users' \
  -H "apikey: $SECRET_KEY" -H "Authorization: Bearer $SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"example@company.com","password":"...","email_confirm":true}'
```

TODO: add computed column for all `id` fields that use bigint -> cast to string (`id_str`)
