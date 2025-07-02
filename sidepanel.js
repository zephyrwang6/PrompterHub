// PrompterHub Assistant - Sidepanel JavaScript

class PrompterHubSidepanel {
    constructor() {
        this.currentUser = null;
        this.currentTab = 'created';
        this.baseUrl = 'https://www.prompterhub.cn';
        this.apiUrl = 'https://www.prompterhub.cn/api';
        this.checkingAuth = false;
        this.lastAuthState = null;
        this.starredTemplates = [];
        this.currentDetailItem = null; // 当前显示详情的项目
        this.isDetailView = false; // 是否在详情视图
        this.activeToasts = []; // 当前显示的提示列表
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.checkAuthStatus();
        
        // 定期检查认证状态（防止某些情况下未收到消息）
        setInterval(() => {
            this.checkAuthStatus();
        }, 30000); // 每30秒检查一次
    }

    bindEvents() {
        // Login button event
        const loginBtn = document.getElementById('loginBtn');
        if (loginBtn) {
            loginBtn.addEventListener('click', () => {
                console.log('Login button clicked');
                this.openAuthPage('/auth/login');
            });
        }

        // Signup button event
        const signupBtn = document.getElementById('signupBtn');
        if (signupBtn) {
            signupBtn.addEventListener('click', () => {
                console.log('Signup button clicked');
                this.openAuthPage('/auth/signup');
            });
        }

        // Refresh button event
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                console.log('Refresh button clicked');
                this.checkAuthStatus(true); // 强制刷新
            });
        }

        // Logo click event
        const headerLogo = document.querySelector('.header-logo');
        if (headerLogo) {
            headerLogo.addEventListener('click', async () => {
                console.log('Logo clicked, opening homepage');
                try {
                    await chrome.tabs.create({ url: 'https://www.prompterhub.cn' });
                } catch (error) {
                    console.error('Failed to open homepage:', error);
                }
            });
        }

        // User info container click event
        const headerUser = document.getElementById('headerUser');
        if (headerUser) {
            headerUser.addEventListener('click', async () => {
                if (this.currentUser && this.currentUser.nickname) {
                    const username = this.currentUser.nickname;
                    const userUrl = `https://www.prompterhub.cn/${username}`;
                    console.log('User info clicked, opening:', userUrl);
                    try {
                        await chrome.tabs.create({ url: userUrl });
                    } catch (error) {
                        console.error('Failed to open user page:', error);
                    }
                } else {
                    console.log('User not logged in or no username available');
                }
            });
        }

        // Tab switching events
        document.querySelectorAll('.tab-item').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Detail view events
        const backBtn = document.getElementById('backBtn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                this.hideDetailView();
            });
        }

        const copyBtn = document.getElementById('copyBtn');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                this.copyPromptContent();
            });
        }

        const shareBtn = document.getElementById('shareBtn');
        if (shareBtn) {
            shareBtn.addEventListener('click', () => {
                this.sharePrompt();
            });
        }

        const copyFullBtn = document.getElementById('copyFullBtn');
        if (copyFullBtn) {
            copyFullBtn.addEventListener('click', () => {
                this.copyFullPrompt();
            });
        }

        const likeDetailBtn = document.getElementById('likeDetailBtn');
        if (likeDetailBtn) {
            likeDetailBtn.addEventListener('click', () => {
                this.likeCurrentPrompt();
            });
        }

        const visitBtn = document.getElementById('visitBtn');
        if (visitBtn) {
            visitBtn.addEventListener('click', () => {
                this.visitPromptPage();
            });
        }

        // Listen for messages from content script and background
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            console.log('Received message:', request);
            
            if (request.type === 'AUTH_STATUS_CHANGED') {
                console.log('Auth status changed, updating UI');
                
                // 检查是否从登录状态变为登出状态
                if (this.lastAuthState?.isLoggedIn && !request.isLoggedIn) {
                    console.log('User logged out, clearing local state');
                    this.handleLogout();
                } else if (request.isLoggedIn && request.user) {
                    // 用户登录，更新状态
                    console.log('User logged in, updating state');
                    this.currentUser = request.user;
                    this.showUserPanel();
                    this.loadUserData(this.currentTab);
                } else {
                    // 其他状态变化，重新检查
                    this.checkAuthStatus(true);
                }
                
                this.lastAuthState = { 
                    isLoggedIn: request.isLoggedIn, 
                    user: request.user 
                };
            }
        });

        // Listen for tab changes
        chrome.tabs.onActivated.addListener(() => {
            setTimeout(() => {
                this.checkAuthStatus();
            }, 1000);
        });

        // Listen for tab updates
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            if (changeInfo.status === 'complete' && tab.url && tab.url.includes('prompterhub.cn')) {
                console.log('PrompterHub tab updated, checking auth');
                setTimeout(() => {
                    this.checkAuthStatus();
                }, 2000);
            }
        });

        // Listen for storage changes
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (changes.userAuth) {
                console.log('Storage auth changed:', changes.userAuth);
                
                // 如果认证信息被清除，立即处理登出
                if (!changes.userAuth.newValue || !changes.userAuth.newValue.isLoggedIn) {
                    console.log('Auth storage cleared, handling logout');
                    this.handleLogout();
                } else {
                    this.checkAuthStatus(true);
                }
            }
        });
    }

    handleLogout() {
        console.log('Handling user logout');
        
        // 清除当前用户信息
        this.currentUser = null;
        this.lastAuthState = { isLoggedIn: false, user: null };
        this.starredTemplates = [];
        
        // 清除所有气泡提示
        this.clearAllToasts();
        
        // 清除本地存储
        this.clearLocalAuthData();
        
        // 立即显示登录面板
        this.showLoginPanel();
        
        // 清空内容区域
        const tabContent = document.getElementById('tabContent');
        if (tabContent) {
            tabContent.innerHTML = '';
        }
    }

    // 清除所有气泡提示
    clearAllToasts() {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        
        // 清除所有计时器并移除DOM元素
        this.activeToasts.forEach(toastObj => {
            if (toastObj.timeoutId) {
                clearTimeout(toastObj.timeoutId);
            }
            if (toastObj.element && container.contains(toastObj.element)) {
                container.removeChild(toastObj.element);
            }
        });
        
        // 清空跟踪列表
        this.activeToasts = [];
    }

    clearLocalAuthData() {
        try {
            // 清除Chrome存储中的认证信息
            chrome.storage.local.remove(['userAuth'], () => {
                console.log('Cleared auth data from storage');
            });
        } catch (error) {
            console.error('Failed to clear local auth data:', error);
        }
    }

    async openAuthPage(path) {
        try {
            console.log(`Opening: ${this.baseUrl}${path}`);
            await chrome.tabs.create({
                url: `${this.baseUrl}${path}`
            });
        } catch (error) {
            console.error('Failed to open auth page:', error);
        }
    }

    async checkAuthStatus(forceCheck = false) {
        if (this.checkingAuth && !forceCheck) {
            console.log('Auth check already in progress');
            return;
        }
        
        this.checkingAuth = true;
        console.log('Checking auth status...');

        try {
            // 方法1: 从存储中获取认证信息
            const result = await chrome.storage.local.get(['userAuth']);
            if (result.userAuth && result.userAuth.isLoggedIn && result.userAuth.user) {
                console.log('Found auth in storage:', result.userAuth);
                
                // 检查状态是否发生变化
                const wasLoggedOut = !this.currentUser;
                this.currentUser = result.userAuth.user;
                
                if (wasLoggedOut) {
                    console.log('User logged in from storage, showing user panel');
                    this.showUserPanel();
                    this.loadUserData(this.currentTab);
                }
                
                this.checkingAuth = false;
                return;
            }

            // 方法2: 检查当前活动标签页的PrompterHub页面
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const currentTab = tabs[0];
            
            if (currentTab && currentTab.url && currentTab.url.includes('prompterhub.cn')) {
                try {
                    console.log('Sending auth check message to current tab');
                    const response = await chrome.tabs.sendMessage(currentTab.id, { 
                        type: 'CHECK_AUTH_STATUS' 
                    });
                    
                    console.log('Response from content script:', response);
                    
                    if (response && response.isLoggedIn && response.user) {
                        console.log('User is logged in:', response.user);
                        
                        // 检查状态是否发生变化
                        const wasLoggedOut = !this.currentUser;
                        this.currentUser = response.user;
                        
                        if (wasLoggedOut) {
                            console.log('User logged in via content script');
                            this.showUserPanel();
                            this.loadUserData(this.currentTab);
                        }
                        
                        this.checkingAuth = false;
                        return;
                    } else if (response && !response.isLoggedIn) {
                        // 明确的未登录状态
                        if (this.currentUser) {
                            console.log('User logged out detected via content script');
                            this.handleLogout();
                            this.checkingAuth = false;
                            return;
                        }
                    }
                } catch (error) {
                    console.log('Cannot check auth status via content script:', error);
                }
            }

            // 方法3: 检查所有PrompterHub标签页
            const allTabs = await chrome.tabs.query({});
            const prompterHubTabs = allTabs.filter(tab => 
                tab.url && tab.url.includes('prompterhub.cn')
            );

            for (const tab of prompterHubTabs) {
                try {
                    console.log(`Checking tab ${tab.id}: ${tab.url}`);
                    const response = await chrome.tabs.sendMessage(tab.id, { 
                        type: 'CHECK_AUTH_STATUS' 
                    });
                    
                    if (response && response.isLoggedIn && response.user) {
                        console.log('Found logged in user in tab:', tab.id, response.user);
                        
                        // 检查状态是否发生变化
                        const wasLoggedOut = !this.currentUser;
                        this.currentUser = response.user;
                        
                        if (wasLoggedOut) {
                            console.log('User logged in via tab check');
                            this.showUserPanel();
                            this.loadUserData(this.currentTab);
                        }
                        
                        this.checkingAuth = false;
                        return;
                    }
                } catch (error) {
                    console.log(`Cannot check auth in tab ${tab.id}:`, error);
                }
            }

            // 没有找到登录状态
            console.log('No authentication found');
            
            // 如果之前是登录状态，现在变成未登录，处理登出
            if (this.currentUser) {
                console.log('User state changed from logged in to logged out');
                this.handleLogout();
            } else {
                this.currentUser = null;
                this.showLoginPanel();
            }
            
        } catch (error) {
            console.error('Failed to check auth status:', error);
            
            // 错误情况下，如果当前有用户信息且错误可能是因为登出，则处理登出
            if (this.currentUser) {
                console.log('Error checking auth, user might be logged out');
                this.handleLogout();
            } else {
                this.showLoginPanel();
            }
        } finally {
            this.checkingAuth = false;
        }
    }

    showLoginPanel() {
        console.log('Showing login panel');
        const loginPanel = document.getElementById('loginPanel');
        const userPanel = document.getElementById('userPanel');
        
        if (loginPanel) loginPanel.style.display = 'block';
        if (userPanel) userPanel.style.display = 'none';
        
        // 重置header用户信息
        const headerUser = document.getElementById('headerUser');
        const headerUserName = document.getElementById('headerUserName');
        if (headerUserName) {
            headerUserName.textContent = '未登录';
        }
        if (headerUser) {
            headerUser.classList.remove('logged-in');
        }
        
        // 显示状态信息
        this.showToast('请先登录 PrompterHub.cn', 'info');
    }

    showUserPanel() {
        console.log('Showing user panel for:', this.currentUser);
        const loginPanel = document.getElementById('loginPanel');
        const userPanel = document.getElementById('userPanel');
        
        if (loginPanel) loginPanel.style.display = 'none';
        if (userPanel) userPanel.style.display = 'block';

        if (this.currentUser) {
            // 使用真实的用户信息
            const userName = this.currentUser.nickname || 
                           this.currentUser.email?.split('@')[0] || 
                           'User';
            const userEmail = this.currentUser.email || '';
            
            // 更新header用户信息
            const headerUser = document.getElementById('headerUser');
            const headerUserName = document.getElementById('headerUserName');
            if (headerUserName) {
                headerUserName.textContent = userName;
                if (this.currentUser.nickname) {
                    headerUser.title = `访问 ${userName} 的个人页面`;
                } else {
                    headerUser.title = '';
                }
            }
            if (headerUser) {
                headerUser.classList.add('logged-in');
            }
            
            // 更新原有的用户信息区域（兼容性保持）
            const userNameEl = document.getElementById('userName');
            const userEmailEl = document.getElementById('userEmail');
            const userAvatarEl = document.getElementById('userAvatar');
            
            if (userNameEl) userNameEl.textContent = userName;
            if (userEmailEl) {
                userEmailEl.textContent = userEmail;
                userEmailEl.style.display = userEmail ? 'block' : 'none';
            }
            if (userAvatarEl) userAvatarEl.textContent = userName.charAt(0).toUpperCase();
            
            // 显示成功提示
            this.showToast('数据加载完成', 'success', 1500);
        }
    }

    // 显示气泡提示
    showToast(message, type = 'info', duration = 3000) {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        // 检查是否有重复的提示
        const duplicateIndex = this.activeToasts.findIndex(toast => 
            toast.message === message && toast.type === type
        );
        
        if (duplicateIndex !== -1) {
            // 找到重复提示，移除旧的并重置计时器
            const duplicateToast = this.activeToasts[duplicateIndex];
            this.removeToast(duplicateToast, container);
        }

        // 如果当前提示数量达到3个，移除最早的提示
        while (this.activeToasts.length >= 3) {
            const oldestToast = this.activeToasts[0];
            this.removeToast(oldestToast, container);
        }

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            success: '✅',
            info: 'ℹ️',
            warning: '⚠️',
            error: '❌'
        };
        
        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
            <span class="toast-content">${message}</span>
        `;
        
        // 创建提示对象并添加到跟踪列表
        const toastObj = {
            element: toast,
            message: message,
            type: type,
            timeoutId: null
        };
        
        this.activeToasts.push(toastObj);
        container.appendChild(toast);
        
        // 显示动画
        setTimeout(() => toast.classList.add('show'), 10);
        
        // 设置自动移除计时器
        toastObj.timeoutId = setTimeout(() => {
            this.removeToast(toastObj, container);
        }, duration);
    }

    // 移除提示的辅助方法
    removeToast(toastObj, container = null) {
        if (!toastObj || !toastObj.element) return;
        
        if (!container) {
            container = document.getElementById('toastContainer');
        }
        
        // 清除计时器
        if (toastObj.timeoutId) {
            clearTimeout(toastObj.timeoutId);
        }
        
        // 从跟踪列表中移除
        const index = this.activeToasts.indexOf(toastObj);
        if (index > -1) {
            this.activeToasts.splice(index, 1);
        }
        
        // 播放消失动画
        toastObj.element.classList.remove('show');
        
        // 延迟移除DOM元素
        setTimeout(() => {
            if (container && container.contains(toastObj.element)) {
                container.removeChild(toastObj.element);
            }
        }, 300);
    }

    switchTab(tabName) {
        console.log('Switching to tab:', tabName);
        document.querySelectorAll('.tab-item').forEach(tab => {
            tab.classList.remove('active');
        });
        const activeTab = document.querySelector(`[data-tab="${tabName}"]`);
        if (activeTab) {
            activeTab.classList.add('active');
        }

        this.currentTab = tabName;
        this.loadUserData(tabName);
    }

    async loadUserData(tabType) {
        const tabContent = document.getElementById('tabContent');
        if (!tabContent) return;
        
        console.log('Loading user data for tab:', tabType, 'User:', this.currentUser);
        tabContent.innerHTML = '<div class="loading">正在加载...</div>';

        try {
            if (!this.currentUser) {
                throw new Error('未找到用户信息，请先登录');
            }

            let data;
            
            // 使用真实的用户信息构建API调用
            const userId = this.currentUser.id;
            const userNickname = this.currentUser.nickname || this.currentUser.email?.split('@')[0];
            
            console.log('API call parameters:', { userId, userNickname, tabType });

            switch (tabType) {
                case 'created':
                    // 创作内容 - 使用nickname作为username参数
                    if (!userNickname) {
                        throw new Error('无法获取用户名信息');
                    }
                    data = await this.fetchUserPrompts(userNickname);
                    console.log('获取到的创作数据:', data);
                    if (data && data.prompts) {
                        console.log('提示词数据详情:', data.prompts.slice(0, 2)); // 显示前2条详细数据
                    }
                    this.renderPromptCards(data.prompts || [], tabContent, 'prompts');
                    break;
                case 'liked':
                    // 点赞内容 - 需要传递userId
                    if (!userNickname) {
                        throw new Error('无法获取用户名信息');
                    }
                    data = await this.fetchUserLiked(userNickname, userId);
                    console.log('获取到的点赞数据:', data);
                    if (data && data.prompts) {
                        console.log('点赞提示词数据详情:', data.prompts.slice(0, 2)); // 显示前2条详细数据
                    }
                    this.renderPromptCards(data.prompts || [], tabContent, 'prompts');
                    break;
                case 'collected':
                    // 收藏内容 - 使用userId
                    data = await this.fetchUserCollected(userId);
                    this.renderTemplateCards(data.templates || [], tabContent);
                    break;
                default:
                    throw new Error('未知的标签页类型');
            }

            console.log('Loaded data:', data);
            
        } catch (error) {
            console.error('Failed to load user data:', error);
            
            // 如果是认证错误，可能用户已登出
            if (error.message.includes('401') || 
                error.message.includes('未授权') || 
                error.message.includes('Unauthorized') ||
                error.message.includes('获取用户提示词失败') ||
                error.message.includes('获取用户点赞提示词失败')) {
                console.log('Authentication error, user might be logged out');
                this.handleLogout();
                return;
            }
            
            // 特殊处理收藏功能的错误
            if (tabType === 'collected' && error.message.includes('获取模板数据失败')) {
                tabContent.innerHTML = `
                    <div class="error">
                        <div class="error-icon">⚠️</div>
                        <h3 class="error-title">飞书API配置问题</h3>
                        <p class="error-description">
                            当前飞书多维表格的认证配置存在问题，可能是：
                        </p>
                        <ul class="error-list">
                            <li>飞书应用的访问令牌已过期</li>
                            <li>飞书多维表格的配置信息不正确</li>
                            <li>飞书应用权限设置有问题</li>
                        </ul>
                        <div class="error-actions">
                            <button onclick="window.prompterhubSidepanel.loadUserData('${tabType}')" class="retry-btn primary">
                                🔄 重试加载
                            </button>
                            <button onclick="window.prompterhubSidepanel.openFeishuDebug()" class="retry-btn secondary">
                                🔍 查看调试信息
                            </button>
                            <a href="${this.baseUrl}/best-practices" target="_blank" class="retry-btn secondary">
                                🌐 访问网站
                            </a>
                        </div>
                        <details class="error-details">
                            <summary>技术详情</summary>
                            <p><strong>错误信息:</strong> ${error.message}</p>
                            <p><strong>用户ID:</strong> ${this.currentUser?.id || 'Unknown'}</p>
                            <p><strong>用户昵称:</strong> ${this.currentUser?.nickname || 'Unknown'}</p>
                            <p><strong>API端点:</strong> ${this.apiUrl}</p>
                        </details>
                    </div>
                `;
            } else {
                // 其他错误的通用处理
                tabContent.innerHTML = `
                    <div class="error">
                        <p>加载失败: ${error.message}</p>
                        <p class="error-details">用户: ${this.currentUser?.nickname || 'Unknown'}</p>
                        <p class="error-details">Tab: ${tabType}</p>
                        <button onclick="window.prompterhubSidepanel.loadUserData('${tabType}')" class="retry-btn">
                            重试
                        </button>
                        <button onclick="window.prompterhubSidepanel.checkAuthStatus(true)" class="retry-btn">
                            检查登录状态
                        </button>
                    </div>
                `;
            }
        }
    }

    async fetchUserPrompts(username) {
        console.log('Fetching user prompts for username:', username);
        const url = `${this.apiUrl}/users/${encodeURIComponent(username)}/prompts?page=1&limit=20`;
        console.log('API URL:', url);
        
        const response = await fetch(url);
        if (!response.ok) {
            const errorText = await response.text();
            console.error('API Error:', response.status, errorText);
            throw new Error(`获取创作内容失败: ${response.status} - ${errorText}`);
        }
        return await response.json();
    }

    async fetchUserLiked(username, userId) {
        console.log('Fetching user liked for username:', username, 'userId:', userId);
        const url = `${this.apiUrl}/users/${encodeURIComponent(username)}/liked?page=1&limit=20&userId=${encodeURIComponent(userId)}`;
        console.log('API URL:', url);
        
        const response = await fetch(url);
        if (!response.ok) {
            const errorText = await response.text();
            console.error('API Error:', response.status, errorText);
            throw new Error(`获取点赞内容失败: ${response.status} - ${errorText}`);
        }
        return await response.json();
    }

    async fetchUserCollected(userId) {
        console.log('Fetching user collected for userId:', userId);
        
        try {
            // 第一步：获取用户收藏的模板ID列表
            const starredUrl = `${this.apiUrl}/user/starred-templates?userId=${encodeURIComponent(userId)}`;
            console.log('获取收藏ID列表 API URL:', starredUrl);
            
            const starredResponse = await fetch(starredUrl);
            if (!starredResponse.ok) {
                const errorText = await starredResponse.text();
                console.error('获取收藏ID列表失败:', starredResponse.status, errorText);
                throw new Error(`获取收藏列表失败: ${starredResponse.status} - ${errorText}`);
            }
            
            const starredData = await starredResponse.json();
            console.log('收藏数据:', starredData);
            
            if (!starredData.success || !starredData.templateIds || starredData.templateIds.length === 0) {
                console.log('用户没有收藏任何模板');
                return { templates: [] };
            }

            // 第二步：尝试多种方式获取模板数据
            let templatesData = null;
            let lastError = null;

            // 方法1：使用主要的模板API
            try {
                const templatesUrl = `${this.apiUrl}/templates`;
                console.log('尝试方法1 - 获取所有模板 API URL:', templatesUrl);
                
                const templatesResponse = await fetch(templatesUrl);
                if (templatesResponse.ok) {
                    templatesData = await templatesResponse.json();
                    console.log('方法1成功，获取到模板数据:', templatesData);
                } else {
                    const errorText = await templatesResponse.text();
                    lastError = `方法1失败: ${templatesResponse.status} - ${errorText}`;
                    console.error(lastError);
                }
            } catch (error) {
                lastError = `方法1异常: ${error.message}`;
                console.error(lastError);
            }

            // 方法2：使用飞书多维表格API
            if (!templatesData) {
                try {
                    const feishuUrl = `${this.apiUrl}/feishu-bitable`;
                    console.log('尝试方法2 - 飞书多维表格 API URL:', feishuUrl);
                    
                    const feishuResponse = await fetch(feishuUrl);
                    if (feishuResponse.ok) {
                        const feishuData = await feishuResponse.json();
                        if (feishuData.success && feishuData.records) {
                            // 转换飞书数据格式
                            templatesData = {
                                records: feishuData.records.map(record => ({
                                    id: record.record_id,
                                    record_id: record.record_id,
                                    title: record.fields?.['name'] || record.fields?.['Name'] || '未命名模板',
                                    content: record.fields?.['Prompt'] || record.fields?.['prompt'] || '',
                                    author: record.fields?.['creator'] || '匿名',
                                    tags: this.parseFeishuTags(record.fields?.['tag'] || record.fields?.['tags']),
                                    type: record.fields?.['type'] || 'text',
                                    stars: Math.floor(Math.random() * 100),
                                    views: Math.floor(Math.random() * 1000),
                                    createdAt: record.fields?.['date'] || new Date().toLocaleDateString('zh-CN')
                                }))
                            };
                            console.log('方法2成功，转换后的模板数据:', templatesData);
                        } else {
                            lastError = `方法2失败: 飞书API返回格式错误 - ${JSON.stringify(feishuData)}`;
                            console.error(lastError);
                        }
                    } else {
                        const errorText = await feishuResponse.text();
                        lastError = `方法2失败: ${feishuResponse.status} - ${errorText}`;
                        console.error(lastError);
                    }
                } catch (error) {
                    lastError = `方法2异常: ${error.message}`;
                    console.error(lastError);
                }
            }

            // 方法3：如果以上都失败，使用缓存数据或创建模拟数据
            if (!templatesData) {
                console.warn('所有获取模板数据的方法都失败，使用备用方案');
                console.warn('最后的错误:', lastError);
                
                // 创建基于收藏ID的模拟数据
                const mockTemplates = starredData.templateIds.map((templateId, index) => ({
                    id: templateId,
                    record_id: templateId,
                    title: `收藏模板 ${index + 1}`,
                    content: '由于服务器配置问题，暂时无法获取完整模板内容。请稍后重试或访问网站查看。',
                    author: '未知作者',
                    tags: ['模板'],
                    type: 'text',
                    stars: Math.floor(Math.random() * 50),
                    views: Math.floor(Math.random() * 500),
                    createdAt: new Date().toLocaleDateString('zh-CN')
                }));

                templatesData = { records: mockTemplates };
                console.log('使用模拟数据:', templatesData);
            }

            // 第三步：从所有模板中筛选出用户收藏的模板
            const allTemplates = templatesData.records || templatesData.templates || [];
            const starredTemplateIds = new Set(starredData.templateIds);
            
            const userStarredTemplates = allTemplates.filter(template => {
                const templateId = template.id || template.record_id;
                return starredTemplateIds.has(templateId);
            }).map(template => {
                // 转换数据格式以匹配插件的期望格式
                const templateId = template.id || template.record_id;
                const starInfo = starredData.templates?.find(s => s.template_id === templateId);
                
                return {
                    id: templateId,
                    title: template.title || '未命名模板',
                    content: template.content || template.preview || '',
                    fullContent: template.content || '',
                    description: template.preview || (template.content || '').substring(0, 200) + '...',
                    author: template.author || '匿名',
                    likes: template.stars || 0,
                    views: template.views || 0,
                    comments: 0, // 模板没有评论功能
                    stars: template.stars || 0,
                    tags: Array.isArray(template.tags) ? template.tags : [],
                    source: 'import', // 模板都是导入的
                    type: template.type || 'text',
                    createdAt: template.createdAt || new Date().toLocaleDateString('zh-CN'),
                    starredAt: starInfo?.created_at || new Date().toISOString(),
                    url: template.url
                };
            });

            // 按收藏时间排序（最新收藏的在前）
            userStarredTemplates.sort((a, b) => {
                return new Date(b.starredAt).getTime() - new Date(a.starredAt).getTime();
            });

            console.log('用户收藏的模板:', userStarredTemplates);
            return { templates: userStarredTemplates };

        } catch (error) {
            console.error('获取收藏模板失败:', error);
            throw error;
        }
    }

    // 解析飞书标签字段
    parseFeishuTags(tagField) {
        if (!tagField) return [];
        
        if (Array.isArray(tagField)) {
            return tagField.map(tag => tag.text || tag.name || tag).filter(Boolean);
        }
        
        if (typeof tagField === 'string') {
            return tagField.split(',').map(tag => tag.trim()).filter(Boolean);
        }
        
        return [];
    }

    // 打开飞书调试信息
    openFeishuDebug() {
        const debugInfo = {
            apiUrl: this.apiUrl,
            currentUser: this.currentUser,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            availableAPIs: [
                `${this.apiUrl}/templates`,
                `${this.apiUrl}/feishu-bitable`,
                `${this.apiUrl}/user/starred-templates`
            ]
        };

        // 创建调试信息窗口
        const debugWindow = `
            <div class="debug-overlay" id="debugOverlay">
                <div class="debug-content">
                    <div class="debug-header">
                        <h3>🔍 飞书API调试信息</h3>
                        <button class="debug-close" onclick="document.getElementById('debugOverlay').remove()">×</button>
                    </div>
                    <div class="debug-body">
                        <div class="debug-section">
                            <h4>📋 基本信息</h4>
                            <pre class="debug-code">${JSON.stringify(debugInfo, null, 2)}</pre>
                        </div>
                        <div class="debug-section">
                            <h4>🔧 建议的解决方案</h4>
                            <ol class="debug-solutions">
                                <li><strong>检查服务器日志</strong>：查看 PrompterHub 服务器的控制台日志，寻找飞书API相关错误</li>
                                <li><strong>更新飞书令牌</strong>：飞书访问令牌可能已过期，需要重新获取</li>
                                <li><strong>验证配置</strong>：确认飞书应用ID、密钥和多维表格ID配置正确</li>
                                <li><strong>检查权限</strong>：确保飞书应用有访问目标多维表格的权限</li>
                                <li><strong>网络检查</strong>：确认服务器能访问飞书API (open.feishu.cn)</li>
                            </ol>
                        </div>
                        <div class="debug-section">
                            <h4>🚀 快速测试</h4>
                            <div class="debug-actions">
                                <button onclick="window.prompterhubSidepanel.testAPI('templates')" class="test-btn">
                                    测试模板API
                                </button>
                                <button onclick="window.prompterhubSidepanel.testAPI('feishu')" class="test-btn">
                                    测试飞书API
                                </button>
                                <button onclick="window.prompterhubSidepanel.testAPI('starred')" class="test-btn">
                                    测试收藏API
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // 添加到页面
        document.body.insertAdjacentHTML('beforeend', debugWindow);
    }

    // 测试API端点
    async testAPI(type) {
        const resultDiv = document.createElement('div');
        resultDiv.className = 'test-result';
        
        try {
            let url, response;
            
            switch (type) {
                case 'templates':
                    url = `${this.apiUrl}/templates`;
                    response = await fetch(url);
                    break;
                case 'feishu':
                    url = `${this.apiUrl}/feishu-bitable`;
                    response = await fetch(url);
                    break;
                case 'starred':
                    if (!this.currentUser?.id) {
                        throw new Error('需要登录用户');
                    }
                    url = `${this.apiUrl}/user/starred-templates?userId=${this.currentUser.id}`;
                    response = await fetch(url);
                    break;
                default:
                    throw new Error('未知的API类型');
            }

            const data = await response.json();
            
            resultDiv.innerHTML = `
                <h5>✅ ${type} API 测试结果</h5>
                <p><strong>状态:</strong> ${response.status} ${response.statusText}</p>
                <p><strong>URL:</strong> ${url}</p>
                <pre class="debug-code">${JSON.stringify(data, null, 2).substring(0, 500)}...</pre>
            `;
            
        } catch (error) {
            resultDiv.innerHTML = `
                <h5>❌ ${type} API 测试失败</h5>
                <p><strong>错误:</strong> ${error.message}</p>
                <p><strong>URL:</strong> ${url || '未知'}</p>
            `;
        }

        // 添加结果到调试窗口
        const debugBody = document.querySelector('.debug-body');
        if (debugBody) {
            debugBody.appendChild(resultDiv);
        }
    }

    // 分类配置 - 基于项目中的CategoryBadge组件
    getCategoryConfig() {
        return {
            '内容创作': { color: 'bg-blue-100 text-blue-800 border-blue-200', icon: '📝' },
            '设计创意': { color: 'bg-purple-100 text-purple-800 border-purple-200', icon: '🎨' },
            '开发': { color: 'bg-green-100 text-green-800 border-green-200', icon: '💻' },
            '教育': { color: 'bg-orange-100 text-orange-800 border-orange-200', icon: '🎓' },
            '办公': { color: 'bg-indigo-100 text-indigo-800 border-indigo-200', icon: '🏢' },
            '思维分析': { color: 'bg-pink-100 text-pink-800 border-pink-200', icon: '🧠' },
            '个人提升': { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: '👤' },
            '翻译': { color: 'bg-cyan-100 text-cyan-800 border-cyan-200', icon: '🌐' },
            '专业': { color: 'bg-red-100 text-red-800 border-red-200', icon: '🩺' },
            '娱乐': { color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: '🎮' },
            '其他': { color: 'bg-gray-100 text-gray-800 border-gray-200', icon: '🏷️' }
        };
    }

    // 创建分类标签
    createCategoryBadge(category) {
        const config = this.getCategoryConfig()[category] || this.getCategoryConfig()['其他'];
        return `
            <span class="category-badge ${config.color}" title="${category}">
                <span class="category-icon">${config.icon}</span>
                <span class="category-text">${category}</span>
            </span>
        `;
    }

    renderPromptCards(items, container, type = 'prompts') {
        console.log('Rendering prompt cards:', items.length);
        
        if (!items || items.length === 0) {
            const emptyMessage = this.currentTab === 'created' ? 
                '还没有创作内容' : 
                this.currentTab === 'liked' ? '还没有点赞任何内容' : '暂无内容';
            
            // 根据不同页面添加相应的顶部链接
            let topLinksHtml = '';
            if (this.currentTab === 'liked') {
                topLinksHtml = `
                    <div class="tab-top-link">
                        <a href="https://www.prompterhub.cn/community" target="_blank" class="community-link">
                            去社区浏览提示词
                        </a>
                    </div>
                `;
            } else if (this.currentTab === 'created') {
                const username = this.currentUser?.nickname || 'user';
                topLinksHtml = `
                    <div class="tab-top-link">
                        <a href="https://www.prompterhub.cn/dashboard" target="_blank" class="community-link">
                            创作提示词
                        </a>
                        <span class="link-separator">·</span>
                        <a href="https://www.prompterhub.cn/${encodeURIComponent(username)}/upload" target="_blank" class="community-link">
                            导入提示词
                        </a>
                    </div>
                `;
            }
            
            container.innerHTML = `
                ${topLinksHtml}
                <div class="empty-state">
                    <div class="empty-icon">${this.currentTab === 'created' ? '📝' : '❤️'}</div>
                    <p class="empty-title">${emptyMessage}</p>
                    <a href="${this.baseUrl}" target="_blank" class="visit-site-btn">
                        访问 PrompterHub.cn
                    </a>
                </div>
            `;
            return;
        }

        const cardsHtml = items.map(item => this.createPromptCardHtml(item)).join('');
        
        // 根据不同页面添加相应的顶部链接
        let topLinksHtml = '';
        if (this.currentTab === 'liked') {
            topLinksHtml = `
                <div class="tab-top-link">
                    <a href="https://www.prompterhub.cn/community" target="_blank" class="community-link">
                        去社区浏览提示词
                    </a>
                </div>
            `;
        } else if (this.currentTab === 'created') {
            const username = this.currentUser?.nickname || 'user';
            topLinksHtml = `
                <div class="tab-top-link">
                    <a href="https://www.prompterhub.cn/dashboard" target="_blank" class="community-link">
                        创作提示词
                    </a>
                    <span class="link-separator">·</span>
                    <a href="https://www.prompterhub.cn/${encodeURIComponent(username)}/upload" target="_blank" class="community-link">
                        导入提示词
                    </a>
                </div>
            `;
        }
        
        container.innerHTML = `${topLinksHtml}<div class="card-grid">${cardsHtml}</div>`;

        // Bind click events to cards
        container.querySelectorAll('.prompt-card').forEach(card => {
            card.addEventListener('click', () => {
                const itemData = JSON.parse(card.dataset.item);
                this.showPromptDetail(itemData);
            });

            // Bind copy button events
            const copyBtn = card.querySelector('.copy-btn');
            if (copyBtn) {
                copyBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const itemData = JSON.parse(card.dataset.item);
                    this.handleCardCopy(itemData, copyBtn);
                });
            }

            // Bind like button events
            const likeBtn = card.querySelector('.like-btn');
            if (likeBtn) {
                likeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const itemData = JSON.parse(card.dataset.item);
                    this.handleLike(itemData.id, card);
                });
            }
        });
    }

    renderTemplateCards(items, container) {
        console.log('Rendering template cards:', items.length);
        
        // 添加收藏页面顶部链接
        const topLinksHtml = `
            <div class="tab-top-link">
                <a href="https://www.prompterhub.cn/best-practices" target="_blank" class="community-link">
                    去模板库收藏提示词
                </a>
            </div>
        `;
        
        if (!items || items.length === 0) {
            container.innerHTML = `
                ${topLinksHtml}
                <div class="empty-state">
                    <div class="empty-icon">⭐</div>
                    <p class="empty-title">还没有收藏任何模板</p>
                    <a href="${this.baseUrl}/best-practices" target="_blank" class="visit-site-btn">
                        去模板库收藏
                    </a>
                </div>
            `;
            return;
        }

        // 收藏的模板使用增强的卡片样式，因为现在包含了完整的信息
        const cardsHtml = items.map(item => this.createCollectedTemplateCardHtml(item)).join('');
        container.innerHTML = `${topLinksHtml}<div class="card-grid">${cardsHtml}</div>`;

        // Bind click events to template cards
        container.querySelectorAll('.template-card, .prompt-card').forEach(card => {
            card.addEventListener('click', () => {
                const itemData = JSON.parse(card.dataset.item);
                this.showPromptDetail(itemData);
            });

            // 绑定复制按钮点击事件（如果存在）
            const copyBtn = card.querySelector('.copy-btn');
            if (copyBtn) {
                copyBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const itemData = JSON.parse(card.dataset.item);
                    this.handleCardCopy(itemData, copyBtn);
                });
            }

            // 绑定收藏按钮点击事件（如果存在）
            const starBtn = card.querySelector('.star-btn');
            if (starBtn) {
                starBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const itemData = JSON.parse(card.dataset.item);
                    this.handleTemplateUnstar(itemData.id, card);
                });
            }
        });
    }

    createPromptCardHtml(item) {
        const title = this.escapeHtml(item.title || '无标题');
        // 尝试多个可能的字段来获取提示词内容
        const promptContent = this.escapeHtml(
            item.content || 
            item.prompt || 
            item.fullContent || 
            item.description || 
            '暂无内容预览'
        ).substring(0, 150);
        const author = this.escapeHtml(item.author || '匿名');
        const likes = item.likes || 0;
        const views = item.views || 0;
        const comments = item.comments || 0;
        const source = item.source || 'ai';
        const tags = item.tags || [];

        console.log('创建提示词卡片:', {
            title: title,
            promptContent: promptContent,
            originalItem: item
        });

        // 创建标签HTML
        const tagsHtml = tags.slice(0, 2).map(tag => {
            const categories = Object.keys(this.getCategoryConfig());
            if (categories.includes(tag) || tag === '其他') {
                return this.createCategoryBadge(tag);
            } else {
                return `<span class="tag-badge">${tag}</span>`;
            }
        }).join('');

        const moreTagsHtml = tags.length > 2 ? `<span class="tag-badge more-tags">+${tags.length - 2}</span>` : '';

        // 源标记
        const sourceBadge = source === 'import' ? 
            '<span class="source-badge import">导入</span>' :
            '<span class="source-badge ai">AI</span>';

        return `
            <div class="prompt-card" data-item='${JSON.stringify(item)}'>
                <div class="card-header">
                    <div class="card-title-row">
                        <h3 class="card-title" title="${title}">${title}</h3>
                    </div>
                    ${tagsHtml || moreTagsHtml ? `
                        <div class="card-tags">
                            ${tagsHtml}
                            ${moreTagsHtml}
                        </div>
                    ` : ''}
                </div>
                <div class="card-content">
                    <p class="card-description" title="${promptContent}">${promptContent}${promptContent.length >= 150 ? '...' : ''}</p>
                </div>
                <div class="card-footer">
                    <div class="card-meta-row">
                        <span class="card-author">${author} · ${item.createdAt || new Date().toLocaleDateString('zh-CN')}</span>
                        <div class="card-stats">
                            <button class="stat-btn copy-btn" title="复制提示词">
                                <span class="stat-text">复制</span>
                            </button>
                            <button class="stat-btn like-btn ${this.currentTab === 'liked' ? 'active' : ''}" title="点赞">
                                <span class="stat-icon">${this.currentTab === 'liked' ? '❤️' : '🤍'}</span>
                                <span class="stat-count">${likes}</span>
                            </button>
                            <div class="stat-item" title="查看">
                                <span class="stat-icon">👁️</span>
                                <span class="stat-count">${views}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    createTemplateCardHtml(item) {
        const title = this.escapeHtml(item.title || '无标题');
        const content = this.escapeHtml(item.content || item.preview || '').substring(0, 100);
        const author = this.escapeHtml(item.author || '匿名');
        const stars = item.stars || 0;
        const views = item.views || 0;
        const tags = item.tags || [];

        // 创建标签HTML
        const tagsHtml = tags.slice(0, 2).map(tag => {
            const categories = Object.keys(this.getCategoryConfig());
            if (categories.includes(tag) || tag === '其他') {
                return this.createCategoryBadge(tag);
            } else {
                return `<span class="tag-badge">${tag}</span>`;
            }
        }).join('');

        const moreTagsHtml = tags.length > 2 ? `<span class="tag-badge more-tags">+${tags.length - 2}</span>` : '';

        return `
            <div class="template-card" data-item='${JSON.stringify(item)}'>
                <div class="card-header">
                    <div class="card-title-row">
                        <h3 class="card-title" title="${title}">${title}</h3>
                        <div class="card-badges">
                            <span class="star-badge">
                                <span class="star-icon">⭐</span>
                                <span class="star-count">${stars}</span>
                            </span>
                        </div>
                    </div>
                    ${tagsHtml || moreTagsHtml ? `
                        <div class="card-tags">
                            ${tagsHtml}
                            ${moreTagsHtml}
                        </div>
                    ` : ''}
                </div>
                <div class="card-content">
                    <p class="card-description">${content}${content.length >= 100 ? '...' : ''}</p>
                </div>
                <div class="card-footer">
                    <div class="card-meta">
                        <span class="card-author">${author} · ${item.createdAt || new Date().toLocaleDateString('zh-CN')}</span>
                    </div>
                    <div class="card-stats">
                        <div class="stat-item" title="查看">
                            <span class="stat-icon">👁️</span>
                            <span class="stat-count">${views}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    createCollectedTemplateCardHtml(item) {
        const title = this.escapeHtml(item.title || '无标题');
        const description = this.escapeHtml(item.description || item.content || '').substring(0, 100);
        const author = this.escapeHtml(item.author || '匿名');
        const stars = item.stars || 0;
        const views = item.views || 0;
        const tags = item.tags || [];
        const type = item.type || 'text';
        const starredAt = item.starredAt ? new Date(item.starredAt).toLocaleDateString('zh-CN') : '';

        // 创建标签HTML
        const tagsHtml = tags.slice(0, 2).map(tag => {
            const categories = Object.keys(this.getCategoryConfig());
            if (categories.includes(tag) || tag === '其他') {
                return this.createCategoryBadge(tag);
            } else {
                return `<span class="tag-badge">${tag}</span>`;
            }
        }).join('');

        const moreTagsHtml = tags.length > 2 ? `<span class="tag-badge more-tags">+${tags.length - 2}</span>` : '';

        // 类型图标
        const typeIcon = type === 'svg' ? '🎨' : 
                        type === 'html' ? '💻' : 
                        type === '图片' ? '🖼️' : '📝';

        return `
            <div class="prompt-card template-card" data-item='${JSON.stringify(item)}'>
                <div class="card-header">
                    <div class="card-title-row">
                        <h3 class="card-title" title="${title}">${title}</h3>
                    </div>
                    ${tagsHtml || moreTagsHtml || starredAt ? `
                        <div class="card-tags">
                            <div class="tags-left">
                                ${tagsHtml}
                                ${moreTagsHtml}
                            </div>
                            ${starredAt ? `
                                <div class="tags-right">
                                    <span class="collected-info">${typeIcon} 收藏于${starredAt}</span>
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}
                </div>
                <div class="card-content">
                    <p class="card-description">${description}${description.length >= 100 ? '...' : ''}</p>
                </div>
                <div class="card-footer">
                    <div class="card-meta-row">
                        <span class="card-author">${author}</span>
                        <div class="card-stats">
                            <button class="stat-btn copy-btn" title="复制模板内容">
                                <span class="stat-text">复制</span>
                            </button>
                            <button class="stat-btn star-btn active" title="取消收藏">
                                <span class="stat-icon">⭐</span>
                                <span class="stat-count">${stars}</span>
                            </button>
                            <div class="stat-item" title="查看">
                                <span class="stat-icon">👁️</span>
                                <span class="stat-count">${views}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async handleLike(promptId, cardElement) {
        if (!this.currentUser) {
            this.showToast('请先登录再点赞', 'warning');
            return;
        }

        try {
            // 乐观更新UI
            const likeBtn = cardElement.querySelector('.like-btn');
            const countEl = likeBtn.querySelector('.stat-count');
            const iconEl = likeBtn.querySelector('.stat-icon');
            
            const currentCount = parseInt(countEl.textContent);
            countEl.textContent = currentCount + 1;
            iconEl.textContent = '❤️';
            likeBtn.classList.add('active');

            // 发送点赞请求
            const response = await fetch(`${this.apiUrl}/prompts/${promptId}/like`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ userId: this.currentUser.id })
            });

            if (!response.ok) {
                throw new Error('点赞失败');
            }

            console.log('Like success for prompt:', promptId);
        } catch (error) {
            console.error('Like failed:', error);
            
            // 恢复UI状态
            const likeBtn = cardElement.querySelector('.like-btn');
            const countEl = likeBtn.querySelector('.stat-count');
            const iconEl = likeBtn.querySelector('.stat-icon');
            
            const currentCount = parseInt(countEl.textContent);
            countEl.textContent = currentCount - 1;
            iconEl.textContent = '🤍';
            likeBtn.classList.remove('active');
            
            this.showToast('点赞失败，请稍后重试', 'error');
        }
    }

    async handleCardCopy(item, buttonElement) {
        try {
            // 获取完整的提示词内容
            const fullContent = item.content || item.prompt || item.fullContent || item.description || '';
            
            if (!fullContent.trim()) {
                this.showToast('暂无可复制的内容', 'warning');
                return;
            }

            // 更新按钮状态
            const originalText = buttonElement.querySelector('.stat-text').textContent;
            
            buttonElement.querySelector('.stat-text').textContent = '⏳ 复制中';
            buttonElement.disabled = true;

            // 尝试使用现代 Clipboard API
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(fullContent);
            } else {
                // 降级到传统方法
                this.fallbackCopy(fullContent);
            }

            // 恢复按钮状态并显示成功提示
            buttonElement.querySelector('.stat-text').textContent = '✅ 已复制';
            
            this.showToast('提示词已复制到剪贴板', 'success', 2000);

            // 2秒后恢复原始状态
            setTimeout(() => {
                buttonElement.querySelector('.stat-text').textContent = originalText;
                buttonElement.disabled = false;
            }, 2000);

        } catch (error) {
            console.error('复制失败:', error);
            
            // 恢复按钮状态
            buttonElement.querySelector('.stat-text').textContent = '❌ 失败';
            buttonElement.disabled = false;
            
            this.showToast('复制失败，请稍后重试', 'error');
            
            // 2秒后恢复原始状态
            setTimeout(() => {
                buttonElement.querySelector('.stat-text').textContent = '复制';
            }, 2000);
        }
    }

    async handleTemplateUnstar(templateId, cardElement) {
        if (!this.currentUser) {
            this.showToast('请先登录再操作', 'warning');
            return;
        }

        try {
            // 乐观更新UI - 先隐藏卡片
            cardElement.style.opacity = '0.5';
            const starBtn = cardElement.querySelector('.star-btn');
            if (starBtn) {
                starBtn.disabled = true;
                starBtn.innerHTML = '<span class="stat-icon">⏳</span><span class="stat-count">...</span>';
            }

            // 发送取消收藏请求
            const response = await fetch(`${this.apiUrl}/templates/${templateId}/star`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ userId: this.currentUser.id })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`取消收藏失败: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            console.log('Unstar success for template:', templateId, result);

            // 成功取消收藏，从列表中移除该卡片
            cardElement.style.transition = 'all 0.3s ease';
            cardElement.style.transform = 'scale(0.8)';
            cardElement.style.opacity = '0';
            
            setTimeout(() => {
                cardElement.remove();
                
                // 检查是否还有其他卡片，如果没有显示空状态
                const container = document.getElementById('tabContent');
                const remainingCards = container.querySelectorAll('.prompt-card, .template-card');
                
                if (remainingCards.length === 0) {
                    container.innerHTML = `
                        <div class="empty-state">
                            <div class="empty-icon">⭐</div>
                            <p class="empty-title">还没有收藏任何模板</p>
                            <a href="${this.baseUrl}/best-practices" target="_blank" class="visit-site-btn">
                                去模板库收藏
                            </a>
                        </div>
                    `;
                }
            }, 300);

            this.showToast('取消收藏成功', 'success');

        } catch (error) {
            console.error('Unstar failed:', error);
            
            // 恢复UI状态
            cardElement.style.opacity = '1';
            const starBtn = cardElement.querySelector('.star-btn');
            if (starBtn) {
                starBtn.disabled = false;
                const itemData = JSON.parse(cardElement.dataset.item);
                const stars = itemData.stars || 0;
                starBtn.innerHTML = `<span class="stat-icon">⭐</span><span class="stat-count">${stars}</span>`;
            }
            
            this.showToast('取消收藏失败，请稍后重试', 'error');
        }
    }

    async openPromptDetail(item) {
        try {
            const url = `${this.baseUrl}/p/${item.id}`;
            console.log('Opening prompt detail:', url);
            await chrome.tabs.create({ url });
        } catch (error) {
            console.error('Failed to open prompt detail:', error);
        }
    }

    async openTemplateDetail(item) {
        try {
            const url = `${this.baseUrl}/template/${item.id}`;
            console.log('Opening template detail:', url);
            await chrome.tabs.create({ url });
        } catch (error) {
            console.error('Failed to open template detail:', error);
        }
    }

    // 显示提示词详情
    showPromptDetail(item) {
        console.log('Showing prompt detail:', item);
        this.currentDetailItem = item;
        this.isDetailView = true;

        // 填充详情内容
        this.populateDetailView(item);

        // 显示详情视图
        const tabContent = document.querySelector('.tab-content');
        const detailView = document.getElementById('detailView');
        
        if (tabContent) tabContent.style.display = 'none';
        if (detailView) detailView.style.display = 'flex';
    }

    // 隐藏详情视图，返回列表
    hideDetailView() {
        console.log('Hiding detail view');
        this.isDetailView = false;
        this.currentDetailItem = null;

        // 隐藏详情视图，显示列表
        const tabContent = document.querySelector('.tab-content');
        const detailView = document.getElementById('detailView');
        
        if (detailView) detailView.style.display = 'none';
        if (tabContent) tabContent.style.display = 'block';
    }

    // 填充详情视图内容
    populateDetailView(item) {
        const title = item.title || '无标题';
        const description = item.description || '';
        const fullContent = item.fullContent || item.preview || description;
        const originalText = item.originalText || '';
        const author = item.author || '匿名';
        const createdAt = item.createdAt || new Date().toLocaleDateString('zh-CN');
        const tags = item.tags || [];
        const source = item.source || 'ai';

        // 设置标题
        const detailTitle = document.getElementById('detailTitle');
        if (detailTitle) detailTitle.textContent = title;

        // 设置作者和日期（合并显示）
        const detailAuthorDate = document.getElementById('detailAuthorDate');
        if (detailAuthorDate) {
            detailAuthorDate.textContent = `${author} · ${createdAt}`;
        }

        // 设置统计信息
        const detailStats = document.getElementById('detailStats');
        if (detailStats) {
            const likes = item.likes || 0;
            const views = item.views || 0;
            const comments = item.comments || 0;

            detailStats.innerHTML = `
                <div class="detail-stat">
                    <span class="stat-icon">❤️</span>
                    <span class="stat-count">${likes}</span>
                    <span>点赞</span>
                </div>
                <div class="detail-stat">
                    <span class="stat-icon">👁️</span>
                    <span class="stat-count">${views}</span>
                    <span>查看</span>
                </div>
                ${this.currentTab === 'created' ? `
                    <div class="detail-stat">
                        <span class="stat-icon">💬</span>
                        <span class="stat-count">${comments}</span>
                        <span>评论</span>
                    </div>
                ` : ''}
            `;
        }

        // 设置所有标签（源标记 + 分类标签）
        const detailAllTags = document.getElementById('detailAllTags');
        if (detailAllTags) {
            // 源标记（在我的收藏页面不显示导入标签）
            let sourceBadge = '';
            if (this.currentTab !== 'collected') {
                sourceBadge = source === 'import' ? 
                    '<span class="source-badge import">导入</span>' :
                    '<span class="source-badge ai">AI</span>';
            } else if (source === 'ai') {
                // 我的收藏页面只显示AI标签，不显示导入标签
                sourceBadge = '<span class="source-badge ai">AI</span>';
            }
            
            // 分类标签
            let tagsHtml = '';
            if (tags.length > 0) {
                tagsHtml = tags.map(tag => {
                    const categories = Object.keys(this.getCategoryConfig());
                    if (categories.includes(tag) || tag === '其他') {
                        return this.createCategoryBadge(tag);
                    } else {
                        return `<span class="tag-badge">${tag}</span>`;
                    }
                }).join('');
            }
            
            // 合并所有标签
            detailAllTags.innerHTML = sourceBadge + tagsHtml;
        }

        // 设置完整提示词内容
        const promptContent = document.getElementById('promptContent');
        if (promptContent) {
            promptContent.textContent = fullContent || '暂无完整内容';
        }
    }

    // 复制提示词内容
    async copyPromptContent() {
        if (!this.currentDetailItem) return;

        const content = this.currentDetailItem.fullContent || 
                       this.currentDetailItem.preview || 
                       this.currentDetailItem.description || '';

        try {
            await navigator.clipboard.writeText(content);
            this.showCopySuccess('内容已复制到剪贴板');
        } catch (error) {
            console.error('Copy failed:', error);
            // 降级方案
            this.fallbackCopy(content);
        }
    }

    // 复制完整提示词
    async copyFullPrompt() {
        if (!this.currentDetailItem) return;

        const item = this.currentDetailItem;
        const fullText = `标题：${item.title || '无标题'}

作者：${item.author || '匿名'}
创建时间：${item.createdAt || '未知'}

${item.description ? `描述：\n${item.description}\n\n` : ''}完整提示词：
${item.fullContent || item.preview || '暂无内容'}

${item.originalText && item.originalText !== (item.fullContent || item.preview) ? `\n原始文本：\n${item.originalText}` : ''}

标签：${(item.tags || []).join(', ')}
来源：PrompterHub.cn`;

        try {
            await navigator.clipboard.writeText(fullText);
            this.showCopySuccess('完整内容已复制到剪贴板');
        } catch (error) {
            console.error('Copy failed:', error);
            this.fallbackCopy(fullText);
        }
    }

    // 分享提示词
    async sharePrompt() {
        if (!this.currentDetailItem) return;

        const item = this.currentDetailItem;
        let shareUrl;
        
        // 根据当前页面类型生成不同格式的分享链接
        if (this.currentTab === 'collected') {
            // 收藏页面：生成模板库链接格式，并添加@前缀
            const templateId = item.id || item.record_id;
            shareUrl = `@${this.baseUrl}/best-practices?template=${templateId}`;
        } else {
            // 其他页面：生成普通提示词链接
            shareUrl = `${this.baseUrl}/p/${item.id}`;
        }
        
        // 在Chrome Extension环境中直接复制链接，确保用户始终有反馈
        this.copyShareUrl(shareUrl);
    }

    // 复制分享链接
    async copyShareUrl(url) {
        try {
            await navigator.clipboard.writeText(url);
            this.showCopySuccess('分享链接已复制到剪贴板');
        } catch (error) {
            console.error('Copy share URL failed:', error);
            this.fallbackCopy(url);
        }
    }

    // 点赞当前提示词
    async likeCurrentPrompt() {
        if (!this.currentDetailItem || !this.currentUser) {
            this.showToast('请先登录再点赞', 'warning');
            return;
        }

        const item = this.currentDetailItem;
        const isCurrentlyLiked = this.currentTab === 'liked';
        
        if (isCurrentlyLiked) {
            this.showToast('您已经点赞过这个提示词了', 'info');
            return;
        }

        try {
            // 乐观更新UI
            const likeDetailBtn = document.getElementById('likeDetailBtn');
            if (likeDetailBtn) {
                likeDetailBtn.classList.add('active');
                const likeIcon = likeDetailBtn.querySelector('.action-icon');
                const likeText = likeDetailBtn.querySelector('.action-text');
                if (likeIcon) likeIcon.textContent = '❤️';
                if (likeText) likeText.textContent = '已点赞';
            }

            // 更新统计数字
            const detailStats = document.getElementById('detailStats');
            if (detailStats) {
                const likeStatCount = detailStats.querySelector('.detail-stat .stat-count');
                if (likeStatCount) {
                    const currentCount = parseInt(likeStatCount.textContent) || 0;
                    likeStatCount.textContent = currentCount + 1;
                    // 同时更新当前项目的数据
                    this.currentDetailItem.likes = currentCount + 1;
                }
            }

            // 发送点赞请求
            const response = await fetch(`${this.apiUrl}/prompts/${item.id}/like`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ userId: this.currentUser.id })
            });

            if (!response.ok) {
                throw new Error('点赞失败');
            }

            console.log('Like success for prompt:', item.id);
            this.showToast('点赞成功！', 'success');

        } catch (error) {
            console.error('Like failed:', error);
            
            // 恢复UI状态
            const likeDetailBtn = document.getElementById('likeDetailBtn');
            if (likeDetailBtn) {
                likeDetailBtn.classList.remove('active');
                const likeIcon = likeDetailBtn.querySelector('.action-icon');
                const likeText = likeDetailBtn.querySelector('.action-text');
                if (likeIcon) likeIcon.textContent = '🤍';
                if (likeText) likeText.textContent = '点赞';
            }

            // 恢复统计数字
            const detailStats = document.getElementById('detailStats');
            if (detailStats) {
                const likeStatCount = detailStats.querySelector('.detail-stat .stat-count');
                if (likeStatCount) {
                    const currentCount = parseInt(likeStatCount.textContent) || 0;
                    const newCount = Math.max(0, currentCount - 1);
                    likeStatCount.textContent = newCount;
                    this.currentDetailItem.likes = newCount;
                }
            }
            
            this.showToast('点赞失败，请稍后重试', 'error');
        }
    }

    // 访问提示词页面
    async visitPromptPage() {
        if (!this.currentDetailItem) return;

        try {
            const url = `${this.baseUrl}/p/${this.currentDetailItem.id}`;
            console.log('Opening prompt page:', url);
            await chrome.tabs.create({ url });
        } catch (error) {
            console.error('Failed to open prompt page:', error);
        }
    }

    // 显示复制成功提示
    showCopySuccess(message) {
        this.showToast(message, 'success', 2000);
    }

    // 降级复制方案
    fallbackCopy(text) {
        try {
            // 创建临时文本域
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            
            this.showCopySuccess('内容已复制到剪贴板');
        } catch (error) {
            console.error('Fallback copy failed:', error);
            this.showToast('复制失败，请手动选择内容', 'error');
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing PrompterHub Sidepanel with enhanced card rendering and improved auth');
    window.prompterhubSidepanel = new PrompterHubSidepanel();
});
