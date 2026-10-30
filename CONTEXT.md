# Stash

Stash saves things for later and makes them findable again. This glossary covers how it is run as well as what it holds.

## Language

**Instance**:
One running deployment of stash with its own database. Instances know nothing about each other.
_Avoid_: Server, tenant, site

**Operator**:
The person who runs an instance. Anyone may be one; the code is open source.
_Avoid_: Admin, host, self-hoster

**Owner**:
The one account on an instance that manages invite codes. Often the operator's own account, but the two are different things: an operator acts on the deployment, an Owner acts inside the app.
_Avoid_: Admin, superuser

**Invite code**:
A single-use code that lets one person create an account on an instance. The first one on a new instance is the setup code, and redeeming it makes that person the Owner.
_Avoid_: Invitation, signup token
