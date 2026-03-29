import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { QUILL_SNOW_CSS } from '../vendor/quillSnowCss';
import {
  isReservedPath,
  isRenderablePath,
  resolveRootPath,
} from '../services/notes';

const notes = new Hono<AppEnv>();

notes.get('/', async (c) => {
  try {
    const result = await resolveRootPath(c.env);
    if ('path' in result.body) {
      return c.redirect(`/${result.body.path}`);
    }

    return c.text(result.body.error, result.status);
  } catch (error) {
    console.error('Error handling root path:', error);
    return c.text('Internal Server Error', 500);
  }
});

notes.get('/:path', async (c) => {
  const path = c.req.param('path');

  if (isReservedPath(path)) {
    return c.notFound();
  }

  if (!isRenderablePath(c.env, path)) {
    return c.text('Invalid path', 400);
  }

  return c.html(getNoteEditorHTML(path));
});

function getNoteEditorHTML(path: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${path} - CloudNote</title>
  <style>${QUILL_SNOW_CSS}</style>
  <style>
    /* CSS变量 - 设计系统 */
    :root {
      /* 主色调 */
      --primary-color: #2563eb;
      --primary-hover: #1d4ed8;
      --secondary-color: #6b7280;
      --success-color: #10b981;
      --error-color: #ef4444;
      --warning-color: #f59e0b;
      
      /* 中性色 */
      --bg-color: #ffffff;
      --bg-secondary: #f8fafc;
      --text-primary: #1f2937;
      --text-secondary: #6b7280;
      --text-muted: #9ca3af;
      --border-color: #e5e7eb;
      
      /* 间距 */
      --spacing-xs: 0.25rem;
      --spacing-sm: 0.5rem;
      --spacing-md: 1rem;
      --spacing-lg: 1.5rem;
      --spacing-xl: 2rem;
      
      /* 阴影 */
      --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
      --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
      
      /* 圆角 */
      --border-radius: 8px;
      
      /* 字体 */
      --font-family-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      --font-family-mono: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
    }
    
    /* 基础重置 */
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: var(--font-family-sans);
      font-size: 14px;
      line-height: 1.5;
      color: var(--text-primary);
      background: var(--bg-secondary);
      overflow: hidden;
    }
    
    /* 应用容器 */
    #app {
      display: flex;
      flex-direction: column;
      height: 100vh;
      max-height: 100vh;
    }
    
    /* 工具栏 */
    .toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--spacing-sm) var(--spacing-md);
      background: var(--bg-color);
      border-bottom: 1px solid var(--border-color);
      box-shadow: var(--shadow-sm);
      flex-shrink: 0;
      z-index: 100;
    }
    
    .toolbar-left {
      display: flex;
      align-items: center;
      gap: var(--spacing-md);
    }
    
    .toolbar-right {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
    }
    
    .logo {
      font-size: 18px;
      font-weight: 600;
      color: var(--text-primary);
      text-decoration: none;
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
    }
    
    .logo:hover {
      color: var(--primary-color);
    }
    
    .path-info {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
      padding: var(--spacing-xs) var(--spacing-sm);
      background: var(--bg-secondary);
      border-radius: var(--border-radius);
      font-family: var(--font-family-mono);
      font-size: 13px;
      color: var(--text-secondary);
    }
    
    /* 状态栏 */
    .status-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--spacing-xs) var(--spacing-md);
      background: var(--bg-secondary);
      border-top: 1px solid var(--border-color);
      font-size: 12px;
      color: var(--text-muted);
      flex-shrink: 0;
    }
    
    .status-left {
      display: flex;
      align-items: center;
      gap: var(--spacing-md);
    }
    
    .status-item {
      display: flex;
      align-items: center;
      gap: var(--spacing-xs);
    }
    
    .status-indicator {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--success-color);
    }
    
    .status-indicator.saving {
      background: var(--warning-color);
      animation: pulse 1s infinite;
    }
    
    .status-indicator.error {
      background: var(--error-color);
    }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    
    /* 主内容区 */
    .main-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: var(--bg-color);
      position: relative;
    }
    
    .editor-container {
      flex: 1;
      max-width: 900px;
      width: 100%;
      margin: 0 auto;
      padding: var(--spacing-lg);
      display: flex;
      flex-direction: column;
      overflow: visible; /* 改为visible以允许下拉菜单溢出 */
      position: relative;
    }
    
    /* 锁定提示条 */
    .lock-notice {
      display: none;
      align-items: center;
      gap: var(--spacing-sm);
      padding: var(--spacing-sm) var(--spacing-md);
      background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
      border: 1px solid #f59e0b;
      border-radius: var(--border-radius);
      margin-bottom: var(--spacing-md);
      color: #92400e;
      font-size: 13px;
    }
    
    .lock-notice.show {
      display: flex;
    }
    
    .lock-notice button {
      margin-left: auto;
      padding: var(--spacing-xs) var(--spacing-sm);
      background: white;
      border: 1px solid #f59e0b;
      border-radius: 4px;
      color: #92400e;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .lock-notice button:hover {
      background: #fef3c7;
    }
    
    /* Quill 编辑器容器 */
    #editor {
      flex: 1;
      background: var(--bg-color);
      display: flex;
      flex-direction: column;
      min-height: 0;
    }

    /* 让官方 snow 主题主导布局，只保留最小的尺寸兜底 */
    .ql-toolbar.ql-snow {
      border: 1px solid var(--border-color);
      border-bottom: none;
      border-top-left-radius: var(--border-radius);
      border-top-right-radius: var(--border-radius);
      background: var(--bg-secondary);
      flex-shrink: 0;
    }

    .ql-toolbar.ql-snow button {
      width: 28px;
      height: 28px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .ql-toolbar.ql-snow button svg {
      width: 18px;
      height: 18px;
    }

    .ql-container.ql-snow {
      flex: 1;
      border: 1px solid var(--border-color);
      border-bottom-left-radius: var(--border-radius);
      border-bottom-right-radius: var(--border-radius);
      font-size: 16px;
      line-height: 1.6;
      min-height: 0;
    }
    
    .ql-editor {
      min-height: 400px;
      padding: var(--spacing-lg);
    }
    
    .ql-editor.ql-blank::before {
      color: var(--text-muted);
      font-style: normal;
    }
    
    /* 按钮样式 */
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
    
    .btn:hover:not(:disabled) {
      background: var(--bg-secondary);
      transform: translateY(-1px);
    }
    
    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .btn-primary {
      background: var(--primary-color);
      color: white;
      border-color: var(--primary-color);
    }
    
    .btn-primary:hover:not(:disabled) {
      background: var(--primary-hover);
      border-color: var(--primary-hover);
    }
    
    .btn-small {
      padding: var(--spacing-xs) var(--spacing-sm);
      font-size: 12px;
    }
    
    .btn-text {
      display: inline;
    }
    
    .btn-icon {
      padding: var(--spacing-sm);
      width: 36px;
      height: 36px;
    }
    
    /* 模态框 */
    .modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 1000;
      align-items: center;
      justify-content: center;
      animation: fadeIn 0.2s ease;
    }
    
    .modal.show {
      display: flex;
    }
    
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    .modal-content {
      background: var(--bg-color);
      border-radius: var(--border-radius);
      box-shadow: var(--shadow-lg);
      padding: var(--spacing-xl);
      width: 90%;
      max-width: 400px;
      max-height: 90vh;
      overflow-y: auto;
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
    
    .modal-header {
      margin-bottom: var(--spacing-lg);
    }
    
    .modal-title {
      font-size: 18px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: var(--spacing-xs);
    }
    
    .modal-subtitle {
      font-size: 13px;
      color: var(--text-secondary);
    }
    
    .form-group {
      margin-bottom: var(--spacing-md);
    }
    
    .form-label {
      display: block;
      margin-bottom: var(--spacing-xs);
      font-size: 13px;
      font-weight: 500;
      color: var(--text-primary);
    }
    
    .form-input,
    .form-select {
      width: 100%;
      padding: var(--spacing-sm) var(--spacing-md);
      font-size: 14px;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      outline: none;
      transition: all 0.2s ease;
      background: var(--bg-color);
    }
    
    .form-input:focus,
    .form-select:focus {
      border-color: var(--primary-color);
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
    }
    
    .form-help {
      margin-top: var(--spacing-xs);
      font-size: 12px;
      color: var(--text-muted);
    }
    
    .modal-actions {
      display: flex;
      gap: var(--spacing-sm);
      margin-top: var(--spacing-lg);
      justify-content: flex-end;
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
    
    .message.warning {
      background: var(--warning-color);
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
    
    /* 加载器 */
    .spinner {
      width: 20px;
      height: 20px;
      border: 2px solid var(--border-color);
      border-top: 2px solid var(--primary-color);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    /* 响应式设计 */
    @media (max-width: 768px) {
      .toolbar {
        padding: var(--spacing-sm);
      }
      
      .logo {
        font-size: 16px;
      }
      
      .logo span {
        display: none;
      }
      
      .path-info {
        font-size: 12px;
        padding: 2px var(--spacing-xs);
      }
      
      .btn {
        padding: var(--spacing-sm);
        font-size: 13px;
      }
      
      .btn-small {
        padding: 6px 10px;
      }
      
      .btn-text {
        display: none;
      }
      
      .btn-save {
        padding: 6px 12px;
      }
      
      .editor-container {
        padding: var(--spacing-md);
        overflow: visible !important;
      }
      
      #editor {
        overflow: visible !important;
      }
      
      .ql-editor {
        padding: var(--spacing-md);
      }
      
      .ql-toolbar.ql-snow {
        overflow-x: auto;
        white-space: nowrap;
      }
      
      .ql-toolbar.ql-snow::-webkit-scrollbar {
        height: 4px;
      }
      
      .ql-toolbar.ql-snow::-webkit-scrollbar-track {
        background: var(--bg-secondary);
      }
      
      .ql-toolbar.ql-snow::-webkit-scrollbar-thumb {
        background: var(--border-color);
        border-radius: 2px;
      }
    }
    
    @media (max-width: 480px) {
      .toolbar-right {
        gap: 2px;
      }
      
      .btn-small {
        padding: 8px;
        font-size: 16px;
      }
      
      .modal-content {
        width: 95%;
        padding: var(--spacing-lg);
      }
      
      .modal-actions {
        flex-direction: column;
      }
      
      .modal-actions button {
        width: 100%;
      }
      
      .status-bar {
        font-size: 11px;
        padding: 4px var(--spacing-sm);
      }
      
      .ql-container.ql-snow {
        font-size: 15px;
      }
    }
    
    /* 可访问性 */
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
    
    /* 减动效支持 */
    @media (prefers-reduced-motion: reduce) {
      *,
      ::before,
      ::after {
        animation-delay: -1ms !important;
        animation-duration: 1ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
    }
    
    /* 打印样式 */
    @media print {
      .toolbar,
      .status-bar,
      .modal,
      .lock-notice,
      .message {
        display: none !important;
      }
      
      .main-content {
        height: auto;
      }
      
      .ql-toolbar {
        display: none !important;
      }
      
      .ql-container {
        border: none;
      }
      
      .ql-editor {
        padding: 0;
        font-size: 12pt;
        line-height: 1.4;
      }
    }
  </style>
</head>
<body>
  <div id="app">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <a href="/" class="logo">
          <span>CloudNote</span>
        </a>
        <div class="path-info">
          <span>/${path}</span>
        </div>
      </div>
      <div class="toolbar-right">
        <button class="btn btn-small" onclick="toggleLock()" id="lockBtn">
          <span id="lockIcon">🔓</span>
          <span id="lockText" class="btn-text">未锁定</span>
        </button>
        <button class="btn btn-small" onclick="saveNoteManually()" id="saveBtn">
          <span>💾</span>
          <span class="btn-text">保存</span>
        </button>
        <button class="btn btn-small" onclick="window.location.href='/'">
          <span>➕</span>
          <span class="btn-text">新建</span>
        </button>
      </div>
    </div>
    
    <!-- 主内容区 -->
    <div class="main-content">
      <div class="editor-container">
        <!-- 锁定提示 -->
        <div class="lock-notice" id="lockNotice">
          <span id="lockNoticeText">此笔记已锁定</span>
          <button onclick="showUnlockModal()">输入密码</button>
        </div>
        
        <!-- 富文本编辑器 -->
        <div id="editor"></div>
      </div>
    </div>
    
    <!-- 状态栏 -->
    <div class="status-bar">
      <div class="status-left">
        <div class="status-item">
          <span class="status-indicator" id="statusIndicator"></span>
          <span id="statusText">就绪</span>
        </div>
        <div class="status-item">
          <span id="viewCount">0</span> 次查看
        </div>
      </div>
      <div class="status-right">
        <span id="lastSaved">未保存</span>
      </div>
    </div>
  </div>
  
  <!-- 锁定设置模态框 -->
  <div class="modal" id="lockModal">
    <div class="modal-content">
      <div class="modal-header">
        <h3 class="modal-title">设置笔记锁定</h3>
        <p class="modal-subtitle">锁定后需要密码才能访问或编辑</p>
      </div>
      
      <div class="form-group">
        <label class="form-label" for="lockType">锁定类型</label>
        <select id="lockType" class="form-select" onchange="updateLockDescription()">
          <option value="write">限制编辑</option>
          <option value="read">限制访问</option>
        </select>
        <p class="form-help" id="lockDescription">任何人都可以查看，但需要密码才能编辑</p>
      </div>
      
      <div class="form-group">
        <label class="form-label" for="lockPassword">设置密码</label>
        <input type="password" id="lockPassword" class="form-input" placeholder="输入密码" autocomplete="new-password">
      </div>
      
      <div class="form-group">
        <label class="form-label" for="lockPasswordConfirm">确认密码</label>
        <input type="password" id="lockPasswordConfirm" class="form-input" placeholder="再次输入密码" autocomplete="new-password">
      </div>
      
      <div class="modal-actions">
        <button class="btn" onclick="closeLockModal()">取消</button>
        <button class="btn btn-primary" onclick="setLock()">确认锁定</button>
      </div>
    </div>
  </div>
  
  <!-- 解锁模态框 -->
  <div class="modal" id="unlockModal">
    <div class="modal-content">
      <div class="modal-header">
        <h3 class="modal-title">笔记已锁定</h3>
        <p class="modal-subtitle" id="unlockDescription">请输入密码以继续</p>
      </div>
      
      <div class="form-group">
        <label class="form-label" for="unlockPassword">密码</label>
        <input type="password" id="unlockPassword" class="form-input" placeholder="输入密码" autofocus>
        <p class="form-help" id="unlockError" style="color: var(--error-color); display: none;">密码错误，请重试</p>
      </div>
      
      <div class="modal-actions">
        <button class="btn" onclick="closeUnlockModal()">返回</button>
        <button class="btn btn-primary" onclick="unlockNote()">解锁</button>
      </div>
    </div>
  </div>
  
  <!-- 解除锁定确认模态框 -->
  <div class="modal" id="removeLockModal">
    <div class="modal-content">
      <div class="modal-header">
        <h3 class="modal-title">解除锁定</h3>
        <p class="modal-subtitle">输入密码以解除笔记锁定</p>
      </div>
      
      <div class="form-group">
        <label class="form-label" for="removeLockPassword">当前密码</label>
        <input type="password" id="removeLockPassword" class="form-input" placeholder="输入当前密码">
        <p class="form-help" id="removeLockError" style="color: var(--error-color); display: none;">密码错误</p>
      </div>
      
      <div class="modal-actions">
        <button class="btn" onclick="closeRemoveLockModal()">取消</button>
        <button class="btn btn-primary" onclick="removeLock()">解除锁定</button>
      </div>
    </div>
  </div>
  
  <script src="https://cdn.quilljs.com/1.3.6/quill.js"></script>
  <script>
    const notePath = '${path}';
    let quill;
    let isLocked = false;
    let lockType = null;
    let notePassword = null;
    let saveTimeout;
    let viewCount = 0;
    let lastSavedTime = null;
    
    // 初始化编辑器
    function initEditor(readOnly = false, hasContent = false) {
      // 先清理旧的编辑器实例
      if (quill) {
        quill = null;
      }
      
      // 清理编辑器容器中的所有内容（包括工具栏）
      const container = document.querySelector('.editor-container');
      const existingToolbar = container.querySelector('.ql-toolbar');
      const existingEditor = container.querySelector('.ql-container');
      
      if (existingToolbar) {
        existingToolbar.remove();
      }
      if (existingEditor) {
        existingEditor.remove();
      }
      
      // 重新创建编辑器div
      const editorDiv = document.getElementById('editor');
      if (!editorDiv) {
        const newEditor = document.createElement('div');
        newEditor.id = 'editor';
        container.appendChild(newEditor);
      }
      
      quill = new Quill('#editor', {
        theme: 'snow',
        readOnly: readOnly,
        placeholder: readOnly || hasContent ? '' : '开始输入您的笔记...',
        modules: {
          toolbar: readOnly ? false : [
            [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            ['blockquote', 'code-block'],
            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
            [{ 'script': 'sub'}, { 'script': 'super' }],
            [{ 'indent': '-1'}, { 'indent': '+1' }],
            [{ 'color': [] }, { 'background': [] }],
            [{ 'align': [] }],
            ['link', 'image'],
            ['clean']
          ]
        }
      });
      
      if (!readOnly) {
        // 内容变化时自动保存
        quill.on('text-change', function() {
          clearTimeout(saveTimeout);
          setStatus('editing', '正在编辑...');
          
          saveTimeout = setTimeout(() => {
            saveNote();
          }, 2000);
        });
      }
    }
    
    // 加载笔记
    async function loadNote() {
      try {
        const response = await fetch('/api/note/' + notePath);
        const data = await response.json();
        
        if (data.exists === false) {
          // 新笔记
          initEditor();
          setStatus('ready', '新笔记');
        } else if (data.requires_password) {
          // 需要密码才能查看
          isLocked = true;
          lockType = data.lock_type;
          updateLockButton(true, lockType);
          document.getElementById('unlockDescription').textContent = '此笔记需要密码才能查看';
          document.getElementById('unlockModal').classList.add('show');
        } else {
          // 加载内容
          viewCount = data.view_count || 0;
          document.getElementById('viewCount').textContent = viewCount;
          
          if (data.is_locked) {
            isLocked = true;
            lockType = data.lock_type;
            updateLockButton(true, lockType);
            
            if (lockType === 'write') {
              // 限制编辑模式 - 可以查看但不能编辑
              initEditor(true);
              if (data.content) {
                quill.root.innerHTML = data.content;
              }
              showLockNotice('点击输入密码以编辑');
              setStatus('locked', '只读模式');
            } else {
              // 不应该到这里，read锁定应该在前面就被拦截
              initEditor();
              if (data.content) {
                quill.root.innerHTML = data.content;
              }
            }
          } else {
            // 正常加载
            initEditor();
            if (data.content) {
              quill.root.innerHTML = data.content;
            }
            setStatus('ready', '就绪');
          }
          
          if (data.updated_at) {
            lastSavedTime = new Date(data.updated_at);
            updateLastSaved();
          }
        }
      } catch (error) {
        console.error('Error loading note:', error);
        setStatus('error', '加载失败');
        showMessage('加载笔记失败', 'error');
      }
    }
    
    // 保存笔记
    async function saveNote() {
      if (!quill || quill.getText().trim() === '') {
        return;
      }
      
      try {
        setStatus('saving', '正在保存...');
        const content = quill.root.innerHTML;
        const body = { content };
        
        if (notePassword) {
          body.password = notePassword;
        }
        
        const response = await fetch('/api/note/' + notePath, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        
        if (response.ok) {
          setStatus('ready', '已保存');
          lastSavedTime = new Date();
          updateLastSaved();
        } else if (response.status === 403) {
          // 需要密码
          setStatus('error', '需要密码');
          showUnlockModal();
        } else {
          setStatus('error', '保存失败');
          showMessage('保存失败', 'error');
        }
      } catch (error) {
        console.error('Error saving note:', error);
        setStatus('error', '保存失败');
        showMessage('保存失败', 'error');
      }
    }
    
    // 手动保存笔记
    async function saveNoteManually() {
      // 检查编辑器是否为只读状态
      if (quill && quill.root.getAttribute('contenteditable') === 'false') {
        showMessage('笔记已锁定，请先解锁', 'warning');
        return;
      }
      
      // 清除自动保存的定时器
      clearTimeout(saveTimeout);
      
      // 调用保存函数
      await saveNote();
      
      // 显示保存成功消息
      if (lastSavedTime) {
        showMessage('保存成功', 'success');
      }
    }
    
    // 解锁笔记
    async function unlockNote() {
      const password = document.getElementById('unlockPassword').value;
      if (!password) {
        document.getElementById('unlockError').style.display = 'block';
        document.getElementById('unlockError').textContent = '请输入密码';
        return;
      }
      
      try {
        const response = await fetch('/api/note/' + notePath + '/unlock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });
        
        if (response.ok) {
          const data = await response.json();
          notePassword = password;
          document.getElementById('unlockModal').classList.remove('show');
          document.getElementById('unlockPassword').value = '';
          document.getElementById('unlockError').style.display = 'none';
          
          // 根据锁定类型处理
          if (data.note.lock_type === 'write') {
            // 编辑锁定 - 现在可以编辑了
            // 保存当前内容
            const currentContent = quill ? quill.root.innerHTML : data.note.content;
            const hasContent = currentContent && currentContent.trim() !== '' && currentContent !== '<p><br></p>';
            
            // 重新初始化编辑器（带工具栏，传递是否有内容）
            initEditor(false, hasContent);
            
            // 恢复内容
            if (currentContent) {
              quill.root.innerHTML = currentContent;
            }
            
            hideLockNotice();
            setStatus('ready', '已解锁');
            showMessage('笔记已解锁，现在可以编辑', 'success');
          } else {
            // 访问锁定 - 现在可以查看和编辑
            initEditor();
            if (data.note.content) {
              quill.root.innerHTML = data.note.content;
            }
            setStatus('ready', '已解锁');
            showMessage('笔记已解锁', 'success');
          }
          
          viewCount = data.note.view_count || 0;
          document.getElementById('viewCount').textContent = viewCount;
        } else {
          document.getElementById('unlockError').style.display = 'block';
          document.getElementById('unlockError').textContent = '密码错误，请重试';
        }
      } catch (error) {
        console.error('Error unlocking note:', error);
        showMessage('解锁失败', 'error');
      }
    }
    
    // 设置锁定
    async function setLock() {
      const lockType = document.getElementById('lockType').value;
      const password = document.getElementById('lockPassword').value;
      const passwordConfirm = document.getElementById('lockPasswordConfirm').value;
      
      if (!password) {
        showMessage('请输入密码', 'error');
        return;
      }
      
      if (password !== passwordConfirm) {
        showMessage('两次输入的密码不一致', 'error');
        return;
      }
      
      try {
        const response = await fetch('/api/note/' + notePath + '/lock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password, lock_type: lockType })
        });
        
        if (response.ok) {
          isLocked = true;
          notePassword = password;
          updateLockButton(true, lockType);
          closeLockModal();
          showMessage('笔记已锁定', 'success');
          
          if (lockType === 'write') {
            // 编辑锁定 - 需要将编辑器设置为只读模式
            // 保存当前内容
            const currentContent = quill ? quill.root.innerHTML : '';
            
            // 重新初始化为只读编辑器（无工具栏）
            initEditor(true, true);
            
            // 恢复内容
            if (currentContent) {
              quill.root.innerHTML = currentContent;
            }
            
            showLockNotice('输入密码以编辑');
            setStatus('locked', '只读模式');
          }
        } else {
          showMessage('锁定失败', 'error');
        }
      } catch (error) {
        console.error('Error locking note:', error);
        showMessage('锁定失败', 'error');
      }
    }
    
    // 解除锁定
    async function removeLock() {
      const password = document.getElementById('removeLockPassword').value;
      
      if (!password) {
        document.getElementById('removeLockError').style.display = 'block';
        document.getElementById('removeLockError').textContent = '请输入密码';
        return;
      }
      
      try {
        // 调用解除锁定API
        const response = await fetch('/api/note/' + notePath + '/lock', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });
        
        if (response.ok) {
          // 先保存当前的锁定类型
          const previousLockType = lockType;
          
          isLocked = false;
          lockType = null;
          notePassword = null;
          updateLockButton(false, null);
          closeRemoveLockModal();
          hideLockNotice();
          
          // 如果之前是编辑锁定，需要重新初始化编辑器以恢复工具栏
          if (previousLockType === 'write' && quill) {
            // 保存当前内容
            const currentContent = quill.root.innerHTML;
            const hasContent = currentContent && currentContent.trim() !== '' && currentContent !== '<p><br></p>';
            
            // 重新初始化编辑器（带工具栏，传递是否有内容）
            initEditor(false, hasContent);
            
            // 恢复内容
            if (currentContent) {
              quill.root.innerHTML = currentContent;
            }
          }
          
          setStatus('ready', '就绪');
          showMessage('锁定已解除', 'success');
        } else if (response.status === 403) {
          document.getElementById('removeLockError').style.display = 'block';
          document.getElementById('removeLockError').textContent = '密码错误';
        } else {
          showMessage('解除锁定失败', 'error');
        }
      } catch (error) {
        console.error('Error removing lock:', error);
        showMessage('解除锁定失败', 'error');
      }
    }
    
    // UI辅助函数
    function setStatus(type, text) {
      const indicator = document.getElementById('statusIndicator');
      const statusText = document.getElementById('statusText');
      
      indicator.className = 'status-indicator';
      if (type === 'saving' || type === 'editing') {
        indicator.classList.add('saving');
      } else if (type === 'error') {
        indicator.classList.add('error');
      }
      
      statusText.textContent = text;
    }
    
    function updateLastSaved() {
      if (lastSavedTime) {
        const now = new Date();
        const diff = Math.floor((now - lastSavedTime) / 1000);
        
        let text;
        if (diff < 60) {
          text = '刚刚保存';
        } else if (diff < 3600) {
          text = Math.floor(diff / 60) + ' 分钟前保存';
        } else if (diff < 86400) {
          text = Math.floor(diff / 3600) + ' 小时前保存';
        } else {
          text = lastSavedTime.toLocaleDateString();
        }
        
        document.getElementById('lastSaved').textContent = text;
      }
    }
    
    function updateLockButton(locked, type) {
      const lockBtn = document.getElementById('lockBtn');
      const lockIcon = document.getElementById('lockIcon');
      const lockText = document.getElementById('lockText');
      
      if (locked) {
        lockIcon.textContent = '🔒';
        lockText.textContent = type === 'read' ? '访问锁定' : '编辑锁定';
        lockBtn.title = '点击解除锁定';
      } else {
        lockIcon.textContent = '🔓';
        lockText.textContent = '未锁定';
        lockBtn.title = '点击设置锁定';
      }
    }
    
    function showLockNotice(text) {
      const notice = document.getElementById('lockNotice');
      document.getElementById('lockNoticeText').textContent = text;
      notice.classList.add('show');
    }
    
    function hideLockNotice() {
      document.getElementById('lockNotice').classList.remove('show');
    }
    
    function showMessage(text, type = 'success') {
      const existing = document.querySelector('.message');
      if (existing) {
        existing.remove();
      }
      
      const message = document.createElement('div');
      message.className = 'message ' + type;
      message.textContent = text;
      document.body.appendChild(message);
      
      setTimeout(() => {
        message.remove();
      }, 3000);
    }
    
    // 模态框控制
    function toggleLock() {
      if (isLocked) {
        document.getElementById('removeLockModal').classList.add('show');
      } else {
        document.getElementById('lockModal').classList.add('show');
      }
    }
    
    function showUnlockModal() {
      document.getElementById('unlockModal').classList.add('show');
      document.getElementById('unlockPassword').focus();
    }
    
    function closeUnlockModal() {
      document.getElementById('unlockModal').classList.remove('show');
      document.getElementById('unlockPassword').value = '';
      document.getElementById('unlockError').style.display = 'none';
      
      // 如果是访问锁定且未解锁，返回首页
      if (lockType === 'read' && !notePassword) {
        window.location.href = '/';
      }
    }
    
    function closeLockModal() {
      document.getElementById('lockModal').classList.remove('show');
      document.getElementById('lockPassword').value = '';
      document.getElementById('lockPasswordConfirm').value = '';
    }
    
    function closeRemoveLockModal() {
      document.getElementById('removeLockModal').classList.remove('show');
      document.getElementById('removeLockPassword').value = '';
      document.getElementById('removeLockError').style.display = 'none';
    }
    
    function updateLockDescription() {
      const lockType = document.getElementById('lockType').value;
      const description = document.getElementById('lockDescription');
      
      if (lockType === 'write') {
        description.textContent = '任何人都可以查看，但需要密码才能编辑';
      } else {
        description.textContent = '需要密码才能查看和编辑此笔记';
      }
    }
    
    // 键盘快捷键
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + S 保存
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (quill && !quill.root.getAttribute('contenteditable') === 'false') {
          saveNote();
        }
      }
      
      // Esc 关闭模态框
      if (e.key === 'Escape') {
        const modals = document.querySelectorAll('.modal.show');
        modals.forEach(modal => {
          modal.classList.remove('show');
        });
      }
    });
    
    // Enter键提交解锁
    document.getElementById('unlockPassword').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        unlockNote();
      }
    });
    
    // 定期更新最后保存时间
    setInterval(updateLastSaved, 60000);
    
    // 页面加载时初始化
    loadNote();
  </script>
</body>
</html>`;
}

export { notes as noteRoutes };
