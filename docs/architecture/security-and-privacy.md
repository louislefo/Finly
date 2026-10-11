# Security & Privacy

Privacy is the primary design requirement of Finly. This document details the cryptographic protections, authentication models, and privacy enforcement mechanisms implemented throughout the system.

---

## 1. Local Credential Encryption

Banking credentials and sensitive session parameters are stored locally in the SQLite database using **AES-256 Fernet symmetric cryptography** (part of Python's `cryptography` library):

- **Algorithm**: AES in CBC mode with a 128-bit initialization vector (IV) using PKCS7 padding.
- **Integrity & Authentication**: HMAC-SHA256 signature verification over the ciphertext, IV, and timestamp.
- **Key Derivation**: The encryption key is derived deterministically from the application `SECRET_KEY` using SHA-256, ensuring that credentials cannot be decrypted if the database file is extracted without the application secret.

```
Plaintext Credential -> AES-256-CBC Encrypt -> HMAC-SHA256 Sign -> Stored Ciphertext
```

---

## 2. Password Hashing & Authentication

- **Hashing Standard**: User passwords are saved using **bcrypt** with a salt round workload factor of 12. Plaintext passwords are never logged, cached in memory, or stored in SQLite.
- **Token Generation**: Upon successful authentication, the backend issues an **HMAC-SHA256 signed JSON Web Token (JWT)** containing the user identifier (`sub`), email, and an expiration timestamp (default: 7 days).
- **Stateless Verification**: Every API request is authenticated via an HTTP `Authorization: Bearer <token>` header, verified by FastAPI's `get_current_user` dependency.

---

## 3. Role-Based Access Control (RBAC)

Finly enforces strict privilege separation between standard accounts and administrators:

| Permission | Member Role (`member`) | Administrator (`admin`) |
| :--- | :---: | :---: |
| View and manage own bank accounts and transactions | Yes | Yes |
| Configure custom categorization and merchant rules | Yes | Yes |
| Use AI Assistant and financial vector search | Yes | Yes |
| Access Global System Metrics & Database Stats | No | Yes |
| Execute SQLite VACUUM optimization | No | Yes |
| Trigger global background sync across all connections | No | Yes |
| View all registered users and manage active status | No | Yes |
| Seed multi-month demo datasets | No | Yes |
| Impersonate user sessions for debugging | No | Yes |

### Secure Impersonation Tokens

When an administrator inspects an issue on another user's dashboard, the backend generates a short-lived token stamped with `impersonated_by: <admin_id>`. This allows the administrator to view the user's dashboard in a read-only perspective without learning the user's underlying password.

---

## 4. Privacy Blur Mode

To allow users to view their dashboard in public spaces (such as offices, trains, or cafes) without displaying private account balances to bystanders, Finly includes a client-side **Privacy Context**:

- **Activation**: Toggled via the top navigation eye icon or the global keyboard shortcut (`Alt + P` or `Option + P`).
- **CSS-Level Masking**: Monetary figures, balances, and transaction amounts are obscured using CSS filter blurs (`filter: blur(8px)`) while maintaining layout geometry.
- **Local Persistence**: The user's privacy preference is stored in local storage and applied before first render to prevent layout flash.

---

## 5. Zero Telemetry & Network Isolation

- **No Third-Party Analytics**: No Google Analytics, Segment, Sentry, or Facebook Pixel scripts are included in the frontend build.
- **Self-Contained Fonts & Assets**: Fonts (Inter, JetBrains Mono) are loaded locally or pre-cached, and merchant icons are bundled directly within the application package.
- **Direct Banking Network Flow**: Connections to bank servers are initiated directly from the user's host over standard TLS 1.3. Finly does not relay, route, or inspect these requests through central servers.
