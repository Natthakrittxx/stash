# Stash

Stash saves things for later and makes them findable again. This glossary covers how it is run as well as what it holds.

## Language

**Instance**:
One running deployment of stash with its own data. Instances know nothing about each other, even when they share a PostgreSQL server, or a database with other apps.
_Avoid_: Server, tenant, site

**Operator**:
The person who runs an instance. Anyone may be one; the code is open source.
_Avoid_: Admin, host, self-hoster

**Owner**:
The one account on an instance that manages invite codes: whoever signed up first. Often the operator's own account, but the two are different things: an operator acts on the deployment, an Owner acts inside the app.
_Avoid_: Admin, superuser

**Invite code**:
A single-use code that lets one person create an account on an instance. Everyone but the first person needs one.
_Avoid_: Invitation, signup token

**Second factor**:
A one-time code, from an authenticator app or a backup code, that an account holder who has turned it on must give after signing in with a password or Google.
_Avoid_: MFA, 2FA

**Passkey**:
A credential held on an account holder's device or password manager that signs them in on its own, with no password and no second factor.
_Avoid_: WebAuthn credential, security key
