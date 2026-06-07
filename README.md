# email2issue

将电子邮件自动转换为 GitHub Issues 的 Cloudflare Worker。

## 📖 项目简介

email2issue 是一个基于 Cloudflare Workers 构建的邮件路由服务，它能够：

1. **接收电子邮件**：通过 Cloudflare Email Routing 接收发送到指定邮箱的邮件
2. **转发邮件**：可选地将邮件原样转发到另一个邮箱地址
3. **创建 GitHub Issue**：自动将邮件内容转换为 GitHub Issue，包括发件人、发送时间和邮件正文

这个工具非常适合用于：
- 将用户反馈邮件自动转为 Issue
- 收集匿名建议或报告
- 建立邮件到项目管理系统的自动化流程

## ✨ 功能特性

- 📧 **邮件解析**：使用 `postal-mime` 库解析 MIME 格式的电子邮件
- 🔄 **邮件转发**：支持将接收到的邮件原样转发到指定邮箱
- 🐙 **GitHub 集成**：自动将邮件内容发布为 GitHub Repository 的 Issue
- ⚡ **Serverless**：基于 Cloudflare Workers，无需管理服务器
- 📝 **格式化输出**：Issue 内容包含发件人、时间和格式化的邮件正文

## 🛠️ 技术栈

- **运行时**：Cloudflare Workers
- **开发工具**：Wrangler (v4.98.0)
- **邮件解析**：postal-mime (v2.7.4)
- **语言**：JavaScript (ES Modules)

## 📋 前置要求

在开始之前，请确保你拥有：

1. **Cloudflare 账户**：已启用 Email Routing 功能
2. **GitHub Personal Access Token**：具有 `repo` 权限
3. **Node.js**：用于本地开发和部署（推荐 v16+）
4. **Wrangler CLI**：Cloudflare Workers 的命令行工具

## 🚀 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/Dennis114514/email2issue.git
cd email2issue/email2issues
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

编辑 `wrangler.jsonc` 文件，修改以下变量：

```jsonc
{
  "vars": {
    "GITHUB_OWNER": "你的GitHub用户名",
    "GITHUB_REPO": "目标仓库名称",
    "FORWARD_TO": "转发邮箱地址（可选）"
  }
}
```

**配置说明：**
- `GITHUB_OWNER`: GitHub 用户名或组织名
- `GITHUB_REPO`: 要创建 Issue 的目标仓库
- `FORWARD_TO`: （可选）接收转发邮件的邮箱地址

### 4. 设置 GitHub Token

在 Cloudflare Dashboard 中为 Worker 添加 Secret：

```bash
wrangler secret put GITHUB_TOKEN
```

输入你的 GitHub Personal Access Token（需要 `repo` 权限）。

### 5. 配置 Cloudflare Email Routing

1. 在 Cloudflare Dashboard 中启用 Email Routing
2. 创建一个自定义邮箱地址（如 `feedback@yourdomain.com`）
3. 将该邮箱地址的路由规则指向此 Worker

### 6. 本地开发

```bash
npm run dev
```

这将启动本地开发服务器，你可以在本地测试 Worker 的功能。

### 7. 部署到 Cloudflare

```bash
npm run deploy
```

## 📁 项目结构

```
email2issue/
├── email2issues/
│   ├── src/
│   │   └── index.js          # 主要的 Worker 代码
│   ├── wrangler.jsonc        # Wrangler 配置文件
│   ├── package.json          # 项目依赖和脚本
│   ├── .gitignore           # Git 忽略文件
│   └── AGENTS.md            # Cloudflare Workers 开发指南
├── package.json             # 根目录依赖
└── README.md                # 项目说明文档
```

## 🔧 工作原理

### 邮件处理流程

1. **接收邮件**：Cloudflare Email Routing 将邮件传递给 Worker
2. **转发邮件**（可选）：如果配置了 `FORWARD_TO`，则原样转发邮件
3. **解析邮件**：
   - 提取主题、发件人、日期等标头信息
   - 使用 `postal-mime` 解析邮件正文（优先纯文本，其次 HTML）
4. **创建 Issue**：
   - 构造 Issue 标题：`[邮件转发] {原始主题}`
   - 构造 Issue 内容：包含发件人、时间和邮件正文的引用格式
   - 调用 GitHub API 创建 Issue
5. **错误处理**：如果 GitHub API 调用失败，拒绝邮件并返回错误信息

### 代码示例

核心处理逻辑位于 [`src/index.js`](email2issues/src/index.js)：

```javascript
export default {
  async email(message, env, ctx) {
    // 1. 转发邮件（可选）
    if (env.FORWARD_TO) {
      await message.forward(env.FORWARD_TO);
    }
    
    // 2. 解析邮件内容
    const subject = message.headers.get("subject") || "无主题";
    const from = message.from;
    const rawEmail = await new Response(message.raw).arrayBuffer();
    const parsedEmail = await new PostalMime().parse(rawEmail);
    
    // 3. 创建 GitHub Issue
    const githubUrl = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/issues`;
    await fetch(githubUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
        // ... 其他头部信息
      },
      body: JSON.stringify({
        title: `[邮件转发] ${subject}`,
        body: formattedBody
      })
    });
  }
};
```

## 📝 Issue 格式示例

收到的邮件将被转换为如下格式的 GitHub Issue：

```markdown
> **发送者:** user@example.com
> **发送时间:** Mon, 7 Jun 2026 15:00:00 +0800

---

这是邮件的正文内容...
```

## 🔐 安全注意事项

1. **保护 GitHub Token**：
   - 永远不要将 Token 硬编码在代码中
   - 使用 `wrangler secret put` 安全存储
   - 定期轮换 Token

2. **限制访问**：
   - 仅允许受信任的邮箱地址发送邮件
   - 考虑在 Worker 中添加发件人验证

3. **监控使用**：
   - 定期检查 Cloudflare Workers 的使用情况
   - 监控 GitHub API 调用次数

## 🐛 故障排除

### 邮件未创建 Issue

1. 检查 Cloudflare Workers 日志：
   ```bash
   wrangler tail
   ```

2. 验证环境变量是否正确配置
3. 确认 GitHub Token 有效且具有足够权限
4. 检查 GitHub API 速率限制

### 邮件转发失败

- 确认 `FORWARD_TO` 邮箱地址有效
- 检查 Cloudflare Email Routing 配置
- 查看 Worker 日志中的错误信息

### 本地开发问题

- 确保已登录 Wrangler：`wrangler login`
- 检查 Node.js 版本兼容性
- 清除 `node_modules` 并重新安装依赖

## 📄 许可证

本项目采用 MIT 许可证。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建功能分支：`git checkout -b feature/amazing-feature`
3. 提交更改：`git commit -m 'Add some amazing feature'`
4. 推送到分支：`git push origin feature/amazing-feature`
5. 开启 Pull Request

## 📞 支持与反馈

如有问题或建议，请：
- 在 [GitHub Issues](https://github.com/Dennis114514/email2issues/issues) 中提交问题
- 发送邮件至项目维护者

## 🔗 相关链接

- [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
- [Cloudflare Email Routing](https://developers.cloudflare.com/email-routing/)
- [GitHub API 文档](https://docs.github.com/en/rest/issues/issues)
- [postal-mime 库](https://github.com/postalsys/postal-mime)
- [Wrangler 文档](https://developers.cloudflare.com/workers/wrangler/)

---

**Made with by Dennis114514 and Gemini**
