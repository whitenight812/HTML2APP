# HTML2APP - 网址转 Android APK 在线工具设计文档

## 概述

一个 Web 在线工具，用户输入网址和可选配置，后台自动生成一个封装好的 Android APK 安装包供下载。

## 系统架构

```
用户浏览器 (React 前端)
    │ HTTP API
    ▼
API 服务 (Node.js + Fastify)
    │
    ▼
任务队列 (BullMQ + Redis)
    │
    ▼
构建 Worker (Docker × N) → 产出 APK
    └── Capacitor + Android SDK + Gradle
```

### 三大部分

| 部分 | 技术 | 职责 |
|------|------|------|
| Web 前端 | React + Vite + Tailwind CSS | 网址输入、配置表单、构建进度、APK 下载 |
| API 服务 | Node.js + Fastify | 接收请求、参数校验、任务分发、状态查询 |
| 构建引擎 | Capacitor + Android SDK + Gradle(Docker) | 生成 Android 壳、注入配置、编译 APK、签名 |

## 前端配置界面

### 基础配置（核心项）

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| 目标网址 | 要转换的网站 URL | —（必填） |
| App 名称 | 安装后显示的应用名 | 自动从网页 title 抓取 |
| App 图标 | 桌面图标 | 自动抓取 favicon/OG 图标 |
| 启动画面 | 打开 App 时的画面 | 自动取主色调 + App 名称 |

### 高级配置（可选展开）

| 模块 | 配置项 |
|------|--------|
| 离线策略 | 开启离线缓存 / 缓存策略（仅静态资源 / 全站缓存） |
| 权限控制 | 勾选所需权限：相机、GPS、文件读写、麦克风 |
| 推送通知 | 接入 Firebase Cloud Messaging / OneSignal |
| 广告变现 | 启用 AdMob / 广告位 ID / 广告类型 |
| 界面定制 | 主题色、状态栏样式、导航按钮、下拉刷新 |
| JS 桥接 | 自定义 JavaScript 与原生交互 API |

### 用户操作流程

1. 输入网址 → 自动预览网站信息
2. （可选）展开高级配置微调
3. 点击「开始构建」
4. 实时进度条：`排队中 → 生成模板 → 注入配置 → 编译中 → 签名打包 → 完成`
5. 展示下载按钮 + 二维码扫码下载

## 后端 API

### 接口列表

| 接口 | 方法 | 用途 |
|------|------|------|
| `/api/build` | POST | 提交构建任务 |
| `/api/build/:taskId` | GET | 查询构建进度和状态 |
| `/api/build/:taskId/download` | GET | 下载生成的 APK |
| `/api/preview` | POST | 预览目标网站信息 |

### 接口详情

**POST /api/build**

请求体：
```json
{
  "url": "https://example.com",
  "appName": "示例应用",
  "icon": "base64图片或URL",
  "splashBackground": "#2196F3",
  "permissions": ["camera", "gps"],
  "offlineCache": true,
  "pushNotifications": { "enabled": true, "onesignalAppId": "xxx" },
  "admob": { "enabled": true, "bannerId": "xxx", "interstitialId": "xxx" },
  "theme": { "primaryColor": "#2196F3", "darkMode": true, "pullToRefresh": true }
}
```

响应：
```json
{ "taskId": "a1b2c3d4", "status": "queued", "estimatedTime": "3-5分钟" }
```

**GET /api/build/:taskId**

响应：
```json
{
  "taskId": "a1b2c3d4",
  "status": "queued|building|signing|done|failed",
  "progress": 65,
  "currentStep": "编译APK中...",
  "apkUrl": null,
  "error": null
}
```

**GET /api/build/:taskId/download** → 返回 APK 文件流

**POST /api/preview**

响应：
```json
{ "title": "Example", "favicon": "https://...", "primaryColor": "#f0f0f0", "description": "网站描述" }
```

## 构建 Worker 内部流程

```
1. 初始化 → 创建临时目录，npm init @capacitor/app 生成 Android 壳
2. 采集信息 → Puppeteer 无头浏览器访问网址，截图+提取 title/favicon/主色调
3. 注入配置 → capacitor.config.ts、AndroidManifest.xml、图标、启动画面、AdMob/推送配置
4. 注入 JS Bridge → 注册原生插件(相机/GPS/文件/推送/广告)，暴露 window.HTML2APP 接口
5. 编译 → cd android && ./gradlew assembleRelease（耗时 2-5 分钟）
6. 签名输出 → Debug/Release 签名，zipalign 对齐，上传存储，生成下载链接
```

### 技术要点

- **Docker 镜像：** 预装 Node.js + Android SDK + Gradle + Capacitor CLI，构建时无需安装依赖
- **并行处理：** 多个 Worker 容器同时处理，BullMQ 自动分发
- **失败处理：** 编译失败时捕获日志返回前端
- **自动清理：** APK 保留 2 小时后自动删除，临时目录构建后立即清理

## 生成 APK 的特性

| 特性 | 实现方式 |
|------|----------|
| 网页加载 | Capacitor WebView（全屏，无地址栏） |
| 离线缓存 | Service Worker 缓存策略 |
| 推送通知 | Firebase Cloud Messaging / OneSignal 插件 |
| 广告 | AdMob Capacitor 插件（横幅/插屏/激励视频） |
| 权限管理 | AndroidManifest.xml 声明 + 运行时权限请求 |
| JS 桥接 | window.HTML2APP 全局对象，暴露原生方法 |
| 自定义图标 | 自动生成 ldpi ~ xxxhdpi 六种尺寸 |
| 启动画面 | 自定义 Splash Screen layout |

## 参考项目

- [RereBot/web-to-apk](https://github.com/RereBot/web-to-apk) — Capacitor + Docker 架构的在线 APK 构建工具
- [Demo2APK](https://blog.csdn.net/weixin_42520239/article/details/160696107) — 类似的 Capacitor + BullMQ 后端架构
