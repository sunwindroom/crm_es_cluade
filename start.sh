#!/bin/bash
echo "🚀 启动 CRM 系统 v2.0"
echo "================================"

# 获取脚本所在目录（兼容不同调用方式）
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 请先安装 Node.js (推荐 v18 LTS): https://nodejs.org"
    exit 1
fi

echo "✅ Node.js 版本: $(node -v)"
echo "✅ npm 版本: $(npm -v)"

# ==================== npm 镜像源处理 ====================
echo ""
echo "🔧 检查 npm 镜像源..."
CURRENT_REGISTRY=$(npm config get registry)
echo "   当前镜像源: $CURRENT_REGISTRY"

# 如果配置了 npmmirror 但不是官方源，先尝试官方源
if echo "$CURRENT_REGISTRY" | grep -q "npmmirror"; then
    echo "   检测到 npmmirror，尝试切换到官方源..."
    npm config set registry https://registry.npmjs.org
fi

# 测试网络连通性
echo "   测试网络连通性..."
if curl -s --connect-timeout 5 https://registry.npmjs.org > /dev/null 2>&1; then
    npm config set registry https://registry.npmjs.org
    echo "   ✅ 使用官方源: https://registry.npmjs.org"
elif curl -s --connect-timeout 5 https://registry.npmmirror.com > /dev/null 2>&1; then
    npm config set registry https://registry.npmmirror.com
    echo "   ✅ 使用国内镜像: https://registry.npmmirror.com"
else
    echo "   ⚠️  网络不可用，将尝试使用已缓存的依赖"
fi

# ==================== 后端 ====================
echo ""
echo "📦 [后端] 安装依赖..."
cd "$SCRIPT_DIR/backend"

if [ ! -d "node_modules/express" ]; then
    npm install
    if [ $? -ne 0 ]; then
        echo ""
        echo "❌ 后端依赖安装失败！常见解决方案："
        echo ""
        echo "   1. better-sqlite3 编译问题（Linux）："
        echo "      sudo apt-get install build-essential python3-dev"
        echo "      cd backend && npm install --build-from-source"
        echo ""
        echo "   2. better-sqlite3 编译问题（macOS）："
        echo "      xcode-select --install"
        echo "      cd backend && npm install"
        echo ""
        echo "   3. 网络问题："
        echo "      npm config set registry https://registry.npmjs.org"
        echo "      或使用代理后重试"
        exit 1
    fi
else
    echo "   ✅ 依赖已存在，跳过安装"
fi

# 确保 .env 文件存在
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "   ✅ 已创建 .env 配置文件"
fi

echo ""
echo "🔧 [后端] 启动服务..."
npm start &
BACKEND_PID=$!

# 等待后端启动（最多12秒）
echo "   等待后端就绪..."
READY=0
for i in $(seq 1 12); do
    sleep 1
    if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
        echo "   ✅ 后端已就绪 (http://localhost:3001)"
        READY=1
        break
    fi
done

if [ $READY -eq 0 ]; then
    echo "   ⚠️  后端启动超时，请检查上方错误信息"
    echo "      常见原因: better-sqlite3 未正确编译"
    echo "      解决: cd backend && npm install --build-from-source better-sqlite3"
fi

# ==================== 前端 ====================
echo ""
echo "📦 [前端] 安装依赖..."
cd "$SCRIPT_DIR/frontend"

if [ ! -d "node_modules/react" ]; then
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ 前端依赖安装失败！"
        echo "   请手动执行: cd frontend && npm install"
        kill $BACKEND_PID 2>/dev/null
        exit 1
    fi
else
    echo "   ✅ 依赖已存在，跳过安装"
fi

echo ""
echo "🎨 [前端] 启动开发服务..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "================================"
echo "✅ CRM 系统启动成功！"
echo ""
echo "   🌐 访问地址:  http://localhost:5173"
echo "   🔧 API地址:   http://localhost:3001/api/health"
echo ""
echo "   演示账号（密码均为 Admin@123）:"
echo "   ┌─────────────┬──────────────┐"
echo "   │ admin       │ 系统管理员   │"
echo "   │ president   │ 总裁         │"
echo "   │ mkt_vp      │ 营销副总裁   │"
echo "   │ tech_vp     │ 技术副总裁   │"
echo "   │ sm001       │ 销售经理     │"
echo "   │ sales001    │ 销售         │"
echo "   │ finance001  │ 财务         │"
echo "   └─────────────┴──────────────┘"
echo ""
echo "   按 Ctrl+C 停止所有服务"
echo "================================"

# 捕获退出信号，清理进程
trap "echo ''; echo '正在停止服务...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo '✅ 已停止'; exit 0" INT TERM

wait $FRONTEND_PID
kill $BACKEND_PID 2>/dev/null
