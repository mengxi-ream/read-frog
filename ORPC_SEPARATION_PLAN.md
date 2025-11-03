# oRPC Contract-Implementation 分离方案

## 目录

- [方案概述](#方案概述)
- [架构设计](#架构设计)
- [详细实施步骤](#详细实施步骤)
- [代码示例](#代码示例)
- [开发流程](#开发流程)
- [常见问题](#常见问题)

---

## 方案概述

### 核心思想

利用 oRPC 的 **Contract-First** 开发模式，将 API 的类型定义（Contract）和业务实现（Implementation）分离：

- **Contract（公开）**：定义 API 的输入输出类型、路由信息，提交到公开仓库
- **Implementation（私有）**：包含真实的业务逻辑、数据库操作等，存储在私有仓库

### 优势

✅ 前端保持完整的类型安全
✅ 开源用户可以看到 API 结构但无法访问实现
✅ 内部开发者可以独立开发后端
✅ 测试环境可以连接到实际后端
✅ 符合 SOLID 原则（依赖倒置）

---

## 架构设计

### 仓库结构

```
公开仓库: github.com/your-org/read-frog
├── packages/
│   ├── orpc-contract/              # ✅ 提交到 Git（公开）
│   │   ├── src/
│   │   │   ├── routers/
│   │   │   │   ├── planet.ts       # Planet API Contract
│   │   │   │   ├── user.ts         # User API Contract
│   │   │   │   └── index.ts
│   │   │   └── index.ts            # 导出所有 contracts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── orpc/                       # ❌ 在 .gitignore 中（私有）
│       ├── src/
│       │   ├── router/             # 实现 contract
│       │   ├── middlewares/        # 中间件
│       │   └── index.ts
│       └── package.json
│
├── apps/
│   ├── extension/                  # 使用 @repo/orpc-contract
│   └── website/                    # 使用 @repo/orpc-contract
│
└── .gitignore                      # 添加 packages/orpc

私有仓库: github.com/your-org/read-frog-backend (私有)
└── packages/orpc/                  # 完整的后端实现
    ├── src/
    │   ├── router/
    │   │   ├── planet.ts           # 实现 planet contract
    │   │   ├── user.ts             # 实现 user contract
    │   │   └── index.ts
    │   ├── middlewares/
    │   │   ├── db.ts
    │   │   ├── auth.ts
    │   │   └── retry.ts
    │   ├── orpc.ts                 # 配置 middleware
    │   └── index.ts                # 导出 router
    ├── package.json
    └── tsconfig.json
```

---

## 详细实施步骤

### Step 1: 创建 Contract 包

#### 1.1 创建包结构

```bash
mkdir -p packages/orpc-contract/src/routers
cd packages/orpc-contract
pnpm init
```

#### 1.2 配置 `package.json`

```json
{
  "name": "@repo/orpc-contract",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "@orpc/contract": "^0.x.x",
    "@orpc/server": "^0.x.x",
    "zod": "^3.x.x"
  }
}
```

#### 1.3 定义 Contract

**`packages/orpc-contract/src/routers/planet.ts`**

```typescript
import { oc } from '@orpc/contract'
import z from 'zod'

// 定义数据模型 Schema
const PlanetSchema = z.object({
  id: z.number().int().min(1),
  name: z.string(),
  description: z.string().optional(),
})

// 定义 Planet Router Contract
export const planetContract = {
  list: oc
    .route({
      method: 'GET',
      path: '/planets',
      summary: 'List all planets',
      tags: ['Planets'],
    })
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).optional(),
        cursor: z.number().int().min(0).default(0),
      }),
    )
    .output(
      z.object({
        planets: z.array(PlanetSchema),
        nextCursor: z.number().optional(),
      }),
    ),

  find: oc
    .route({
      method: 'GET',
      path: '/planets/{id}',
      summary: 'Find a planet by ID',
      tags: ['Planets'],
    })
    .input(
      z.object({
        id: z.number().int().min(1),
      }),
    )
    .output(PlanetSchema),

  create: oc
    .route({
      method: 'POST',
      path: '/planets',
      summary: 'Create a new planet',
      tags: ['Planets'],
    })
    .input(PlanetSchema.omit({ id: true }))
    .output(PlanetSchema),
}
```

**`packages/orpc-contract/src/routers/index.ts`**

```typescript
import { planetContract } from './planet'

export const routerContract = {
  planet: planetContract,
}
```

**`packages/orpc-contract/src/index.ts`**

```typescript
export * from './routers'
export type { InferContractRouterInputs, InferContractRouterOutputs } from '@orpc/contract'
```

---

### Step 2: 重构现有实现以使用 Contract

#### 2.1 修改私有仓库的实现

**私有仓库: `packages/orpc/src/orpc.ts`**

```typescript
import { os } from '@orpc/server'
import { implement } from '@orpc/server'
import { routerContract } from '@repo/orpc-contract' // 引用 contract
import { dbProviderMiddleware } from './middlewares/db'
import { authMiddleware } from './middlewares/auth'

// 创建基础 procedure builder
export const pub = os.use(dbProviderMiddleware)

// 创建需要认证的 procedure builder
export const authed = pub.use(authMiddleware)

// 创建 contract implementer
export const contractImpl = implement(routerContract)
```

**私有仓库: `packages/orpc/src/router/planet.ts`**

```typescript
import { contractImpl, pub, authed } from '../orpc'
import { retry } from '../middlewares/retry'

// 实现 list procedure
export const listPlanet = contractImpl.planet.list
  .use(retry({ times: 3 }))
  .handler(async ({ input, context }) => {
    const { limit = 50, cursor } = input
    const db = context.db

    const planets = await db.query.planets.findMany({
      limit: limit + 1,
      offset: cursor,
    })

    const hasMore = planets.length > limit
    const items = hasMore ? planets.slice(0, -1) : planets

    return {
      planets: items,
      nextCursor: hasMore ? cursor + limit : undefined,
    }
  })

// 实现 find procedure
export const findPlanet = contractImpl.planet.find
  .handler(async ({ input, context }) => {
    const db = context.db
    const planet = await db.query.planets.findFirst({
      where: (planets, { eq }) => eq(planets.id, input.id),
    })

    if (!planet) {
      throw new Error('Planet not found')
    }

    return planet
  })

// 实现 create procedure（需要认证）
export const createPlanet = contractImpl.planet.create
  .handler(async ({ input, context }) => {
    const db = context.db
    const user = context.user // 从 auth middleware 获取

    const [planet] = await db
      .insert(planets)
      .values({
        name: input.name,
        description: input.description,
        createdBy: user.id,
      })
      .returning()

    return planet
  })
```

**私有仓库: `packages/orpc/src/index.ts`**

```typescript
import { listPlanet, findPlanet, createPlanet } from './router/planet'

export const router = {
  planet: {
    list: listPlanet,
    find: findPlanet,
    create: createPlanet,
  },
}

export type Router = typeof router
```

---

### Step 3: 配置前端使用 Contract

#### 3.1 在 Website 中使用

**`apps/website/src/orpc/orpc.ts`**

```typescript
import type { ContractRouterClient } from '@orpc/contract'
import type { routerContract } from '@repo/orpc-contract'
import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import { BatchLinkPlugin } from '@orpc/client/plugins'
import { WEBSITE_DEV_PORT } from '@repo/definitions'
import { ORPC_PREFIX } from './constant'

function getBaseUrl() {
  if (typeof window !== 'undefined')
    return window.location.origin
  if (process.env.VERCEL_URL)
    return `https://${process.env.VERCEL_URL}`
  return `http://localhost:${process.env.PORT ?? WEBSITE_DEV_PORT}`
}

const link = new RPCLink({
  url: `${getBaseUrl()}${ORPC_PREFIX}`,
  plugins: [
    new BatchLinkPlugin({
      groups: [
        {
          condition: () => true,
          context: {},
        },
      ],
    }),
  ],
})

// 使用 Contract 而不是实际的 Router
export const client: ContractRouterClient<typeof routerContract>
  = createORPCClient(link)
```

#### 3.2 在 Extension 中使用

**`apps/extension/src/utils/orpc/client.ts`**

```typescript
import type { ContractRouterClient } from '@orpc/contract'
import type { routerContract } from '@repo/orpc-contract'
import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'

const link = new RPCLink({
  url: import.meta.env.VITE_API_URL || 'https://your-production-api.com/rpc',
  headers: () => ({
    authorization: `Bearer ${getToken()}`,
  }),
})

export const client: ContractRouterClient<typeof routerContract>
  = createORPCClient(link)
```

---

### Step 4: 配置 Git 和开发流程

#### 4.1 更新 `.gitignore`

**根目录 `.gitignore`**

```gitignore
# ... 其他规则

# Private backend implementation
packages/orpc/
```

#### 4.2 创建内部开发者设置脚本

**`scripts/setup-backend.sh`**

```bash
#!/bin/bash

# 检查是否已经存在 orpc 包
if [ -d "packages/orpc" ]; then
  echo "Backend package already exists. Pulling latest changes..."
  cd packages/orpc
  git pull
  cd ../..
else
  echo "Cloning backend package from private repository..."

  # 克隆私有仓库的 orpc 包
  git clone git@github.com:your-org/read-frog-backend.git temp-backend

  # 移动到正确位置
  mv temp-backend/packages/orpc packages/orpc

  # 清理临时文件
  rm -rf temp-backend

  echo "Backend package cloned successfully!"
fi

# 安装依赖
echo "Installing dependencies..."
pnpm install

echo "Setup complete! You can now run 'pnpm dev' to start development."
```

**`scripts/setup-backend.bat`** (Windows)

```bat
@echo off

if exist "packages\orpc" (
  echo Backend package already exists. Pulling latest changes...
  cd packages\orpc
  git pull
  cd ..\..
) else (
  echo Cloning backend package from private repository...

  git clone git@github.com:your-org/read-frog-backend.git temp-backend

  move temp-backend\packages\orpc packages\orpc

  rmdir /s /q temp-backend

  echo Backend package cloned successfully!
)

echo Installing dependencies...
pnpm install

echo Setup complete! You can now run 'pnpm dev' to start development.
```

#### 4.3 更新 README

**添加到 `README.md`**

```markdown
## For Internal Developers

If you need to work on the backend implementation:

1. Clone the backend package:
   ```bash
   # Unix/Mac
   ./scripts/setup-backend.sh

   # Windows
   scripts\setup-backend.bat
   ```

2. The backend implementation will be available at `packages/orpc/` but won't be committed to the public repository.

3. To push backend changes:
   ```bash
   cd packages/orpc
   git add .
   git commit -m "your message"
   git push
   ```
```

---

## 开发流程

### 内部开发者工作流

#### 首次设置

```bash
# 1. 克隆公开仓库
git clone git@github.com:your-org/read-frog.git
cd read-frog

# 2. 设置后端包
./scripts/setup-backend.sh

# 3. 安装依赖
pnpm install
```

#### 日常开发

**修改 Contract（API 接口变更）**

```bash
# 1. 在 packages/orpc-contract/ 中修改 contract
vim packages/orpc-contract/src/routers/planet.ts

# 2. 同时在 packages/orpc/ 中实现新的 contract
vim packages/orpc/src/router/planet.ts

# 3. 提交 contract 到公开仓库
git add packages/orpc-contract/
git commit -m "feat(orpc): add new planet filter API"
git push origin main

# 4. 提交 implementation 到私有仓库
cd packages/orpc
git add .
git commit -m "feat: implement planet filter API"
git push origin main
cd ../..
```

**只修改 Implementation（业务逻辑优化）**

```bash
# 1. 修改实现
vim packages/orpc/src/router/planet.ts

# 2. 只提交到私有仓库
cd packages/orpc
git add .
git commit -m "perf: optimize planet query performance"
git push origin main
cd ../..
```

### 开源贡献者工作流

开源贡献者克隆公开仓库后：

```bash
git clone git@github.com:your-org/read-frog.git
cd read-frog
pnpm install
```

他们可以：
- ✅ 看到完整的 API 类型定义
- ✅ 开发前端功能（连接到测试服务器）
- ✅ 运行 extension 和 website
- ❌ 无法看到后端实现细节

---

## 代码示例

### 前端使用示例

**在 React 组件中使用**

```typescript
import { client } from '@/orpc/orpc'

export function PlanetList() {
  const [planets, setPlanets] = useState([])

  useEffect(() => {
    // 完全类型安全的调用
    client.planet.list({ limit: 10, cursor: 0 })
      .then(result => {
        setPlanets(result.planets) // 类型推断正确
      })
  }, [])

  return (
    <div>
      {planets.map(planet => (
        <div key={planet.id}>{planet.name}</div>
      ))}
    </div>
  )
}
```

### 生成 OpenAPI 文档

**`packages/orpc-contract/scripts/generate-openapi.ts`**

```typescript
import fs from 'node:fs'
import { OpenAPIGenerator } from '@orpc/openapi'
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4'
import { routerContract } from '../src'

const generator = new OpenAPIGenerator({
  schemaConverters: [new ZodToJsonSchemaConverter()],
})

// 从 Contract 生成 OpenAPI spec
const spec = await generator.generateFromContract(routerContract, {
  info: {
    title: 'Read Frog API',
    version: '1.0.0',
    description: 'Public API documentation for Read Frog',
  },
  servers: [
    {
      url: 'https://api.read-frog.com',
      description: 'Production server',
    },
    {
      url: 'https://staging-api.read-frog.com',
      description: 'Staging server',
    },
  ],
})

fs.writeFileSync(
  './openapi.json',
  JSON.stringify(spec, null, 2)
)

console.log('OpenAPI spec generated successfully!')
```

运行生成：

```bash
cd packages/orpc-contract
pnpm tsx scripts/generate-openapi.ts
```

这个 OpenAPI 文档可以：
- 公开发布，让第三方了解 API
- 用于生成其他语言的 SDK
- 导入到 Postman/Insomnia 进行测试

---

## 常见问题

### Q1: 如果开源贡献者想要本地运行完整的后端怎么办？

**方案 A: 提供 Mock Server**

创建一个基于 contract 的 mock server：

**`packages/orpc-contract/mock-server.ts`**

```typescript
import { createMockServer } from '@orpc/mock'
import { routerContract } from './src'

const mockServer = createMockServer(routerContract, {
  planet: {
    list: async ({ input }) => ({
      planets: [
        { id: 1, name: 'Earth', description: 'Our home planet' },
        { id: 2, name: 'Mars', description: 'The red planet' },
      ],
      nextCursor: undefined,
    }),
    find: async ({ input }) => ({
      id: input.id,
      name: 'Mock Planet',
      description: 'This is a mock planet',
    }),
    create: async ({ input }) => ({
      id: Math.floor(Math.random() * 1000),
      ...input,
    }),
  },
})

mockServer.listen(3000, () => {
  console.log('Mock API server running on http://localhost:3000')
})
```

**方案 B: 提供公开测试服务器**

在 `.env.example` 中：

```bash
# Use public test server (limited rate)
VITE_API_URL=https://test-api.read-frog.com/rpc

# Or use mock server locally
# VITE_API_URL=http://localhost:3000/rpc
```

### Q2: 如何确保 Contract 和 Implementation 保持同步？

**使用 CI 检查**

在私有仓库中添加 CI：

```yaml
# .github/workflows/contract-sync.yml
name: Contract Sync Check

on: [push, pull_request]

jobs:
  check-contract:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Install dependencies
        run: pnpm install

      - name: Type check implementation
        run: pnpm type-check

      # 这将确保 implementation 正确实现了 contract
      - name: Build
        run: pnpm build
```

### Q3: 如何管理版本一致性？

在 `packages/orpc/package.json` 中：

```json
{
  "dependencies": {
    "@repo/orpc-contract": "workspace:*"
  }
}
```

使用 workspace protocol 确保始终使用 monorepo 中的最新 contract。

### Q4: 前端开发时如何调试 API？

**开发模式下的代理配置**

**`apps/website/next.config.mjs`**

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    if (process.env.NODE_ENV === 'development') {
      return [
        {
          source: '/api/rpc/:path*',
          destination: process.env.API_PROXY_URL || 'http://localhost:3001/api/rpc/:path*',
        },
      ]
    }
    return []
  },
}
```

### Q5: 能否为不同环境提供不同的后端实现？

可以！Contract 是统一的，可以有多个实现：

```
私有仓库结构:
└── packages/
    ├── orpc/              # 生产环境实现
    ├── orpc-staging/      # 测试环境实现（可能包含 debug 功能）
    └── orpc-local/        # 本地开发实现（使用本地数据库）
```

---

## 总结

### 这个方案的优势

1. **类型安全**: 前端完全类型安全，不丢失任何类型信息
2. **安全性**: 业务逻辑和敏感实现不暴露在公开仓库
3. **开发体验**: 内部开发者可以独立开发前后端
4. **开源友好**: 贡献者可以看到完整的 API 定义
5. **可测试性**: 可以轻松创建 mock server 进行测试
6. **文档自动化**: 从 contract 自动生成 OpenAPI 文档

### 注意事项

1. 确保 `.gitignore` 正确配置，避免意外提交私有代码
2. 在 CI 中添加检查，确保不会提交 `packages/orpc/`
3. 为开源贡献者提供清晰的测试服务器或 mock server
4. 定期同步 contract 和 implementation 的版本

### 下一步行动

1. 创建 `packages/orpc-contract/` 包
2. 将现有实现迁移到使用 contract
3. 设置私有仓库
4. 配置 `.gitignore` 和开发脚本
5. 更新文档和 README
6. 测试完整的开发流程
