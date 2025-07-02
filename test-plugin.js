// PrompterHub 插件功能测试脚本
// 在浏览器控制台中运行此脚本来验证插件功能

(function testPrompterHubPlugin() {
    console.log('🔍 开始测试 PrompterHub 插件功能...');

    // 测试1: 检查Supabase配置
    console.log('\n📋 测试1: Supabase配置');
    const supabaseUrl = 'https://obbwereodbbhamwihdln.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9iYndlcmVvZGJiaGFtd2loZGxuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTI2MjAwMSwiZXhwIjoyMDY0ODM4MDAxfQ.u5aF7lWTF1b93NLTy_FEtBOFjUaLsKxVIPu40jRA6B4';
    
    console.log('✅ Supabase URL:', supabaseUrl);
    console.log('✅ API Key 长度:', supabaseKey.length);

    // 测试2: 检查本地存储中的认证信息
    console.log('\n📋 测试2: 检查本地认证存储');
    const authKeys = [
        'sb-obbwereodbbhamwihdln-auth-token',
        'supabase.auth.token',
        'sb-auth-token'
    ];

    authKeys.forEach(key => {
        const authData = localStorage.getItem(key) || sessionStorage.getItem(key);
        if (authData) {
            console.log(`✅ 找到认证数据: ${key}`);
            try {
                const parsed = JSON.parse(authData);
                if (parsed.access_token) {
                    console.log('  - 包含访问令牌');
                    
                    // 检查令牌是否有效
                    const payload = parseJWT(parsed.access_token);
                    if (payload) {
                        console.log('  - 令牌有效');
                        console.log('  - 用户ID:', payload.sub);
                        console.log('  - 邮箱:', payload.email);
                        console.log('  - 昵称:', payload.user_metadata?.nickname);
                        console.log('  - 过期时间:', new Date(payload.exp * 1000).toLocaleString());
                    }
                }
            } catch (e) {
                console.log('  - 解析失败');
            }
        } else {
            console.log(`❌ 未找到: ${key}`);
        }
    });

    // 测试3: 模拟API调用
    console.log('\n📋 测试3: 模拟API调用');
    
    // 获取令牌进行API测试
    let testToken = null;
    for (const key of authKeys) {
        const authData = localStorage.getItem(key) || sessionStorage.getItem(key);
        if (authData) {
            try {
                const parsed = JSON.parse(authData);
                if (parsed.access_token) {
                    testToken = parsed.access_token;
                    break;
                }
            } catch (e) {
                // ignore
            }
        }
    }

    if (testToken) {
        console.log('✅ 使用令牌测试 Supabase API...');
        
        fetch(`${supabaseUrl}/auth/v1/user`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${testToken}`,
                'apikey': supabaseKey,
                'Content-Type': 'application/json'
            }
        })
        .then(response => {
            console.log('API 响应状态:', response.status);
            if (response.ok) {
                return response.json();
            } else {
                throw new Error(`API 错误: ${response.status}`);
            }
        })
        .then(user => {
            console.log('✅ 成功获取用户信息:');
            console.log('  - ID:', user.id);
            console.log('  - 邮箱:', user.email);
            console.log('  - 昵称:', user.user_metadata?.nickname);
            console.log('  - 创建时间:', user.created_at);
        })
        .catch(error => {
            console.log('❌ API 调用失败:', error.message);
        });
    } else {
        console.log('❌ 无认证令牌，跳过API测试');
    }

    // 测试4: 检查页面元素
    console.log('\n📋 测试4: 检查页面元素');
    
    const userSelectors = [
        '[data-user-id]',
        '[data-user-email]',
        '.user-avatar',
        '.user-name',
        '.user-info'
    ];

    userSelectors.forEach(selector => {
        const element = document.querySelector(selector);
        if (element) {
            console.log(`✅ 找到用户元素: ${selector}`);
            console.log('  - 内容:', element.textContent?.trim().substring(0, 50));
        } else {
            console.log(`❌ 未找到: ${selector}`);
        }
    });

    // 测试5: 检查URL模式
    console.log('\n📋 测试5: URL分析');
    console.log('当前URL:', window.location.href);
    console.log('路径:', window.location.pathname);
    
    const urlMatch = window.location.pathname.match(/^\/([^\/]+)$/);
    if (urlMatch && urlMatch[1] && 
        !['auth', 'login', 'signup', 'dashboard', 'settings', 'templates', 'community'].includes(urlMatch[1])) {
        console.log('✅ 可能的用户名从URL:', urlMatch[1]);
    } else {
        console.log('❌ URL不匹配用户页面模式');
    }

    // 测试结果总结
    console.log('\n🎯 测试总结:');
    console.log('如果您看到上述测试结果中有"✅ 成功获取用户信息"，说明插件应该能正常工作。');
    console.log('如果大部分是"❌"，请按照故障排除指南操作：');
    console.log('1. 确保在 PrompterHub.cn 上已登录');
    console.log('2. 检查浏览器是否允许第三方Cookie');
    console.log('3. 尝试刷新页面后重新运行此测试');

    // JWT解析函数
    function parseJWT(token) {
        try {
            const parts = token.split('.');
            if (parts.length !== 3) return null;
            
            const payload = parts[1];
            const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
            return JSON.parse(decoded);
        } catch (error) {
            return null;
        }
    }
})();

// 使用说明：
// 1. 在 PrompterHub.cn 页面打开开发者工具（F12）
// 2. 在 Console 标签中粘贴并运行此脚本
// 3. 查看测试结果判断插件是否能正常工作 