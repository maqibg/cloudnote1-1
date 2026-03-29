# CloudNote 开发文档

## 1. 当前架构

CloudNote 现在是一个 **纯 Workers 单部署仓库**：

- 运行时：Cloudflare Workers
- 语言：TypeScript
- 框架：Hono
- 存储：D1 + KV + R2

仓库中不再保留 Node 自托管实现，也不再维护第二套业务逻辑。

## 2. 开发原则

- Workers 是唯一运行时真相
- TypeScript 是唯一主语言
- 业务逻辑只允许存在一份
- 路由只做请求解析与响应装配
- 服务层负责核心业务规则
- D1/KV/R2 的职责必须清晰分离

## 3. 目录职责

```text
src/
  config.ts
  index.ts
  middleware/
  routes/
  services/
  types.ts
  utils/
```

职责约定：

- `src/index.ts`：应用装配与全局中间件
- `src/routes/`：HTTP 路由
- `src/services/`：笔记与后台业务逻辑
- `src/utils/`：纯工具函数
- `src/types.ts`：共享类型和运行时接口
- `schema.sql`：数据库结构真相源

## 4. 绑定约定

当前绑定名固定为：

- `DB`
- `CACHE`
- `STORAGE`

环境变量：

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `JWT_SECRET`
- `PATH_MIN_LENGTH`
- `PATH_MAX_LENGTH`
- `RATE_LIMIT_PER_MINUTE`
- `SESSION_DURATION`

## 5. 路由概览

### 前台

- `GET /`
- `GET /:path`
- `GET /api/note/:path`
- `POST /api/note/:path`
- `POST /api/note/:path/unlock`
- `POST /api/note/:path/lock`
- `DELETE /api/note/:path/lock`
- `GET /api/generate-path`

### 后台

- `GET /admin`
- `GET /admin/dashboard`
- `POST /admin/login`
- `POST /admin/api/login`
- `GET /admin/stats`
- `GET /admin/api/stats`
- `GET /admin/notes`
- `GET /admin/api/notes`
- `GET /admin/notes/:path`
- `GET /admin/api/note/:path`
- `POST /admin/notes`
- `POST /admin/api/notes`
- `PUT /admin/notes/:path`
- `PUT /admin/api/note/:path`
- `DELETE /admin/notes/:path`
- `DELETE /admin/api/note/:path`
- `GET /admin/export`
- `POST /admin/api/export`
- `POST /admin/backup`
- `POST /admin/api/backup`
- `POST /admin/import`
- `POST /admin/api/import`
- `GET /admin/logs`
- `GET /admin/api/logs`

### 其他

- `GET /health`

## 6. 数据职责

- D1：
  - 笔记正文
  - 锁定状态
  - 浏览量
  - 管理日志
- KV：
  - 热点笔记缓存
  - 速率限制计数
- R2：
  - 导出文件
  - 备份文件

## 7. 类型与校验

Cloudflare 官方当前推荐使用 `wrangler types` 生成运行时类型。

要求：

1. 修改 `wrangler.toml` 后立即执行 `npm run generate-types`
2. 保持 [worker-configuration.d.ts](D:\Code\codeSpace\cloudnote\worker-configuration.d.ts) 最新
3. 提交前执行 `npm run typecheck`

## 8. 本地开发

```bash
npm install
npm run generate-types
npm run typecheck
npm test
npm run dev
```

数据库初始化：

```bash
npm run db:init
```

## 9. 后台功能要求

后台页面必须持续保留以下能力：

- 登录
- 统计卡片
- 搜索
- 分页
- 新建笔记
- 编辑笔记
- 删除笔记
- 导入
- 导出
- 备份
- 操作日志查看

后续改 UI 时，上述能力不允许被删掉。

## 10. 提交前检查

至少执行：

```bash
npm run generate-types
npm run typecheck
npm test
```

如果改动涉及：

- `wrangler.toml`
- `src/types.ts`
- `src/config.ts`
- `schema.sql`
- `src/routes/admin.ts`
- `src/services/*.ts`

必须额外做一次人工 smoke test。

## 11. 禁止事项

- 不再新增第二套运行时实现
- 不再引入 Node 兼容壳
- 不再把业务逻辑写回路由层
- 不在没有证据的情况下引入 Rust/Wasm 主模块
- 不让导出、备份、锁定、管理台能力回退
