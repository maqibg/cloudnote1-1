import { Context, Hono } from 'hono';
import { requireAuth } from '../middleware/auth';
import {
  createBackup,
  createNoteByPath,
  getAdminStats,
  getNoteByPath,
  deleteNoteByPath,
  exportNotes,
  importNotes,
  listAdminLogs,
  listNotes,
  loginAdmin,
  updateNoteByPath,
} from '../services/admin';
import type { AppEnv, ImportRequest, LoginRequest } from '../types';

const admin = new Hono<AppEnv>();

admin.get('/', async (c) => {
  return c.html(getAdminLoginHTML());
});

admin.get('/dashboard', async (c) => {
  return c.html(getAdminDashboardHTML());
});

function getListQuery(c: Context<AppEnv>) {
  return {
    page: Number.parseInt(c.req.query('page') || '1', 10),
    limit: Number.parseInt(c.req.query('limit') || '20', 10),
    search: c.req.query('search') || '',
  };
}

async function handleLogin(c: Context<AppEnv>) {
  const body = await c.req.json<LoginRequest>();
  const result = await loginAdmin(c.env, body);
  return c.json(result.body, result.status);
}

admin.post('/login', handleLogin);
admin.post('/api/login', handleLogin);

async function handleStats(c: Context<AppEnv>) {
  const result = await getAdminStats(c.env);
  return c.json(result.body, result.status);
}

admin.get('/stats', requireAuth, handleStats);
admin.get('/api/stats', requireAuth, handleStats);

async function handleListNotes(c: Context<AppEnv>) {
  const result = await listNotes(c.env, getListQuery(c));
  return c.json(result.body, result.status);
}

admin.get('/notes', requireAuth, handleListNotes);
admin.get('/api/notes', requireAuth, handleListNotes);

async function handleGetNote(c: Context<AppEnv>) {
  const result = await getNoteByPath(c.env, c.req.param('path'));
  return c.json(result.body, result.status);
}

admin.get('/notes/:path', requireAuth, handleGetNote);
admin.get('/api/note/:path', requireAuth, handleGetNote);

async function handleDeleteNote(c: Context<AppEnv>) {
  const result = await deleteNoteByPath(c.env, c.req.param('path'));
  return c.json(result.body, result.status);
}

admin.delete('/notes/:path', requireAuth, handleDeleteNote);
admin.delete('/api/note/:path', requireAuth, handleDeleteNote);

async function handleUpdateNote(c: Context<AppEnv>) {
  const body = await c.req.json<{
    content?: string;
    is_locked?: boolean;
    lock_type?: 'read' | 'write';
    password?: string;
  }>();
  const result = await updateNoteByPath(c.env, c.req.param('path'), body);
  return c.json(result.body, result.status);
}

admin.put('/notes/:path', requireAuth, handleUpdateNote);
admin.put('/api/note/:path', requireAuth, handleUpdateNote);

async function handleCreateNote(c: Context<AppEnv>) {
  const body = await c.req.json<{
    path: string;
    content?: string;
    is_locked?: boolean;
    lock_type?: 'read' | 'write';
    password?: string;
  }>();
  const result = await createNoteByPath(c.env, body);
  return c.json(result.body, result.status);
}

admin.post('/notes', requireAuth, handleCreateNote);
admin.post('/api/notes', requireAuth, handleCreateNote);

async function handleExport(c: Context<AppEnv>) {
  const result = await exportNotes(c.env);
  return c.json(result.body, result.status);
}

admin.get('/export', requireAuth, handleExport);
admin.post('/api/export', requireAuth, handleExport);

async function handleBackup(c: Context<AppEnv>) {
  const result = await createBackup(c.env);
  return c.json(result.body, result.status);
}

admin.post('/backup', requireAuth, handleBackup);
admin.post('/api/backup', requireAuth, handleBackup);

async function handleImport(c: Context<AppEnv>) {
  const body = await c.req.json<ImportRequest>();
  const result = await importNotes(c.env, body);
  return c.json(result.body, result.status);
}

admin.post('/import', requireAuth, handleImport);
admin.post('/api/import', requireAuth, handleImport);

async function handleLogs(c: Context<AppEnv>) {
  const result = await listAdminLogs(c.env);
  return c.json(result.body, result.status);
}

admin.get('/logs', requireAuth, handleLogs);
admin.get('/api/logs', requireAuth, handleLogs);

function getAdminLoginHTML(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Login - CloudNote</title>
  <style>
    /* CSS变量 - 设计系统 */
    :root {
      --primary-color: #2563eb;
      --primary-hover: #1d4ed8;
      --secondary-color: #6b7280;
      --success-color: #10b981;
      --error-color: #ef4444;
      --warning-color: #f59e0b;
      --bg-color: #ffffff;
      --bg-secondary: #f8fafc;
      --text-primary: #1f2937;
      --text-secondary: #6b7280;
      --text-muted: #9ca3af;
      --border-color: #e5e7eb;
      --spacing-xs: 0.25rem;
      --spacing-sm: 0.5rem;
      --spacing-md: 1rem;
      --spacing-lg: 1.5rem;
      --spacing-xl: 2rem;
      --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
      --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
      --border-radius: 8px;
      --font-family-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    }
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body { 
      font-family: var(--font-family-sans);
      font-size: 14px;
      line-height: 1.5;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .login-container {
      background: var(--bg-color);
      padding: var(--spacing-xl);
      border-radius: var(--border-radius);
      box-shadow: var(--shadow-lg);
      width: 100%;
      max-width: 400px;
      animation: slideUp 0.3s ease;
    }
    
    @keyframes slideUp {
      from {
        transform: translateY(20px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }
    
    .login-header {
      text-align: center;
      margin-bottom: var(--spacing-xl);
    }
    
    .logo {
      font-size: 24px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: var(--spacing-xs);
    }
    
    .subtitle {
      color: var(--text-secondary);
      font-size: 14px;
    }
    
    .form-group {
      margin-bottom: var(--spacing-md);
    }
    
    label {
      display: block;
      margin-bottom: var(--spacing-xs);
      color: var(--text-primary);
      font-size: 13px;
      font-weight: 500;
    }
    
    input {
      width: 100%;
      padding: var(--spacing-sm) var(--spacing-md);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      font-size: 14px;
      transition: all 0.2s ease;
      background: var(--bg-color);
    }
    
    input:focus {
      outline: none;
      border-color: var(--primary-color);
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
    }
    
    button {
      width: 100%;
      padding: var(--spacing-sm) var(--spacing-md);
      background: var(--primary-color);
      color: white;
      border: none;
      border-radius: var(--border-radius);
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      margin-top: var(--spacing-lg);
    }
    
    button:hover {
      background: var(--primary-hover);
      transform: translateY(-1px);
    }
    
    .error {
      color: var(--error-color);
      margin-top: var(--spacing-md);
      text-align: center;
      font-size: 13px;
      display: none;
    }
    
    @media (max-width: 480px) {
      .login-container {
        margin: 1rem;
      }
    }
  </style>
</head>
<body>
  <div class="login-container">
    <div class="login-header">
      <h1 class="logo">CloudNote Admin</h1>
      <p class="subtitle">管理员登录</p>
    </div>
    <form id="loginForm">
      <div class="form-group">
        <label for="username">用户名</label>
        <input type="text" id="username" name="username" required autocomplete="username">
      </div>
      <div class="form-group">
        <label for="password">密码</label>
        <input type="password" id="password" name="password" required autocomplete="current-password">
      </div>
      <button type="submit">登录</button>
      <div class="error" id="error"></div>
    </form>
  </div>
  <script>
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;
      const errorDiv = document.getElementById('error');
      
      try {
        const response = await fetch('/admin/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
          localStorage.setItem('adminToken', data.token);
          window.location.href = '/admin/dashboard';
        } else {
          errorDiv.textContent = data.error || '登录失败';
          errorDiv.style.display = 'block';
        }
      } catch (error) {
        errorDiv.textContent = '网络错误';
        errorDiv.style.display = 'block';
      }
    });
  </script>
</body>
</html>`;
}

function getAdminDashboardHTML(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Dashboard - CloudNote</title>
  <style>
    /* CSS变量 - 设计系统 */
    :root {
      --primary-color: #2563eb;
      --primary-hover: #1d4ed8;
      --secondary-color: #6b7280;
      --success-color: #10b981;
      --error-color: #ef4444;
      --warning-color: #f59e0b;
      --bg-color: #ffffff;
      --bg-secondary: #f8fafc;
      --text-primary: #1f2937;
      --text-secondary: #6b7280;
      --text-muted: #9ca3af;
      --border-color: #e5e7eb;
      --spacing-xs: 0.25rem;
      --spacing-sm: 0.5rem;
      --spacing-md: 1rem;
      --spacing-lg: 1.5rem;
      --spacing-xl: 2rem;
      --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
      --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
      --border-radius: 8px;
      --font-family-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    }
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body { 
      font-family: var(--font-family-sans);
      font-size: 14px;
      line-height: 1.5;
      color: var(--text-primary);
      background: var(--bg-secondary);
    }
    
    /* 头部 */
    .header {
      background: var(--bg-color);
      padding: var(--spacing-md) var(--spacing-lg);
      box-shadow: var(--shadow-sm);
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    
    .header-left {
      display: flex;
      align-items: center;
      gap: var(--spacing-md);
    }
    
    .logo {
      font-size: 18px;
      font-weight: 600;
      color: var(--text-primary);
    }
    
    .header-right {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
    }
    
    /* 容器 */
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: var(--spacing-xl) var(--spacing-lg);
    }
    
    /* 统计卡片 */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: var(--spacing-md);
      margin-bottom: var(--spacing-xl);
    }
    
    .stat-card {
      background: var(--bg-color);
      padding: var(--spacing-lg);
      border-radius: var(--border-radius);
      box-shadow: var(--shadow-sm);
      transition: all 0.2s ease;
    }
    
    .stat-card:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-md);
    }
    
    .stat-label {
      color: var(--text-secondary);
      font-size: 12px;
      margin-bottom: var(--spacing-xs);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .stat-value {
      font-size: 28px;
      font-weight: 600;
      color: var(--text-primary);
    }
    
    .stat-icon {
      display: inline-block;
      margin-left: var(--spacing-xs);
      font-size: 20px;
    }
    
    /* 操作区 */
    .actions-card {
      background: var(--bg-color);
      padding: var(--spacing-lg);
      border-radius: var(--border-radius);
      box-shadow: var(--shadow-sm);
      margin-bottom: var(--spacing-xl);
    }
    
    .actions-header {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: var(--spacing-md);
      color: var(--text-primary);
    }
    
    .action-buttons {
      display: flex;
      gap: var(--spacing-sm);
      flex-wrap: wrap;
    }
    
    /* 按钮 */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--spacing-xs);
      padding: var(--spacing-sm) var(--spacing-md);
      font-size: 14px;
      font-weight: 500;
      border: 1px solid transparent;
      border-radius: var(--border-radius);
      cursor: pointer;
      transition: all 0.2s ease;
      text-decoration: none;
      white-space: nowrap;
      user-select: none;
      background: var(--bg-color);
      color: var(--text-primary);
      border-color: var(--border-color);
    }
    
    .btn:hover {
      background: var(--bg-secondary);
      transform: translateY(-1px);
    }
    
    .btn-primary {
      background: var(--primary-color);
      color: white;
      border-color: var(--primary-color);
    }
    
    .btn-primary:hover {
      background: var(--primary-hover);
      border-color: var(--primary-hover);
    }
    
    .btn-danger {
      background: var(--error-color);
      color: white;
      border-color: var(--error-color);
    }
    
    .btn-danger:hover {
      background: #dc2626;
      border-color: #dc2626;
    }
    
    .btn-small {
      padding: var(--spacing-xs) var(--spacing-sm);
      font-size: 12px;
    }
    
    /* 表格 */
    .table-card {
      background: var(--bg-color);
      border-radius: var(--border-radius);
      box-shadow: var(--shadow-sm);
      overflow: hidden;
    }
    
    .table-header {
      padding: var(--spacing-lg);
      border-bottom: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .table-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
    }
    
    .search-box {
      display: flex;
      gap: var(--spacing-sm);
    }
    
    .search-input {
      padding: var(--spacing-xs) var(--spacing-sm);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      font-size: 14px;
      width: 200px;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
    }
    
    th, td {
      padding: var(--spacing-md);
      text-align: left;
      border-bottom: 1px solid var(--border-color);
    }
    
    th {
      background: var(--bg-secondary);
      font-weight: 500;
      color: var(--text-secondary);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    td {
      font-size: 14px;
    }
    
    tr:hover {
      background: var(--bg-secondary);
    }
    
    /* 徽章 */
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;
      text-transform: uppercase;
    }
    
    .badge-locked {
      background: #fef3c7;
      color: #92400e;
    }
    
    .badge-open {
      background: #d4edda;
      color: #155724;
    }
    
    /* 加载器 */
    .spinner {
      width: 20px;
      height: 20px;
      border: 2px solid var(--border-color);
      border-top: 2px solid var(--primary-color);
      border-radius: 50%;
      animation: spin 1s linear infinite;
      display: inline-block;
    }
    
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    /* 消息提示 */
    .message {
      position: fixed;
      top: var(--spacing-lg);
      right: var(--spacing-lg);
      background: var(--success-color);
      color: white;
      padding: var(--spacing-md);
      border-radius: var(--border-radius);
      box-shadow: var(--shadow-md);
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
      z-index: 1500;
      max-width: 300px;
      animation: slideIn 0.3s ease;
    }
    
    .message.error {
      background: var(--error-color);
    }

    .modal {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.45);
      display: none;
      align-items: center;
      justify-content: center;
      padding: var(--spacing-lg);
      z-index: 1200;
    }

    .modal.show {
      display: flex;
    }

    .modal-card {
      width: min(720px, 100%);
      background: var(--bg-color);
      border-radius: var(--border-radius);
      box-shadow: var(--shadow-lg);
      overflow: hidden;
    }

    .modal-header {
      padding: var(--spacing-lg);
      border-bottom: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .modal-body {
      padding: var(--spacing-lg);
      display: grid;
      gap: var(--spacing-md);
    }

    .modal-footer {
      padding: var(--spacing-lg);
      border-top: 1px solid var(--border-color);
      display: flex;
      justify-content: flex-end;
      gap: var(--spacing-sm);
    }

    .form-grid {
      display: grid;
      gap: var(--spacing-md);
    }

    .form-row {
      display: grid;
      gap: var(--spacing-xs);
    }

    .form-label {
      font-size: 13px;
      color: var(--text-secondary);
      font-weight: 500;
    }

    .form-input,
    .form-select,
    .form-textarea {
      width: 100%;
      padding: var(--spacing-sm);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      font: inherit;
      background: var(--bg-color);
    }

    .form-textarea {
      min-height: 220px;
      resize: vertical;
    }

    .checkbox-row {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
    }

    .pagination {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: var(--spacing-xs);
      margin-top: var(--spacing-md);
      flex-wrap: wrap;
    }

    .page-btn {
      padding: 6px 10px;
      border-radius: 6px;
      border: 1px solid var(--border-color);
      background: var(--bg-color);
      cursor: pointer;
    }

    .page-btn.active {
      background: var(--primary-color);
      border-color: var(--primary-color);
      color: #fff;
    }

    .page-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .logs-box {
      background: #0f172a;
      color: #e2e8f0;
      border-radius: var(--border-radius);
      padding: var(--spacing-md);
      font-family: Consolas, 'Courier New', monospace;
      font-size: 12px;
      line-height: 1.6;
      max-height: 360px;
      overflow: auto;
      white-space: pre-wrap;
      word-break: break-word;
    }
    
    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    
    /* 响应式 */
    @media (max-width: 768px) {
      .container {
        padding: var(--spacing-md);
      }
      
      .stats-grid {
        grid-template-columns: 1fr;
      }
      
      .action-buttons {
        flex-direction: column;
      }
      
      .action-buttons .btn {
        width: 100%;
      }
      
      .table-header {
        flex-direction: column;
        gap: var(--spacing-md);
      }
      
      .search-input {
        width: 100%;
      }
      
      table {
        font-size: 12px;
      }
      
      th, td {
        padding: var(--spacing-sm);
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h1 class="logo">CloudNote Admin</h1>
    </div>
    <div class="header-right">
      <button class="btn btn-small" onclick="refreshData()">
        刷新数据
      </button>
      <button class="btn btn-small" onclick="logout()">
        退出登录
      </button>
    </div>
  </div>
  
  <div class="container">
    <!-- 统计卡片 -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">总笔记数</div>
        <div class="stat-value">
          <span id="totalNotes">0</span>
          <span class="stat-icon">📄</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">锁定笔记</div>
        <div class="stat-value">
          <span id="lockedNotes">0</span>
          <span class="stat-icon">🔒</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">总访问量</div>
        <div class="stat-value">
          <span id="totalViews">0</span>
          <span class="stat-icon">👁️</span>
        </div>
      </div>
    </div>
    
    <!-- 操作区 -->
    <div class="actions-card">
      <h2 class="actions-header">批量操作</h2>
      <div class="action-buttons">
        <button class="btn" onclick="openCreateModal()">
          新建笔记
        </button>
        <button class="btn btn-primary" onclick="exportNotes()">
          导出所有笔记
        </button>
        <button class="btn" onclick="showImportDialog()">
          导入笔记
        </button>
        <button class="btn" onclick="createBackup()">
          创建备份
        </button>
        <button class="btn" onclick="viewLogs()">
          查看操作日志
        </button>
      </div>
    </div>
    
    <!-- 笔记列表 -->
    <div class="table-card">
      <div class="table-header">
        <h2 class="table-title">笔记列表</h2>
        <div class="search-box">
          <input type="text" class="search-input" placeholder="搜索路径或内容..." id="searchInput" oninput="handleSearchInput()">
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>路径</th>
            <th>状态</th>
            <th>访问量</th>
            <th>创建时间</th>
            <th>更新时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody id="notesTableBody">
          <tr>
            <td colspan="6" style="text-align: center; padding: 2rem;">
              <div class="spinner"></div>
              <div style="margin-top: 1rem;">加载中...</div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="pagination" id="pagination"></div>
  </div>

  <div class="modal" id="editorModal">
    <div class="modal-card">
      <div class="modal-header">
        <h2 id="editorModalTitle">编辑笔记</h2>
        <button class="btn btn-small" onclick="closeEditorModal()">关闭</button>
      </div>
      <div class="modal-body">
        <div class="form-grid">
          <div class="form-row">
            <label class="form-label" for="editorPath">路径</label>
            <input id="editorPath" class="form-input" />
          </div>
          <div class="form-row">
            <label class="form-label" for="editorContent">内容</label>
            <textarea id="editorContent" class="form-textarea"></textarea>
          </div>
          <div class="checkbox-row">
            <input type="checkbox" id="editorLocked" onchange="toggleEditorLockFields()" />
            <label for="editorLocked">锁定笔记</label>
          </div>
          <div id="editorLockFields" style="display:none;">
            <div class="form-row">
              <label class="form-label" for="editorLockType">锁定类型</label>
              <select id="editorLockType" class="form-select">
                <option value="write">限制编辑</option>
                <option value="read">限制访问</option>
              </select>
            </div>
            <div class="form-row">
              <label class="form-label" for="editorPassword">密码</label>
              <input id="editorPassword" type="password" class="form-input" placeholder="创建时必填，编辑时留空表示保留原密码" />
            </div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn" onclick="closeEditorModal()">取消</button>
        <button class="btn btn-primary" onclick="saveEditorNote()">保存</button>
      </div>
    </div>
  </div>

  <div class="modal" id="logsModal">
    <div class="modal-card">
      <div class="modal-header">
        <h2>操作日志</h2>
        <button class="btn btn-small" onclick="closeLogsModal()">关闭</button>
      </div>
      <div class="modal-body">
        <div id="logsBox" class="logs-box">加载中...</div>
      </div>
    </div>
  </div>
   
  <script>
    const token = localStorage.getItem('adminToken');
    if (!token) {
      window.location.href = '/admin';
    }
    
    let allNotes = [];
    let currentPage = 1;
    let totalPages = 1;
    let currentSearch = '';
    let editorMode = 'edit';
    let editingPath = '';
    let searchTimer = null;
    
    async function fetchStats() {
      try {
        const response = await fetch('/admin/api/stats', {
          headers: {
            'Authorization': 'Bearer ' + token
          }
        });

        if (response.status === 401) {
          localStorage.removeItem('adminToken');
          window.location.href = '/admin';
          return;
        }

        if (!response.ok) {
          throw new Error('Failed to fetch stats');
        }

        const stats = await response.json();
        document.getElementById('totalNotes').textContent = stats.total_notes || 0;
        document.getElementById('lockedNotes').textContent = stats.locked_notes || 0;
        document.getElementById('totalViews').textContent = stats.total_views || 0;
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    }

    async function fetchNotes(page = currentPage) {
      try {
        currentPage = page;
        const query = new URLSearchParams({
          page: String(currentPage),
          limit: '20',
          search: currentSearch
        });

        const response = await fetch('/admin/api/notes?' + query.toString(), {
          headers: {
            'Authorization': 'Bearer ' + token
          }
        });
        
        if (!response.ok) {
          if (response.status === 401) {
            localStorage.removeItem('adminToken');
            window.location.href = '/admin';
          }
          throw new Error('Failed to fetch notes');
        }
        
        const data = await response.json();
        allNotes = data.notes;
        totalPages = data.totalPages || 1;
        displayNotes(data.notes);
        renderPagination();
      } catch (error) {
        console.error('Error fetching notes:', error);
        showMessage('加载笔记失败', 'error');
      }
    }
    
    function displayNotes(notes) {
      const tbody = document.getElementById('notesTableBody');
      
      if (notes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">暂无笔记</td></tr>';
        return;
      }
      
      tbody.innerHTML = notes.map(note => {
        const lockBadge = note.is_locked 
          ? '<span class="badge badge-locked">' + (note.lock_type === 'read' ? '访问锁定' : '编辑锁定') + '</span>'
          : '<span class="badge badge-open">开放</span>';
        
        return \`
          <tr>
            <td>
              <a href="/\${note.path}" target="_blank" style="color: var(--primary-color); text-decoration: none;">
                /\${note.path}
              </a>
            </td>
            <td>\${lockBadge}</td>
            <td>\${note.view_count}</td>
            <td>\${formatDate(note.created_at)}</td>
            <td>\${formatDate(note.updated_at)}</td>
            <td>
              <button class="btn btn-danger btn-small" onclick="deleteNote('\${note.path}')">
                删除
              </button>
              <button class="btn btn-small" onclick="openEditModal('\${note.path}')">
                编辑
              </button>
            </td>
          </tr>
        \`;
      }).join('');
    }
    
    function formatDate(dateStr) {
      const date = new Date(dateStr);
      return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    
    function renderPagination() {
      const container = document.getElementById('pagination');

      if (totalPages <= 1) {
        container.innerHTML = '';
        return;
      }

      const buttons = [];
      buttons.push('<button class="page-btn" onclick="fetchNotes(' + (currentPage - 1) + ')" ' + (currentPage === 1 ? 'disabled' : '') + '>上一页</button>');

      for (let page = 1; page <= totalPages; page++) {
        if (
          page === 1 ||
          page === totalPages ||
          (page >= currentPage - 2 && page <= currentPage + 2)
        ) {
          buttons.push('<button class="page-btn ' + (page === currentPage ? 'active' : '') + '" onclick="fetchNotes(' + page + ')">' + page + '</button>');
        } else if (page === currentPage - 3 || page === currentPage + 3) {
          buttons.push('<span>...</span>');
        }
      }

      buttons.push('<button class="page-btn" onclick="fetchNotes(' + (currentPage + 1) + ')" ' + (currentPage === totalPages ? 'disabled' : '') + '>下一页</button>');
      container.innerHTML = buttons.join('');
    }

    function handleSearchInput() {
      const value = document.getElementById('searchInput').value;
      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(() => {
        currentSearch = value;
        fetchNotes(1);
      }, 250);
    }
    
    async function deleteNote(path) {
      if (!confirm('确定要删除笔记 /' + path + ' 吗？此操作不可恢复。')) return;
      
      try {
        const response = await fetch('/admin/api/note/' + path, {
          method: 'DELETE',
          headers: {
            'Authorization': 'Bearer ' + token
          }
        });
        
        if (response.ok) {
          showMessage('笔记已删除', 'success');
          fetchNotes();
          fetchStats();
        } else {
          showMessage('删除失败', 'error');
        }
      } catch (error) {
        console.error('Error deleting note:', error);
        showMessage('删除失败', 'error');
      }
    }
    
    async function exportNotes() {
      try {
        const response = await fetch('/admin/api/export', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + token
          }
        });
        
        const data = await response.json();
        if (data.success) {
          const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = data.filename;
          a.click();
          showMessage('导出成功', 'success');
        }
      } catch (error) {
        console.error('Error exporting notes:', error);
        showMessage('导出失败', 'error');
      }
    }
    
    function showImportDialog() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const text = await file.text();
        const data = JSON.parse(text);
        
        try {
          const response = await fetch('/admin/api/import', {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer ' + token,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ notes: data.notes || data })
          });
          
          const result = await response.json();
          if (result.success) {
            showMessage(\`成功导入 \${result.imported} 条笔记，失败 \${result.failed} 条\`, 'success');
            fetchNotes();
            fetchStats();
          }
        } catch (error) {
        console.error('Error importing notes:', error);
        showMessage('导入失败', 'error');
      }
      };
      input.click();
    }
    
    async function viewLogs() {
      try {
        const response = await fetch('/admin/api/logs', {
          headers: {
            'Authorization': 'Bearer ' + token
          }
        });
        
        const data = await response.json();
        const logsText = (data.logs || []).map(log => {
          const prefix = '[' + formatDate(log.timestamp) + ']';
          const target = log.target_path ? ' /' + log.target_path : '';
          return prefix + ' ' + log.action + target + (log.details ? ' - ' + log.details : '');
        }).join('\n');
        document.getElementById('logsBox').textContent = logsText || '暂无日志';
        document.getElementById('logsModal').classList.add('show');
      } catch (error) {
        console.error('Error fetching logs:', error);
        showMessage('获取日志失败', 'error');
      }
    }

    function closeLogsModal() {
      document.getElementById('logsModal').classList.remove('show');
    }

    function openCreateModal() {
      editorMode = 'create';
      editingPath = '';
      document.getElementById('editorModalTitle').textContent = '新建笔记';
      document.getElementById('editorPath').value = '';
      document.getElementById('editorPath').readOnly = false;
      document.getElementById('editorContent').value = '';
      document.getElementById('editorLocked').checked = false;
      document.getElementById('editorLockType').value = 'write';
      document.getElementById('editorPassword').value = '';
      toggleEditorLockFields();
      document.getElementById('editorModal').classList.add('show');
    }

    async function openEditModal(path) {
      try {
        const response = await fetch('/admin/api/note/' + path, {
          headers: {
            'Authorization': 'Bearer ' + token
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch note');
        }

        const note = await response.json();
        editorMode = 'edit';
        editingPath = note.path;
        document.getElementById('editorModalTitle').textContent = '编辑笔记 /' + note.path;
        document.getElementById('editorPath').value = note.path;
        document.getElementById('editorPath').readOnly = true;
        document.getElementById('editorContent').value = note.content || '';
        document.getElementById('editorLocked').checked = !!note.is_locked;
        document.getElementById('editorLockType').value = note.lock_type || 'write';
        document.getElementById('editorPassword').value = '';
        toggleEditorLockFields();
        document.getElementById('editorModal').classList.add('show');
      } catch (error) {
        console.error('Error fetching note:', error);
        showMessage('加载笔记失败', 'error');
      }
    }

    function closeEditorModal() {
      document.getElementById('editorModal').classList.remove('show');
    }

    function toggleEditorLockFields() {
      document.getElementById('editorLockFields').style.display =
        document.getElementById('editorLocked').checked ? 'grid' : 'none';
    }

    async function saveEditorNote() {
      const path = document.getElementById('editorPath').value.trim();
      const content = document.getElementById('editorContent').value;
      const isLocked = document.getElementById('editorLocked').checked;
      const lockType = document.getElementById('editorLockType').value;
      const password = document.getElementById('editorPassword').value;

      if (!path) {
        showMessage('路径不能为空', 'error');
        return;
      }

      const body = { content };

      if (isLocked) {
        body.is_locked = true;
        body.lock_type = lockType;
        if (password) {
          body.password = password;
        }
      } else if (editorMode === 'edit') {
        body.is_locked = false;
      }

      try {
        const endpoint = editorMode === 'create'
          ? '/admin/api/notes'
          : '/admin/api/note/' + editingPath;
        const method = editorMode === 'create' ? 'POST' : 'PUT';
        const payload = editorMode === 'create' ? { ...body, path } : body;

        const response = await fetch(endpoint, {
          method,
          headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (!response.ok) {
          showMessage(data.error || '保存失败', 'error');
          return;
        }

        closeEditorModal();
        fetchNotes(editorMode === 'create' ? 1 : currentPage);
        fetchStats();
        showMessage(editorMode === 'create' ? '创建成功' : '更新成功', 'success');
      } catch (error) {
        console.error('Error saving note:', error);
        showMessage('保存失败', 'error');
      }
    }

    async function createBackup() {
      try {
        const response = await fetch('/admin/api/backup', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + token
          }
        });

        const data = await response.json();
        if (!response.ok) {
          showMessage(data.error || '备份失败', 'error');
          return;
        }

        showMessage('备份已创建：' + data.filename, 'success');
      } catch (error) {
        console.error('Error creating backup:', error);
        showMessage('备份失败', 'error');
      }
    }
    
    function refreshData() {
      fetchStats();
      fetchNotes();
      showMessage('数据已刷新', 'success');
    }
    
    function logout() {
      localStorage.removeItem('adminToken');
      window.location.href = '/admin';
    }
    
    function showMessage(text, type = 'success') {
      const existing = document.querySelector('.message');
      if (existing) {
        existing.remove();
      }
      
      const message = document.createElement('div');
      message.className = 'message ' + (type === 'error' ? 'error' : '');
      message.textContent = text;
      document.body.appendChild(message);
      
      setTimeout(() => {
        message.remove();
      }, 3000);
    }
    
    // 初始加载
    fetchStats();
    fetchNotes();
    
    // 定期刷新
    setInterval(() => {
      fetchStats();
      fetchNotes(currentPage);
    }, 60000);
  </script>
</body>
</html>`;
}

export { admin as adminRoutes };
