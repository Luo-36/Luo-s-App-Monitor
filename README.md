# 泺 (Luo) — 应用时长监视器

一个基于 Electron + React + TypeScript 的 Windows 桌面应用，用于监视电脑应用的使用时长，提供番茄钟、目标管理、数据统计等功能。

## ✨ 功能

- **📊 应用时长追踪** — 自动监视电脑上运行的应用，记录使用时长
- **➕ 自定义程序** — 支持手动添加要追踪的程序，可自定义图标（PNG/JPG）
- **🎯 目标管理** — 设定每日使用时长目标（要求/限制两种类型），可关联一个或多个程序，达成/超限时系统通知并累积爱心 ♥
- **📈 数据统计** — 横向柱状图展示各应用时长，支持按当日/总时长升降序排列；单个应用提供最近一周/一月折线图
- **🍅 番茄钟** — 预设 + 自定义时间周期，支持桌面悬浮球显示倒计时
- **💾 数据备份** — 支持一键导出/导入 JSON 数据（含图片），方便备份与迁移
- **🔍 自动添加程序** — 窗口聚焦超过 3 秒自动识别并添加对应程序
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

## 📖 使用方法

### 1. 添加要追踪的程序

- **自动添加**：在「我的程序」页点「自动添加」，切换到目标程序窗口并保持聚焦 3 秒，检测到进程后确认即可（会自动填入进程名）。
- **手动添加**：点「添加程序」，输入名称和进程名；也可以点右侧文件夹图标选择 `.exe` 文件，自动提取进程名和图标。

### 2. 查看使用时长

- 应用会自动检测前台窗口，实时记录每个程序的使用时长。
- 「我的程序」页以 Steam 风格卡片展示，实时显示今日使用时长。
- 「数据统计」页提供柱状图和趋势图，可切换今日/总时长排序。

### 3. 设定目标

- 在「目标」页点「添加目标」，设置每日时长和类型：
  - **要求时长**：达到设定时长即完成，获得爱心 ♥
  - **限制时长**：超过设定时长会收到警告通知
- 可**关联多个程序**（勾选多个），留空表示统计所有程序的总时长。

### 4. 番茄钟

- 在「番茄钟」页选择预设或自定义时长，开始「专注 / 休息」循环。
- 在「设置」里开启「悬浮球」，可在桌面显示倒计时。

### 5. 主题与外观

- 「设置」页可切换主题色、设置背景图片、调整界面缩放比例、开启开机自启。

### 6. 数据备份

- 「设置」页提供「导出数据 (JSON)」和「导入数据」，用于备份或迁移到新电脑。

### 7. 托盘运行

- 关闭窗口会最小化到系统托盘，后台继续记录使用时长；右键托盘图标可退出应用。

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
