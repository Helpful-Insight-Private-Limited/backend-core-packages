# @rohit-jain11/rbac

[![npm version](https://img.shields.io/npm/v/@rohit-jain11/rbac.svg)](https://www.npmjs.com/package/@rohit-jain11/rbac)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

Enterprise Role-Based Access Control (RBAC) and Attribute-Based Access Control (ABAC) engine for **Node.js, Express, and Prisma**. Features **Role Inheritance & Hierarchy**, **Wildcard matching** (`*`, `users:*`), **Dynamic Contextual Rules** (e.g. document ownership), Express route guards, and Prisma database adapters.

---

## 🌟 Key Features

* 👑 **Hierarchical Role Inheritance**:
  * Roles can inherit from other roles (e.g. `editor` inherits from `viewer`, `admin` inherits from `editor`).
  * Circular dependency detection and resolution.
* 🃏 **Deep Wildcard Permission Matching**:
  * Global wildcard: `*` (grants access to everything).
  * Segment wildcard: `users:*` (grants `users:read`, `users:write`, `users:delete`).
  * Multi-segment support: `billing:invoices:*`.
* 🧠 **Dynamic ABAC Contextual Rules**:
  * Static permissions aren't always enough (e.g., "Users can edit posts ONLY if they are the author").
  * Register async/sync rules like `isOwner`, `isDepartmentMember`, `isBusinessHours`.
* 🛡️ **Express Route Guards**:
  * Declarative middleware guards: `guard.requirePermission('users:delete')`, `guard.requireRole('admin')`, `guard.requireRule('isOwner')`.
  * Returns standard HTTP 403 Forbidden with structured problem details.
* 🗄️ **Prisma Database Sync**:
  * Load and synchronize roles, permissions, and user assignments directly from Prisma models.

---

## 📦 Installation

```bash
# npm
npm install @rohit-jain11/rbac

# pnpm
pnpm add @rohit-jain11/rbac

# yarn
yarn add @rohit-jain11/rbac
```

---

## 🚀 Quick Start

```typescript
import { RbacEngine } from '@rohit-jain11/rbac';

// 1. Initialize RBAC with role hierarchy
const rbac = new RbacEngine([
  {
    name: 'viewer',
    permissions: ['posts:read', 'comments:read']
  },
  {
    name: 'editor',
    permissions: ['posts:create', 'posts:update'],
    inherits: ['viewer'] // inherits posts:read & comments:read
  },
  {
    name: 'admin',
    permissions: ['*'] // global wildcard
  }
]);

// 2. Check user permissions
const editorUser = { id: 'u_1', roles: ['editor'] };

console.log(rbac.canUser(editorUser, 'posts:read'));   // true (inherited from viewer)
console.log(rbac.canUser(editorUser, 'posts:create')); // true (direct permission)
console.log(rbac.canUser(editorUser, 'users:delete')); // false

const adminUser = { id: 'u_2', roles: ['admin'] };
console.log(rbac.canUser(adminUser, 'billing:invoices:destroy')); // true (wildcard *)
```

---

## 🧠 Dynamic ABAC (Ownership & Context)

When permissions depend on runtime attributes (e.g., resource author, department, or time):

```typescript
// Register an ABAC ownership rule
rbac.registerRule('isPostAuthor', ({ user, resource }) => {
  return user.id === resource.authorId;
});

// Evaluate rule
const canEdit = await rbac.evaluateRule('isPostAuthor', {
  user: { id: 'user_100' },
  resource: { id: 'post_42', authorId: 'user_100' }
});

console.log(canEdit); // true
```

---

## 🌐 Express Route Guard Integration

Protect your Express endpoints cleanly with `RbacGuard`:

```typescript
import express from 'express';
import { RbacEngine, RbacGuard } from '@rohit-jain11/rbac';

const app = express();
app.use(express.json());

const rbac = new RbacEngine([
  { name: 'member', permissions: ['articles:read'] },
  { name: 'moderator', permissions: ['articles:delete'], inherits: ['member'] }
]);

const guard = new RbacGuard({ engine: rbac });

// 1. Require static permission (supports wildcards)
app.delete(
  '/api/articles/:id',
  guard.requirePermission('articles:delete'),
  (req, res) => {
    res.json({ message: 'Article deleted' });
  }
);

// 2. Require role directly
app.get(
  '/api/admin/metrics',
  guard.requireRole('admin'),
  (req, res) => {
    res.json({ status: 'ok' });
  }
);

// 3. Require dynamic ABAC rule
app.put(
  '/api/articles/:id',
  guard.requireRule(async ({ user, req }) => {
    // Check if user owns the article
    const article = await getArticleById(req.params.id);
    return article.authorId === user.id;
  }),
  (req, res) => {
    res.json({ message: 'Article updated' });
  }
);
```

#### Denied Response (HTTP 403 Forbidden):
```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "User lacks required permission: articles:delete"
  }
}
```

---

## 🗄️ Prisma Database Schema

```prisma
model Role {
  id          String           @id @default(uuid())
  name        String           @unique
  description String?
  inherits    String?          // Comma-separated list of inherited role names
  permissions RolePermission[]
  users       UserRole[]
}

model Permission {
  id          String           @id @default(uuid())
  name        String           @unique // e.g. "users:delete", "posts:*"
  roles       RolePermission[]
}

model RolePermission {
  roleId       String
  permissionId String
  role         Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission   Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  @@id([roleId, permissionId])
}

model UserRole {
  userId String
  roleId String
  role   Role   @relation(fields: [roleId], references: [id], onDelete: Cascade)

  @@id([userId, roleId])
}
```

---

## 📄 License

MIT © [Rohit Jain](https://github.com/Rohit-Jain11)
