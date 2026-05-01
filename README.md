# 范畴之外 / Beyond the Categorical

> 当巴别的回声不再分类，神学便走到范畴之外。

## 试玩

在线试玩（GitHub Pages）：
**https://dengxiaocheng.github.io/TheologyGame-BeyondCategorical/**

## 本地运行

无需构建步骤，直接在浏览器中打开：

```bash
# 方式一：直接打开
open index.html          # macOS
xdg-open index.html      # Linux

# 方式二：简易 HTTP 服务器
python3 -m http.server 8080
# 然后访问 http://localhost:8080
```

## 项目结构

```
index.html          — 静态入口
js/main.js          — 游戏入口脚本
plan/legacy-takeover/ — 修复计划与缺陷清单
test.mjs            — Playwright 测试
```
