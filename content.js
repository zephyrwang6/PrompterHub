// PrompterHub Assistant - Content Script
// Detect user login status on PrompterHub website

class AuthDetector {
    constructor() {
        this.currentAuthStatus = { isLoggedIn: false, user: null };
        this.lastKnownAuthState = null;
        this.supabaseUrl = 'https://obbwereodbbhamwihdln.supabase.co';
        this.supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9iYndlcmVvZGJiaGFtd2loZGxuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTI2MjAwMSwiZXhwIjoyMDY0ODM4MDAxfQ.u5aF7lWTF1b93NLTy_FEtBOFjUaLsKxVIPu40jRA6B4';
        
        this.init();
    }

    init() {
        // 监听插件消息
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.type === 'CHECK_AUTH_STATUS') {
                this.checkAuth().then(auth => {
                    console.log('Auth status checked:', auth);
                    sendResponse(auth);
                }).catch(error => {
                    console.error('Error checking auth:', error);
                    sendResponse({ isLoggedIn: false, user: null, error: error.message });
                });
                return true; // 保持消息通道开放
            }
        });

        // 初始检查
        setTimeout(() => {
            this.performInitialCheck();
        }, 1000);

        // 监听页面变化
        this.observeChanges();
        
        // 监听登出按钮点击
        this.observeLogoutActions();
    }

    async performInitialCheck() {
        try {
            const authStatus = await this.checkAuth();
            console.log('Initial auth check:', authStatus);
            this.lastKnownAuthState = authStatus;
            this.saveAuth(authStatus);
            this.notifyAuthChange(authStatus);
        } catch (error) {
            console.error('Initial auth check failed:', error);
        }
    }

    async checkAuth() {
        console.log('Checking auth status on:', window.location.href);
        
        try {
            // 方法1: 直接调用Supabase API获取当前用户
            const supabaseUser = await this.getSupabaseUser();
            if (supabaseUser) {
                console.log('Found Supabase user:', supabaseUser);
                return {
                    isLoggedIn: true,
                    user: {
                        id: supabaseUser.id,
                        email: supabaseUser.email,
                        nickname: supabaseUser.user_metadata?.nickname || 
                                 supabaseUser.email?.split('@')[0] || 
                                 'User'
                    },
                    source: 'supabase_api'
                };
            }

            // 方法2: 检查localStorage中的Supabase token
            const storageAuth = await this.checkSupabaseStorage();
            if (storageAuth.isLoggedIn) {
                console.log('Found auth in Supabase storage:', storageAuth);
                return storageAuth;
            }

            // 方法3: 检查是否明确处于登出状态
            const logoutState = this.checkLogoutState();
            if (logoutState.isLoggedOut) {
                console.log('Detected logout state:', logoutState.reason);
                return { isLoggedIn: false, user: null, reason: logoutState.reason };
            }

            // 方法4: 检查页面中的用户信息 (简化版)
            const pageUser = this.extractUserFromPage();
            if (pageUser) {
                console.log('Found user from page:', pageUser);
                return { isLoggedIn: true, user: pageUser, source: 'page_content' };
            }

            console.log('No auth detected');
            return { isLoggedIn: false, user: null };
            
        } catch (error) {
            console.error('Auth check failed:', error);
            return { isLoggedIn: false, user: null, error: error.message };
        }
    }

    async getSupabaseUser() {
        try {
            // 获取Supabase token
            const token = this.getSupabaseToken();
            if (!token) {
                console.log('No Supabase token found');
                return null;
            }

            // 调用Supabase API获取用户信息
            const response = await fetch(`${this.supabaseUrl}/auth/v1/user`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'apikey': this.supabaseKey,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                console.log('Supabase API response not ok:', response.status);
                return null;
            }

            const user = await response.json();
            console.log('Supabase user data:', user);
            
            return user;
            
        } catch (error) {
            console.error('Failed to get Supabase user:', error);
            return null;
        }
    }

    getSupabaseToken() {
        try {
            // 检查多种可能的Supabase token存储位置
            const possibleKeys = [
                `sb-${this.supabaseUrl.split('//')[1].split('.')[0]}-auth-token`,
                'sb-obbwereodbbhamwihdln-auth-token',
                'supabase.auth.token',
                'sb-auth-token'
            ];

            for (const key of possibleKeys) {
                const authData = localStorage.getItem(key) || sessionStorage.getItem(key);
                if (authData) {
                    try {
                        const parsed = JSON.parse(authData);
                        const token = parsed.access_token || parsed.token;
                        if (token && this.isTokenValid(token)) {
                            console.log('Found valid token with key:', key);
                            return token;
                        }
                    } catch (e) {
                        console.log('Failed to parse auth data for key:', key);
                    }
                }
            }

            return null;
        } catch (error) {
            console.error('Failed to get Supabase token:', error);
            return null;
        }
    }

    isTokenValid(token) {
        try {
            const payload = this.parseJWT(token);
            if (!payload) return false;
            
            // 检查token是否过期
            const now = Math.floor(Date.now() / 1000);
            return payload.exp > now;
        } catch (error) {
            return false;
        }
    }

    async checkSupabaseStorage() {
        try {
            const token = this.getSupabaseToken();
            if (!token) {
                return { isLoggedIn: false, user: null };
            }

            const payload = this.parseJWT(token);
            if (!payload) {
                return { isLoggedIn: false, user: null };
            }

            // 从token payload中提取用户信息
            const user = {
                id: payload.sub,
                email: payload.email,
                nickname: payload.user_metadata?.nickname || 
                         payload.email?.split('@')[0] || 
                         'User'
            };

            return {
                isLoggedIn: true,
                user,
                source: 'supabase_storage'
            };

        } catch (error) {
            console.error('Failed to check Supabase storage:', error);
            return { isLoggedIn: false, user: null };
        }
    }

    checkLogoutState() {
        // 检查明确的登出指示器
        
        // 1. 检查是否在登录页面
        if (window.location.pathname.includes('/auth/login') || 
            window.location.pathname.includes('/login') ||
            window.location.pathname.includes('/signin')) {
            return { isLoggedOut: true, reason: 'on_login_page' };
        }

        // 2. 检查页面是否显示登录按钮
        const loginSelectors = [
            'a[href*="/auth/login"]',
            'a[href*="/login"]', 
            'button:contains("登录")',
            'button:contains("Login")',
            'a:contains("登录")',
            'a:contains("Login")'
        ];

        for (const selector of loginSelectors) {
            try {
                if (selector.includes(':contains(')) {
                    // 处理包含文本的选择器
                    const text = selector.match(/:contains\("(.+?)"\)/)[1];
                    const baseSelector = selector.replace(/:contains\(".+?"\)/, '');
                    const elements = document.querySelectorAll(baseSelector);
                    for (const element of elements) {
                        if (element.textContent && element.textContent.includes(text)) {
                            return { isLoggedOut: true, reason: 'login_button_visible' };
                        }
                    }
                } else {
                    const element = document.querySelector(selector);
                    if (element && element.offsetParent !== null) {
                        return { isLoggedOut: true, reason: 'login_link_visible' };
                    }
                }
            } catch (error) {
                // 忽略选择器错误
            }
        }

        return { isLoggedOut: false };
    }

    extractUserFromPage() {
        try {
            // 尝试从页面的全局状态或内容中提取用户信息
            
            // 检查是否有用户相关的元素
            const userSelectors = [
                '[data-user-id]',
                '[data-user-email]', 
                '.user-avatar',
                '.user-name',
                '.user-info'
            ];

            for (const selector of userSelectors) {
                const element = document.querySelector(selector);
                if (element) {
                    const userId = element.getAttribute('data-user-id');
                    const userEmail = element.getAttribute('data-user-email');
                    const userName = element.textContent?.trim();

                    if (userId || userEmail || userName) {
                        return {
                            id: userId || 'page_user',
                            email: userEmail || '',
                            nickname: userName || userEmail?.split('@')[0] || 'User'
                        };
                    }
                }
            }

            // 检查URL中的用户名
            const urlMatch = window.location.pathname.match(/^\/([^\/]+)$/);
            if (urlMatch && urlMatch[1] && 
                !['auth', 'login', 'signup', 'dashboard', 'settings', 'templates', 'community'].includes(urlMatch[1])) {
                return {
                    id: `user_${urlMatch[1]}`,
                    nickname: urlMatch[1],
                    email: ''
                };
            }

            return null;
        } catch (error) {
            console.error('Failed to extract user from page:', error);
            return null;
        }
    }

    observeLogoutActions() {
        try {
            // 监听登出相关的点击事件
            document.addEventListener('click', (event) => {
                const target = event.target;
                if (!target) return;

                // 检查是否点击了登出按钮
                const isLogoutAction = 
                    target.textContent?.includes('退出') ||
                    target.textContent?.includes('登出') ||
                    target.textContent?.includes('Logout') ||
                    target.textContent?.includes('Sign out') ||
                    target.href?.includes('logout') ||
                    target.href?.includes('signout') ||
                    target.onclick?.toString().includes('logout');

                if (isLogoutAction) {
                    console.log('Logout action detected');
                    setTimeout(() => {
                        this.clearAuthState();
                        this.notifyAuthChange({ isLoggedIn: false, user: null, reason: 'logout_action' });
                    }, 500);
                }
            });

            // 监听URL变化到登录页面
            const originalPushState = history.pushState;
            const originalReplaceState = history.replaceState;

            history.pushState = function(...args) {
                originalPushState.apply(history, args);
                setTimeout(() => this.checkUrlForLogout(), 100);
            };

            history.replaceState = function(...args) {
                originalReplaceState.apply(history, args);
                setTimeout(() => this.checkUrlForLogout(), 100);
            };

            window.addEventListener('popstate', () => {
                setTimeout(() => this.checkUrlForLogout(), 100);
            });

        } catch (error) {
            console.error('Failed to setup logout observers:', error);
        }
    }

    checkUrlForLogout() {
        if (window.location.pathname.includes('/auth/login') || 
            window.location.pathname.includes('/login')) {
            console.log('Navigated to login page - user logged out');
            this.clearAuthState();
            this.notifyAuthChange({ isLoggedIn: false, user: null, reason: 'navigated_to_login' });
        }
    }

    clearAuthState() {
        try {
            this.currentAuthStatus = { isLoggedIn: false, user: null };
            chrome.storage.local.remove(['userAuth']);
        } catch (error) {
            console.error('Failed to clear auth state:', error);
        }
    }

    parseJWT(token) {
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

    saveAuth(authData) {
        try {
            chrome.storage.local.set({ 
                userAuth: {
                    ...authData,
                    timestamp: Date.now(),
                    url: window.location.href
                }
            });
        } catch (error) {
            console.log('Failed to save auth:', error);
        }
    }

    notifyAuthChange(authStatus) {
        try {
            chrome.runtime.sendMessage({
                type: 'AUTH_STATUS_CHANGED',
                ...authStatus
            });
        } catch (error) {
            console.log('Failed to notify auth change:', error);
        }
    }

    observeChanges() {
        let timeout;
        const observer = new MutationObserver(() => {
            // 防抖，避免频繁检查
            clearTimeout(timeout);
            timeout = setTimeout(async () => {
                const authStatus = await this.checkAuth();
                
                // 只有当状态真正改变时才更新
                if (JSON.stringify(authStatus) !== JSON.stringify(this.currentAuthStatus)) {
                    console.log('Auth status changed:', {
                        from: this.currentAuthStatus,
                        to: authStatus
                    });
                    
                    this.currentAuthStatus = authStatus;
                    this.saveAuth(authStatus);
                    this.notifyAuthChange(authStatus);
                }
            }, 1000);
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'id', 'data-user-id', 'data-user-email']
        });

        // 监听存储变化
        window.addEventListener('storage', async (event) => {
            if (event.key && event.key.includes('auth')) {
                console.log('Storage auth changed:', event.key);
                setTimeout(async () => {
                    const authStatus = await this.checkAuth();
                    this.currentAuthStatus = authStatus;
                    this.saveAuth(authStatus);
                    this.notifyAuthChange(authStatus);
                }, 500);
            }
        });
    }
}

// 确保只创建一个实例
if (!window.prompterhubAuthDetector) {
    window.prompterhubAuthDetector = new AuthDetector();
    console.log('PrompterHub Auth Detector initialized');
} 