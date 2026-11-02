# Supabase database certificate

`supabase-prod-ca-2021.crt` is Supabase's public root CA, downloaded from:

https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt

SHA-256 fingerprint: `80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`.

The certificate expires on 26 April 2031. Next.js includes it in each server route's deployment files. Supabase PostgreSQL URLs can use `sslmode=verify-full&sslrootcert=certs%2Fsupabase-prod-ca-2021.crt` for certificate and hostname verification without a computer-specific path. This file contains no private key or application credentials.
