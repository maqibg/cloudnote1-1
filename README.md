# CloudNote

CloudNote 是一个基于 **Cloudflare Workers + D1 + KV + R2** 的云笔记应用。

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/maqibg/cloudnote)

当前仓库已经收口为：

- **单部署模型**：Cloudflare Workers
- **单主语言**：TypeScript
- **单主框架**：Hono

## 功能

- 动态路径笔记：直接通过 `/{path}` 创建和访问笔记
- 富文本编辑器：前台页面保留原有编辑 UI
- 锁定模式：支持限制访问和限制编辑
- 管理后台：
  - 登录鉴权
  - 统计卡片
  - 搜索与分页
  - 新建、编辑、删除笔记
  - 导入、导出、备份
  - 查看操作日志
- 健康检查：`/health`

## 目录

```text
cloudnote/
  src/
    config.ts
    index.ts
    middleware/
    routes/
    services/
    types.ts
    utils/
  schema.sql
  wrangler.toml
  worker-configuration.d.ts
  DEVELOPMENT.md
```

说明：

- `src/routes/` 只负责 HTTP 装配
- `src/services/` 负责后台与笔记业务逻辑
- `src/utils/` 放纯 TypeScript 工具函数
- `schema.sql` 是 D1 结构真相源

## 开发命令

```bash
npm install
npm run generate-types
npm run typecheck
npm test
npm run dev
```

现有脚本：

```bash
npm run dev            # wrangler dev
npm run db:init        # 初始化远程 D1
npm run deploy         # 先部署并创建/绑定资源，再初始化数据库
npm run generate-types # 生成 worker-configuration.d.ts
npm run typecheck      # wrangler types + tsc --noEmit
npm test               # vitest run
npm run test:watch     # vitest
npm run format         # prettier --write .
```

## 配置

### Wrangler

[wrangler.toml](D:\Code\codeSpace\cloudnote\wrangler.toml) 定义：

- Worker 入口：`src/index.ts`
- `compatibility_date`
- `nodejs_compat`
- D1 绑定：`DB`
- KV 绑定：`CACHE`
- R2 绑定：`STORAGE`

### 环境变量

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `JWT_SECRET`
- `PATH_MIN_LENGTH`
- `PATH_MAX_LENGTH`
- `RATE_LIMIT_PER_MINUTE`
- `SESSION_DURATION`

本地开发可参考 `.dev.vars.example`。

## 数据职责

- `D1`：笔记正文、锁定状态、浏览量、管理日志
- `KV`：缓存与速率限制计数
- `R2`：导出与备份文件

## 部署

### 一键部署

直接点击顶部 `Deploy to Cloudflare` 按钮即可。

按钮流程会基于仓库里的 [wrangler.toml](D:\Code\codeSpace\cloudnote\wrangler.toml) 和 [package.json](D:\Code\codeSpace\cloudnote\package.json)：

- 自动创建并绑定 `D1 / KV / R2`
- 提示填写 `ADMIN_USERNAME / ADMIN_PASSWORD / JWT_SECRET`
- 使用当前仓库代码完成 Workers 部署
- 在资源绑定可用后执行 `db:init`

如果需要手动部署，再按下面的命令执行。

1. 安装依赖
2. 配置 Cloudflare 资源绑定
3. 设置 secrets
4. 初始化数据库
5. 部署

```bash
npm install
npm run generate-types
npm run deploy
```

## 开发说明

详细开发约束、架构边界和迁移后规范见：

- [DEVELOPMENT.md](D:\Code\codeSpace\cloudnote\DEVELOPMENT.md)

## 验证建议

提交前至少执行：

```bash
npm run generate-types
npm run typecheck
npm test
```
