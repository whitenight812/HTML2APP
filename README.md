# HTML2APP

一个 Web 在线工具，输入任意网址，自动打包成 Android APK 安装包。

## 效果展示

```
用户输入网址 → 自动抓取网站信息 → 客户配置应用参数 → 云端编译 → 下载 APK
```

## 工作原理

```
┌──────────┐    HTTP API    ┌──────────┐    BullMQ     ┌──────────┐
│  前端     │ ──────────────→│  后端     │ ────────────→│  Worker  │
│  React   │ ←──────────────│  Fastify │ ←────────────│  Docker  │
│          │   轮询进度      │          │  返回结果     │ 容器 × N │
└──────────┘               └──────────┘              └──────────┘
                                                           │
                              ┌────────────────────────────┘
                              │  1. 创建 Android 空壳 (Capacitor + WebView)
                              │  2. 抓取网站信息 (Puppeteer 无头浏览器)
                              │  3. 注入配置 (图标 / 权限 / 启动画面)
                              │  4. 注入 JS 桥接 (网页调用原生能力)
                              │  5. Gradle 编译 APK
                              │  6. 签名输出
                              ▼
                         ┌──────────┐
                         │  APK 文件 │
                         │  3~4 MB  │
                         └──────────┘
```

APK 的本质是一个**全屏 WebView 浏览器壳**，启动后加载用户提交的网址。网站本身不受影响，更新网站 App 自动生效。

## 技术栈

| 层 | 技术 | 说明 |
|---|---|---|
| 前端 | React 18 + Vite 5 + Tailwind CSS 3 | 配置界面、构建进度、APK 下载 |
| 后端 | Node.js + Fastify 4 | REST API、参数校验、任务分发 |
| 消息队列 | BullMQ + Redis 7 | 异步任务队列、进度回调 |
| 构建引擎 | Capacitor 6 + Android SDK 34 + Gradle 8.5 | 生成 WebView 壳并编译 APK |
| 运行环境 | Docker + Docker Compose | 沙箱隔离、一键部署 |

## 项目结构

```
HTML2APP/
├── frontend/                  # React 前端
│   └── src/
│       ├── App.tsx            # 主流程（输入 → 配置 → 构建 → 下载）
│       ├── types.ts           # TypeScript 类型定义
│       ├── api/client.ts      # 后端 API 调用
│       ├── hooks/useBuildTask.ts  # 轮询构建状态
│       └── components/
│           ├── UrlInput.tsx       # 网址输入框
│           ├── SitePreview.tsx    # 网站信息预览卡片
│           ├── BasicConfig.tsx    # 基础配置（名称、颜色）
│           ├── AdvancedConfig.tsx # 高级配置（权限、缓存）
│           ├── BuildProgress.tsx  # 实时构建进度
│           └── DownloadPanel.tsx  # APK 下载 + 二维码
├── backend/                   # Fastify API 服务
│   └── src/
│       ├── index.ts           # 服务入口
│       ├── config.ts          # 环境配置
│       ├── ssrfGuard.ts       # SSRF 防护（阻止请求内网地址）
│       ├── routes/
│       │   ├── build.ts       # POST /api/build, GET /api/build/:id
│       │   └── preview.ts     # POST /api/preview（网站预览）
│       ├── queue/buildQueue.ts    # BullMQ 队列
│       └── storage/apkStorage.ts  # APK 文件存储 & 自动清理
├── worker/                    # 构建 Worker
│   ├── docker/Dockerfile      # Worker 镜像（含 Android SDK）
│   └── src/
│       ├── index.ts           # Worker 入口，消费队列任务
│       ├── pipeline.ts        # 构建流水线编排
│       ├── templateManager.ts # 创建 Capacitor Android 项目
│       ├── siteScraper.ts     # Puppeteer 网站信息抓取
│       ├── iconGenerator.ts   # 多尺寸图标生成
│       ├── configInjector.ts  # 配置注入（Manifest、权限、样式）
│       ├── jsBridge.ts        # Java 桥接代码注入
│       └── gradleBuilder.ts   # Gradle 编译 APK
├── shared/
│   └── types.ts               # 前后端共享类型
├── docker-compose.yml         # 一键启动全部服务
└── README.md
```

## 功能特性

- **网址输入** — 支持自动补全 https://，实时 URL 校验
- **网站预览** — 自动抓取目标网站的标题、图标、主题色
- **基础配置** — App 名称、启动画面颜色
- **高级配置** — 权限管理（相机/GPS/存储/麦克风）、离线缓存、下拉刷新、深色模式
- **JS 桥接** — 注入 `window.HTML2APP` 对象，网页可调用 `showToast`、`exitApp`、`getAppVersion` 等原生方法
- **实时进度** — 6 步构建进度条（模板生成 → 网站抓取 → 配置注入 → 原生同步 → 编译 → 签名）
- **APK 下载** — 下载按钮 + 二维码扫码下载
- **安全防护** — SSRF 防护（阻止请求内网、私有 IP）、Zod 输入校验、请求超时和体积限制
- **自动清理** — APK 文件 2 小时后自动删除

## 快速开始

### 环境要求

- Docker Desktop
- Node.js 20+

### 一键启动

```bash
git clone https://github.com/yourusername/HTML2APP.git
cd HTML2APP
docker compose up -d
```

首次启动会构建镜像（Worker 镜像需下载 Android SDK，约 5 GB，需 10~20 分钟）。

启动后访问：
- 前端：`http://localhost:5173`
- 后端：`http://localhost:3000/api/health`

### 本地开发

```bash
# 启动 Redis
docker run -d --name redis -p 6379:6379 redis:7-alpine

# 启动后端
cd backend && npm install && npm run dev

# 启动前端
cd frontend && npm install && npm run dev

# 启动 Worker（需要本地安装 Android SDK + Gradle）
cd worker && npm install && npm run dev
```

## API 接口

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/build` | 提交构建任务 |
| GET | `/api/build/:taskId` | 查询构建进度 |
| GET | `/api/build/:taskId/download` | 下载 APK |
| POST | `/api/preview` | 预览网站信息 |

## 生成 APK 的属性

| 属性 | 值 |
|---|---|
| 最低支持 | Android 5.1 (API 22) |
| 目标版本 | Android 14 (API 34) |
| 包名 | `com.html2app.<应用名>` |
| 签名 | v1 + v2 双重签名 |
| 大小 | ~3.7 MB（不含网站资源） |

## License

MIT
