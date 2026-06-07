import PostalMime from 'postal-mime';

export default {
  async email(message, env, ctx) {
    try {
      if (env.FORWARD_TO) {
        // 调用 Cloudflare 原生转发方法
        await message.forward(env.FORWARD_TO);
        console.log(`邮件已成功原样转发至: ${env.FORWARD_TO}`);
      } else {
        console.warn("未检测到 FORWARD_TO 环境变量，跳过原样转发。");
      }
    } catch (forwardError) {
      // 转发失败仅记录日志，不中断后续转 Issue 的流程
      console.error("邮件转发失败:", forwardError);
    }
    
    try {
      // 1. 获取邮件信封信息和标头
      const subject = message.headers.get("subject") || "无主题";
      const from = message.from;
      const date = message.headers.get("date") || new Date().toLocaleString();

      // 2. 解析邮件正文
      // message.raw 是一个 ReadableStream，需要转换为 ArrayBuffer 供解析
      const rawEmail = await new Response(message.raw).arrayBuffer();
      const parser = new PostalMime();
      const parsedEmail = await parser.parse(rawEmail);

      // 优先提取纯文本正文，若无则尝试 HTML，最后提供默认提示
      const emailBody = parsedEmail.text || parsedEmail.html || "（此邮件无正文内容）";

      // 3. 构造要提交到 GitHub Issue 的内容
      const issueTitle = `[邮件转发] ${subject}`;
      const issueBody = `> **发送者:** ${from}\n> **发送时间:** ${date}\n\n---\n\n${emailBody}`;

      // 4. 发送请求到 GitHub API
      const githubUrl = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/issues`;

      const githubResponse = await fetch(githubUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
          'User-Agent': 'Cloudflare-Worker-Email-Router', // GitHub API 要求必须有 User-Agent
          'X-GitHub-Api-Version': '2022-11-28'
        },
        body: JSON.stringify({
          title: issueTitle,
          body: issueBody
        })
      });

      if (!githubResponse.ok) {
        const errorText = await githubResponse.text();
        console.error("GitHub API 请求失败:", errorText);
        // 拒绝邮件，发件人会收到投递失败的退信
        message.setReject("服务器内部错误，无法将你的邮件自动转换为GitHub issues，请您在原始仓库中手动创建，或者在https://github.com/Dennis114514/email2issue/ 反馈");
        return;
      }

      console.log(`成功将邮件 "${subject}" 转发为 Issue`);
      
    } catch (error) {
      console.error("处理邮件时发生异常:", error);
      message.setReject("邮件解析或处理异常。");
    }
  }
};