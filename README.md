# my-blog - 杨凯的专属AI助手

这是我学习的第一个代码项目，一个基于 React、TypeScript 和 Vite 构建的 AI 助手应用。

## 功能特点

- 基于 OpenAI API 的聊天功能
- 本地存储聊天历史
- 响应式设计
- 支持多轮对话

## 环境变量配置

在项目根目录创建 `.env` 文件，并配置以下环境变量：

```
VITE_OPENAI_API_KEY=your_api_key_here
VITE_OPENAI_BASE_URL=https://api.deepseek.com
VITE_SYSTEM_PROMPT=你是杨凯的专属助手，请以专业、友好的态度提供帮助。
```

## 开发

1. 安装依赖：
   ```bash
   npm install
   ```

2. 启动开发服务器：
   ```bash
   npm run dev
   ```

3. 构建生产版本：
   ```bash
   npm run build
   ```

## 部署到腾讯云 CloudBase

1. 确保已安装 CloudBase CLI：
   ```bash
   npm install -g @cloudbase/cli
   ```

2. 登录 CloudBase：
   ```bash
   cloudbase login
   ```

3. 构建项目：
   ```bash
   npm run build
   ```

4. 部署到 CloudBase：
   ```bash
   cloudbase framework deploy
   ```

## Docker 部署

项目包含 Dockerfile，可以构建 Docker 镜像进行部署：

1. 构建镜像：
   ```bash
   docker build -t my-blog .
   ```

2. 运行容器：
   ```bash
   docker run -p 8080:80 my-blog
   ```

访问 http://localhost:8080 查看应用。
