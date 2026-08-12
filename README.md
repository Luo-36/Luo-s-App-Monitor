# 泺 (Luo) — 应用时长监视器

一个基于 Electron + React + TypeScript 的 Windows 桌面应用，用于监视电脑应用的使用时长，提供番茄钟、目标管理、数据统计等功能。

## ✨ 功能

- **📊 应用时长追踪** — 自动监视电脑上运行的应用，记录使用时长
- **➕ 自定义程序** — 支持手动添加要追踪的程序，可自定义图标（PNG/JPG）
- **🎯 目标管理** — 为每个程序设定每日使用时长目标，超时/达成时系统级通知提醒
- **📈 数据统计** — 横向柱状图展示各应用时长，支持按当日/总时长升降序排列；单个应用提供最近一周/一月折线图
- **🍅 番茄钟** — 预设 + 自定义时间周期，支持悬浮球显示（悬浮球可自定义图片）
- **🖼️ 程序卡片** — 类似 Steam 游戏库的网格展示，鼠标悬浮右下角显示时长
- **🎨 主题配色** — 蓝、粉、紫、绿等多种主题色可选
- **🖥️ 自定义背景** — 支持设置应用背景图片（带暗淡遮罩）
- **👤 用户系统** — 头像、昵称、个性签名，完成目标累积 ♥
- **⚙️ 开机自启** — 可选开机自动启动
- **🔽 托盘运行** — 关闭窗口时隐藏到系统托盘，后台静默运行
- **✂️ 图片裁剪** — 内置图片裁剪工具，降低内存占用

## 🛠️ 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Electron 33 |
| 构建 | electron-vite + Vite 6 |
| 前端 | React 18 + TypeScript |
| 路由 | react-router-dom v6 |
| 状态管理 | Zustand |
| 样式 | Tailwind CSS 3 |
| 图表 | Chart.js + react-chartjs-2 |
| 数据库 | better-sqlite3 |
| 图标 | Lucide React |
| 图片裁剪 | react-easy-crop |
| 打包 | electron-builder |

## 🚀 快速开始

### 环境要求

- Node.js >= 18
- npm >= 9

### 安装

```bash
# 克隆仓库
git clone git@github.com:Luo-36/Luo-s-App-Monitor.git
cd Luo-s-App-Monitor

# 安装依赖
npm install
```

### 开发

```bash
npm run dev
```

### 构建

```bash
npm run build
```

### 打包为 Windows 安装包

```bash
npm run package
```

> **注意**：如果在国内下载 Electron 较慢，可以通过配置 `.npmrc` 使用国内镜像源：
> ```
> electron_mirror=https://npmmirror.com/mirrors/electron/
> electron_builder_binaries_mirror=https://npmmirror.com/mirrors/electron-builder-binaries/
> ```

## 📁 项目结构

```
luo-app/
├── src/
│   ├── main/           # Electron 主进程
│   │   ├── index.ts          # 入口，窗口管理
│   │   ├── database.ts       # SQLite 数据库初始化
│   │   ├── tracker.ts        # 应用时长追踪器
│   │   ├── pomodoro-engine.ts # 番茄钟引擎
│   │   ├── ipc-handlers.ts   # IPC 通信处理
│   │   ├── tray.ts           # 系统托盘
│   │   ├── floating-ball-window.ts # 悬浮球窗口
│   │   ├── auto-launch.ts    # 开机自启
│   │   ├── notification.ts   # 系统通知
│   │   └── image-helper.ts   # 图片处理
│   ├── preload/        # 预加载脚本
│   └── renderer/       # 渲染进程（React）
│       ├── index.html
│       └── src/
│           ├── api/          # IPC 桥接
│           ├── components/   # 组件（布局/UI/图片裁剪）
│           ├── store/        # Zustand 状态
│           ├── utils/        # 工具函数
│           └── views/        # 页面
│               ├── programs/   # 程序列表 & 详情
│               ├── statistics/ # 数据统计
│               ├── goals/      # 目标列表 & 详情
│               ├── profile/    # 用户页
│               ├── pomodoro/   # 番茄钟
│               └── settings/   # 设置
├── resources/          # 图标等静态资源
├── electron-builder.yml # 打包配置
└── package.json
```

## 📄 License

MIT © luo-dev
