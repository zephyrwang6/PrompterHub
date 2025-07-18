﻿// PrompterHub Assistant - Sidepanel JavaScript

// 缓存管理器类
class CacheManager {
    constructor() {
        this.memoryCache = new Map();
        this.cachePrefix = 'prompterhub_cache_';
        this.defaultTTL = 5 * 60 * 1000; // 5分钟默认过期时间
    }

    // 生成缓存键
    generateKey(category, identifier) {
        return `${this.cachePrefix}${category}_${identifier}`;
    }

    // 获取缓存数据
    async get(key, useMemoryCache = true) {
        try {
            // 1. 先检查内存缓存
            if (useMemoryCache && this.memoryCache.has(key)) {
                const cached = this.memoryCache.get(key);
                if (this.isValid(cached)) {
                    console.log(`✅ 内存缓存命中: ${key}`);
                    return cached.data;
                } else {
                    this.memoryCache.delete(key);
                }
            }

            // 2. 检查Chrome存储缓存
            const result = await chrome.storage.local.get([key]);
            if (result[key] && this.isValid(result[key])) {
                console.log(`✅ 存储缓存命中: ${key}`);
                // 同时更新内存缓存
                if (useMemoryCache) {
                    this.memoryCache.set(key, result[key]);
                }
                return result[key].data;
            }

            console.log(`❌ 缓存未命中: ${key}`);
            return null;
        } catch (error) {
            console.error('缓存读取失败:', error);
            return null;
        }
    }

    // 设置缓存数据
    async set(key, data, ttl = this.defaultTTL) {
        try {
            const cacheItem = {
                data: data,
                timestamp: Date.now(),
                ttl: ttl
            };

            // 1. 设置内存缓存
            this.memoryCache.set(key, cacheItem);

            // 2. 设置Chrome存储缓存
            await chrome.storage.local.set({
                [key]: cacheItem
            });

            console.log(`💾 缓存已设置: ${key} (TTL: ${ttl}ms)`);
        } catch (error) {
            console.error('缓存设置失败:', error);
        }
    }

    // 检查缓存是否有效
    isValid(cacheItem) {
        if (!cacheItem || !cacheItem.timestamp) {
            return false;
        }
        const age = Date.now() - cacheItem.timestamp;
        return age < cacheItem.ttl;
    }

    // 清除指定缓存
    async clear(key) {
        try {
            this.memoryCache.delete(key);
            await chrome.storage.local.remove([key]);
            console.log(`🗑️ 缓存已清除: ${key}`);
        } catch (error) {
            console.error('缓存清除失败:', error);
        }
    }

    // 清除所有缓存
    async clearAll() {
        try {
            this.memoryCache.clear();
            const allKeys = await chrome.storage.local.get(null);
            const cacheKeys = Object.keys(allKeys).filter(key => key.startsWith(this.cachePrefix));
            await chrome.storage.local.remove(cacheKeys);
            console.log(`🗑️ 已清除所有缓存 (${cacheKeys.length}个)`);
        } catch (error) {
            console.error('清除所有缓存失败:', error);
        }
    }

    // 获取缓存统计信息
    getStats() {
        return {
            memorySize: this.memoryCache.size,
            memorySizeBytes: JSON.stringify([...this.memoryCache]).length,
        };
    }
}

// 性能监控器类
class PerformanceMonitor {
    constructor() {
        this.metrics = {};
    }

    // 开始性能测量
    start(label) {
        this.metrics[label] = {
            startTime: Date.now(),
            startMemory: performance.memory ? performance.memory.usedJSHeapSize : 0
        };
    }

    // 结束性能测量
    end(label) {
        if (!this.metrics[label]) {
            console.warn(`性能监控: 未找到标签 ${label}`);
            return;
        }

        const metric = this.metrics[label];
        const duration = Date.now() - metric.startTime;
        const memoryUsed = performance.memory ? 
            performance.memory.usedJSHeapSize - metric.startMemory : 0;

        const result = {
            duration: duration,
            memoryUsed: memoryUsed,
            timestamp: new Date().toISOString()
        };

        console.log(`⚡ 性能指标 [${label}]: ${duration}ms, 内存: ${(memoryUsed / 1024 / 1024).toFixed(2)}MB`);
        
        delete this.metrics[label];
        return result;
    }

    // 记录简单指标
    record(label, value) {
        console.log(`📊 指标 [${label}]: ${value}`);
    }
}

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
        
        // 缓存系统初始化
        this.cacheManager = new CacheManager();
        this.performanceMonitor = new PerformanceMonitor();
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.checkAuthStatus();
        
        // 定期检查认证状态（防止某些情况下未收到消息）
        setInterval(() => {
            this.checkAuthStatus();
        }, 30000); // 每30秒检查一次
        
        // 初始化性能监控
        this.initPerformanceMonitoring();
    }

    // 初始化性能监控
    initPerformanceMonitoring() {
        // 监控页面性能
        window.addEventListener('load', () => {
            this.performanceMonitor.record('pageLoadTime', Date.now());
        });
        
        // 监控内存使用情况
        setInterval(() => {
            if (performance.memory) {
                this.performanceMonitor.record('memoryUsage', {
                    used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                    total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
                    limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
                });
            }
        }, 30000); // 每30秒记录一次内存使用情况
        
        // 监控缓存效率
        setInterval(() => {
            const cacheStats = this.cacheManager.getStats();
            this.performanceMonitor.record('cacheStats', cacheStats);
        }, 60000); // 每分钟记录一次缓存统计
    }

    // 获取性能报告
    getPerformanceReport() {
        const report = {
            timestamp: new Date().toISOString(),
            cacheStats: this.cacheManager.getStats(),
            memoryUsage: performance.memory ? {
                used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
                limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
            } : null,
            userInfo: {
                isLoggedIn: !!this.currentUser,
                currentTab: this.currentTab,
                isDetailView: this.isDetailView
            }
        };
        
        console.log('📊 性能报告:', report);
        return report;
    }

    // 清理缓存的便捷方法
    async clearCache() {
        await this.cacheManager.clearAll();
        this.showToast('缓存已清理', 'success');
    }

    // 初始化置顶按钮
    initScrollToTopButton() {
        const scrollToTopBtn = document.getElementById('scrollToTop');
        if (!scrollToTopBtn) return;

        // 监听 tab-content 的滚动事件
        const tabContent = document.querySelector('.tab-content');
        if (tabContent) {
            tabContent.addEventListener('scroll', () => {
                this.handleScroll(scrollToTopBtn, tabContent);
            });
        }

        // 监听详情页面的滚动事件
        const detailContent = document.querySelector('.detail-content');
        if (detailContent) {
            detailContent.addEventListener('scroll', () => {
                this.handleScroll(scrollToTopBtn, detailContent);
            });
        }
    }

    // 处理滚动事件
    handleScroll(button, scrollContainer) {
        // 只在用户已登录且不在详情视图时显示按钮
        if (!this.currentUser || this.isDetailView) {
            button.classList.remove('show');
            return;
        }

        const scrollTop = scrollContainer.scrollTop;
        const threshold = 100; // 滚动超过100px时显示按钮

        if (scrollTop > threshold) {
            button.classList.add('show');
        } else {
            button.classList.remove('show');
        }
    }

    // 滚动到顶部
    scrollToTop() {
        const activeScrollContainer = this.isDetailView ? 
            document.querySelector('.detail-content') : 
            document.querySelector('.tab-content');
            
        if (activeScrollContainer) {
            activeScrollContainer.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        }
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

        // 置顶按钮事件
        const scrollToTopBtn = document.getElementById('scrollToTop');
        if (scrollToTopBtn) {
            scrollToTopBtn.addEventListener('click', () => {
                this.scrollToTop();
            });
        }

        // 监听页面滚动，控制置顶按钮显示
        this.initScrollToTopButton();

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
        
        // 显示品牌标题（移除logged-in类）
        document.body.classList.remove('logged-in');
        
        // 显示状态信息
        this.showToast('请先登录 PrompterHub.cn', 'info');
    }

    showUserPanel() {
        console.log('Showing user panel for:', this.currentUser);
        const loginPanel = document.getElementById('loginPanel');
        const userPanel = document.getElementById('userPanel');
        
        if (loginPanel) loginPanel.style.display = 'none';
        if (userPanel) userPanel.style.display = 'block';

        // 隐藏品牌标题（添加logged-in类）
        document.body.classList.add('logged-in');

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
        
        console.log('🔄 加载用户数据 (优化版本):', tabType);
        this.performanceMonitor.start('loadUserData');
        
        try {
            if (!this.currentUser) {
                throw new Error('未找到用户信息，请先登录');
            }

            // 1. 显示渐进式加载状态
            this.showProgressiveLoading(tabContent, tabType);

            let data;
            const userId = this.currentUser.id;
            const userNickname = this.currentUser.nickname || this.currentUser.email?.split('@')[0];
            
            console.log('📊 API调用参数:', { userId, userNickname, tabType });

            // 2. 根据标签类型执行相应的数据加载
            switch (tabType) {
                case 'created':
                    if (!userNickname) {
                        throw new Error('无法获取用户名信息');
                    }
                    this.updateLoadingProgress('正在获取创作内容...');
                    data = await this.fetchUserCreated(userNickname);
                    console.log('✅ 创作数据获取完成:', data?.prompts?.length || 0, '条');
                    this.renderPromptCards(data.prompts || [], tabContent, 'prompts');
                    break;

                case 'liked':
                    if (!userNickname) {
                        throw new Error('无法获取用户名信息');
                    }
                    this.updateLoadingProgress('正在获取点赞内容...');
                    data = await this.fetchUserLikedOptimized(userNickname, userId);
                    console.log('✅ 点赞数据获取完成:', data?.prompts?.length || 0, '条');
                    this.renderPromptCards(data.prompts || [], tabContent, 'prompts');
                    break;

                case 'collected':
                    this.updateLoadingProgress('正在获取收藏内容...');
                    data = await this.fetchUserCollected(userId);
                    console.log('✅ 收藏数据获取完成:', data?.templates?.length || 0, '条');
                    this.renderTemplateCards(data.templates || [], tabContent);
                    break;

                default:
                    throw new Error('未知的标签页类型');
            }

            // 3. 隐藏加载状态
            this.hideLoadingProgress();
            
            const duration = this.performanceMonitor.end('loadUserData');
            this.performanceMonitor.record('dataLoadSuccess', true);
            
            console.log(`✅ 数据加载完成: ${tabType}, 耗时: ${duration?.duration || 0}ms`);
            
        } catch (error) {
            console.error('❌ 数据加载失败:', error);
            this.performanceMonitor.end('loadUserData');
            this.performanceMonitor.record('dataLoadSuccess', false);
            
            // 隐藏加载状态
            this.hideLoadingProgress();
            
            // 处理特定错误类型
            if (error.message.includes('401') || 
                error.message.includes('未授权') || 
                error.message.includes('Unauthorized') ||
                error.message.includes('获取用户提示词失败') ||
                error.message.includes('获取用户点赞提示词失败')) {
                console.log('🔑 认证错误，用户可能已登出');
                this.handleLogout();
                return;
            }
            
            // 显示错误界面
            this.showErrorState(tabContent, error, tabType);
        }
    }

    // 显示渐进式加载状态
    showProgressiveLoading(container, tabType) {
        const loadingHtml = `
            <div class="simple-loading" id="progressiveLoading">
                <div class="loading-content">
                    <div class="loading-spinner">
                        <div class="spinner"></div>
                    </div>
                    <div class="loading-text">正在加载中...</div>
                </div>
            </div>
        `;
        
        container.innerHTML = loadingHtml;
    }

    // 更新加载进度
    updateLoadingProgress(message) {
        // 简化版本不需要更新进度信息
        console.log('加载进度:', message);
    }

    // 更新加载步骤状态
    updateLoadingStep(stepNumber, status) {
        // 简化版本不需要步骤状态
        console.log('加载步骤:', stepNumber, status);
    }

    // 隐藏加载进度
    hideLoadingProgress() {
        const loadingElement = document.getElementById('progressiveLoading');
        if (loadingElement) {
            // 直接淡出移除
            loadingElement.style.opacity = '0';
            setTimeout(() => {
                if (loadingElement.parentNode) {
                    loadingElement.remove();
                }
            }, 300);
        }
    }

    // 获取标签页显示名称
    getTabDisplayName(tabType) {
        const displayNames = {
            'created': '创作内容',
            'liked': '点赞内容', 
            'collected': '收藏内容'
        };
        return displayNames[tabType] || '内容';
    }

    // 显示错误状态
    showErrorState(container, error, tabType) {
        // 特殊处理收藏功能的错误
        if (tabType === 'collected' && error.message.includes('获取模板数据失败')) {
            container.innerHTML = `
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
            container.innerHTML = `
                <div class="error">
                    <div class="error-icon">❌</div>
                    <h3 class="error-title">加载失败</h3>
                    <p class="error-description">${error.message}</p>
                    <p class="error-details">用户: ${this.currentUser?.nickname || 'Unknown'}</p>
                    <p class="error-details">类型: ${tabType}</p>
                    <div class="error-actions">
                        <button onclick="window.prompterhubSidepanel.loadUserData('${tabType}')" class="retry-btn primary">
                            🔄 重试
                        </button>
                        <button onclick="window.prompterhubSidepanel.checkAuthStatus(true)" class="retry-btn secondary">
                            🔑 检查登录状态
                        </button>
                    </div>
                </div>
            `;
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

    // 优化版本的创作内容获取
    async fetchUserCreated(username) {
        const startTime = Date.now();
        this.performanceMonitor.start('fetchUserCreated');
        
        console.log('🚀 开始获取用户创作数据 (优化版本)');
        
        try {
            // 1. 检查缓存
            const cacheKey = this.cacheManager.generateKey('created', username);
            const cachedData = await this.cacheManager.get(cacheKey);
            if (cachedData) {
                this.performanceMonitor.record('cacheHit', true);
                console.log('✅ 使用缓存数据，耗时:', Date.now() - startTime, 'ms');
                return cachedData;
            }

            // 2. 发起API请求
            const url = `${this.apiUrl}/users/${encodeURIComponent(username)}/prompts?page=1&limit=20`;
            console.log('📡 获取创作内容:', url);
            
            const response = await fetch(url);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`获取创作内容失败: ${response.status} - ${errorText}`);
            }
            
            const result = await response.json();
            
            // 3. 缓存结果
            await this.cacheManager.set(cacheKey, result, 5 * 60 * 1000); // 5分钟缓存

            const totalTime = Date.now() - startTime;
            this.performanceMonitor.end('fetchUserCreated');
            this.performanceMonitor.record('promptsCount', result?.prompts?.length || 0);
            
            console.log(`✅ 创作数据获取完成: ${result?.prompts?.length || 0}个内容, 耗时: ${totalTime}ms`);
            return result;

        } catch (error) {
            this.performanceMonitor.end('fetchUserCreated');
            console.error('❌ 获取创作内容失败:', error);
            throw error;
        }
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

    // 优化版本的点赞内容获取
    async fetchUserLikedOptimized(username, userId) {
        const startTime = Date.now();
        this.performanceMonitor.start('fetchUserLiked');
        
        console.log('🚀 开始获取用户点赞数据 (优化版本)');
        
        try {
            // 1. 检查缓存
            const cacheKey = this.cacheManager.generateKey('liked', `${username}_${userId}`);
            const cachedData = await this.cacheManager.get(cacheKey);
            if (cachedData) {
                this.performanceMonitor.record('cacheHit', true);
                console.log('✅ 使用缓存数据，耗时:', Date.now() - startTime, 'ms');
                return cachedData;
            }

            // 2. 发起API请求
            const url = `${this.apiUrl}/users/${encodeURIComponent(username)}/liked?page=1&limit=20&userId=${encodeURIComponent(userId)}`;
            console.log('📡 获取点赞内容:', url);
            
            const response = await fetch(url);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`获取点赞内容失败: ${response.status} - ${errorText}`);
            }
            
            const result = await response.json();
            
            // 3. 缓存结果
            await this.cacheManager.set(cacheKey, result, 5 * 60 * 1000); // 5分钟缓存

            const totalTime = Date.now() - startTime;
            this.performanceMonitor.end('fetchUserLiked');
            this.performanceMonitor.record('likedCount', result?.prompts?.length || 0);
            
            console.log(`✅ 点赞数据获取完成: ${result?.prompts?.length || 0}个内容, 耗时: ${totalTime}ms`);
            return result;

        } catch (error) {
            this.performanceMonitor.end('fetchUserLiked');
            console.error('❌ 获取点赞内容失败:', error);
            throw error;
        }
    }

    async fetchUserCollected(userId) {
        const startTime = Date.now();
        this.performanceMonitor.start('fetchUserCollected');
        
        console.log('🚀 开始获取用户收藏数据 (优化版本)');
        
        try {
            // 1. 检查缓存
            const cacheKey = this.cacheManager.generateKey('collected', userId);
            const cachedData = await this.cacheManager.get(cacheKey);
            if (cachedData) {
                this.performanceMonitor.record('cacheHit', true);
                console.log('✅ 使用缓存数据，耗时:', Date.now() - startTime, 'ms');
                return cachedData;
            }

            // 2. 并行获取数据
            const collectionsPromise = this.fetchUserStarredIds(userId);
            const templatesPromise = this.fetchAllTemplatesParallel();
            
            console.log('📡 并行请求: 收藏ID列表 & 模板数据');
            
            // 等待两个关键数据
            const [starredData, templatesData] = await Promise.all([
                collectionsPromise,
                templatesPromise
            ]);

            // 3. 数据校验
            if (!starredData.success || !starredData.templateIds?.length) {
                console.log('📋 用户没有收藏任何模板');
                const emptyResult = { templates: [] };
                await this.cacheManager.set(cacheKey, emptyResult, 60000); // 1分钟缓存
                return emptyResult;
            }

            // 4. 高效数据处理
            const userStarredTemplates = this.processCollectedTemplates(
                starredData, 
                templatesData
            );

            // 5. 缓存结果
            const result = { templates: userStarredTemplates };
            await this.cacheManager.set(cacheKey, result, 10 * 60 * 1000); // 10分钟缓存

            const totalTime = Date.now() - startTime;
            this.performanceMonitor.end('fetchUserCollected');
            this.performanceMonitor.record('templatesCount', userStarredTemplates.length);
            
            console.log(`✅ 收藏数据获取完成: ${userStarredTemplates.length}个模板, 耗时: ${totalTime}ms`);
            return result;

        } catch (error) {
            this.performanceMonitor.end('fetchUserCollected');
            console.error('❌ 获取收藏模板失败:', error);
            throw error;
        }
    }

    // 获取用户收藏ID列表
    async fetchUserStarredIds(userId) {
        const url = `${this.apiUrl}/user/starred-templates?userId=${encodeURIComponent(userId)}`;
        console.log('📡 获取收藏ID列表:', url);
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`获取收藏列表失败: ${response.status}`);
        }
        
        return await response.json();
    }

    // 并行获取模板数据
    async fetchAllTemplatesParallel() {
        console.log('📡 并行获取模板数据...');
        
        // 创建并行请求
        const requests = [
            this.fetchTemplatesAPI1(), // 主要API
            this.fetchTemplatesAPI2()  // 飞书API
        ];

        // 使用Promise.allSettled等待所有请求完成
        const results = await Promise.allSettled(requests);
        
        // 选择第一个成功的结果
        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            if (result.status === 'fulfilled' && result.value) {
                const source = i === 0 ? '主要API' : '飞书API';
                console.log(`✅ 使用${source}数据`);
                return result.value;
            }
        }

        // 如果所有API都失败，记录错误信息
        const errors = results
            .filter(r => r.status === 'rejected')
            .map(r => r.reason?.message || r.reason)
            .join('; ');
        
        console.warn('⚠️ 所有API请求失败，使用空数据:', errors);
        return { records: [] };
    }

    // 主要模板API
    async fetchTemplatesAPI1() {
        try {
            const response = await fetch(`${this.apiUrl}/templates`);
            if (!response.ok) {
                throw new Error(`主要API失败: ${response.status}`);
            }
            
            const rawData = await response.json();
            return this.standardizeTemplateData(rawData, 'api');
        } catch (error) {
            console.log('❌ 主要API失败:', error.message);
            throw error;
        }
    }

    // 飞书模板API
    async fetchTemplatesAPI2() {
        try {
            const response = await fetch(`${this.apiUrl}/feishu-bitable`);
            if (!response.ok) {
                throw new Error(`飞书API失败: ${response.status}`);
            }
            
            const feishuData = await response.json();
            if (!feishuData.success || !feishuData.records) {
                throw new Error('飞书API返回格式错误');
            }
            
            return this.standardizeFeishuData(feishuData);
        } catch (error) {
            console.log('❌ 飞书API失败:', error.message);
            throw error;
        }
    }

    // 标准化模板数据格式
    standardizeTemplateData(rawData, source) {
        if (rawData.records) {
            return rawData; // 已经是标准格式
        }
        
        let templates = [];
        if (rawData.templates) {
            templates = rawData.templates;
        } else if (Array.isArray(rawData)) {
            templates = rawData;
        }

        return {
            records: templates.map(template => ({
                id: template.id || template._id,
                record_id: template.id || template._id,
                title: template.title || template.name || '未命名模板',
                content: template.content || template.prompt || '',
                author: template.author || template.creator || '匿名',
                tags: Array.isArray(template.tags) ? template.tags : [],
                type: template.type || 'text',
                stars: parseInt(template.stars || template.likes || 0),
                views: parseInt(template.views || 0),
                createdAt: template.createdAt || template.created_at || new Date().toLocaleDateString('zh-CN'),
                preview: template.preview || template.description,
                _dataSource: source,
                _hasStats: !!(template.stars || template.likes || template.views)
            }))
        };
    }

    // 标准化飞书数据格式
    standardizeFeishuData(feishuData) {
        return {
            records: feishuData.records.map(record => ({
                id: record.record_id,
                record_id: record.record_id,
                title: record.fields?.['name'] || record.fields?.['Name'] || '未命名模板',
                content: record.fields?.['Prompt'] || record.fields?.['prompt'] || '',
                author: record.fields?.['creator'] || '匿名',
                tags: this.parseFeishuTags(record.fields?.['tag'] || record.fields?.['tags']),
                type: record.fields?.['type'] || 'text',
                stars: 0, // 飞书数据中没有统计信息
                views: 0,
                createdAt: record.fields?.['Date'] ? 
                    new Date(record.fields['Date']).toLocaleDateString('zh-CN') : 
                    new Date().toLocaleDateString('zh-CN'),
                _dataSource: 'feishu',
                _hasStats: false
            }))
        };
    }

    // 高效处理收藏模板数据
    processCollectedTemplates(starredData, templatesData) {
        const allTemplates = templatesData.records || [];
        const starredTemplateIds = new Set(starredData.templateIds);
        
        console.log(`🔍 筛选收藏模板: ${starredTemplateIds.size}个收藏ID, ${allTemplates.length}个总模板`);
        
        // 使用Map优化查找性能
        const templateMap = new Map();
        allTemplates.forEach(template => {
            const id = template.id || template.record_id;
            templateMap.set(id, template);
        });

        // 高效筛选和转换
        const userStarredTemplates = [];
        for (const templateId of starredTemplateIds) {
            const template = templateMap.get(templateId);
            if (template) {
                const starInfo = starredData.templates?.find(s => s.template_id === templateId);
                
                userStarredTemplates.push({
                    id: templateId,
                    title: template.title || '未命名模板',
                    content: template.content || template.preview || '',
                    fullContent: template.content || '',
                    description: template.preview || (template.content || '').substring(0, 200) + '...',
                    author: template.author || '匿名',
                    likes: template.stars || 0,
                    views: template.views || 0,
                    comments: 0,
                    stars: template.stars || 0,
                    tags: Array.isArray(template.tags) ? template.tags : [],
                    source: 'import',
                    type: template.type || 'text',
                    createdAt: template.createdAt || new Date().toLocaleDateString('zh-CN'),
                    starredAt: starInfo?.created_at || new Date().toISOString(),
                    url: template.url,
                    _dataSource: template._dataSource || 'unknown',
                    _hasStats: template._hasStats || false
                });
            }
        }

        // 按收藏时间排序
        userStarredTemplates.sort((a, b) => {
            return new Date(b.starredAt).getTime() - new Date(a.starredAt).getTime();
        });

        console.log(`✅ 收藏模板处理完成: ${userStarredTemplates.length}个`);
        return userStarredTemplates;
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
                const itemData = this.decodeItemData(card.dataset.item);
                if (itemData) {
                    this.showPromptDetail(itemData);
                }
            });

            // Bind copy button events
            const copyBtn = card.querySelector('.copy-btn');
            if (copyBtn) {
                copyBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const itemData = this.decodeItemData(card.dataset.item);
                    if (itemData) {
                        this.handleCardCopy(itemData, copyBtn);
                    }
                });
            }

            // Bind like button events
            const likeBtn = card.querySelector('.like-btn');
            if (likeBtn) {
                likeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const itemData = this.decodeItemData(card.dataset.item);
                    if (itemData) {
                        this.handleLike(itemData.id, card);
                    }
                });
            }
        });
    }

    renderTemplateCards(items, container) {
        console.log('🎨 渲染模板卡片 (优化版本):', items.length);
        this.performanceMonitor.start('renderTemplateCards');
        
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

        // 使用DocumentFragment优化DOM操作
        const fragment = document.createDocumentFragment();
        const gridDiv = document.createElement('div');
        gridDiv.className = 'card-grid';
        
        // 批量创建卡片HTML
        const cardsHtml = items.map(item => this.createCollectedTemplateCardHtml(item)).join('');
        gridDiv.innerHTML = cardsHtml;
        fragment.appendChild(gridDiv);
        
        // 一次性更新DOM
        container.innerHTML = topLinksHtml;
        container.appendChild(fragment);

        // 使用事件委托优化事件绑定
        this.bindTemplateCardEvents(container);
        
        this.performanceMonitor.end('renderTemplateCards');
        this.performanceMonitor.record('cardsRendered', items.length);
    }

    // 优化的事件绑定 - 使用事件委托
    bindTemplateCardEvents(container) {
        // 移除之前的事件监听器（如果存在）
        container.removeEventListener('click', this.handleTemplateCardClick);
        
        // 使用事件委托处理所有卡片事件
        this.handleTemplateCardClick = (event) => {
            const target = event.target;
            const card = target.closest('.template-card, .prompt-card');
            
            if (!card) return;
            
            const itemData = this.decodeItemData(card.dataset.item);
            if (!itemData) return;
            
            // 处理不同的点击事件
            if (target.closest('.copy-btn')) {
                event.stopPropagation();
                this.handleCardCopy(itemData, target.closest('.copy-btn'));
            } else if (target.closest('.star-btn')) {
                event.stopPropagation();
                this.handleTemplateUnstar(itemData.id, card);
            } else {
                // 点击卡片其他区域 - 显示详情
                this.showPromptDetail(itemData);
            }
        };
        
        container.addEventListener('click', this.handleTemplateCardClick);
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
            <div class="prompt-card" data-item='${this.encodeItemData(item)}'>
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
                            <button class="stat-btn copy-btn primary" title="复制提示词">
                                <span class="stat-text large">复制</span>
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
            <div class="template-card" data-item='${this.encodeItemData(item)}'>
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
        const hasStats = item._hasStats || false; // 检查是否有统计数据
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

        // 简化统计显示，不显示收藏和浏览图标
        const statsHtml = `
            <button class="stat-btn star-btn active" title="取消收藏">
                <span class="stat-icon">⭐</span>
                <span class="stat-count">已收藏</span>
            </button>
        `;

        return `
            <div class="prompt-card template-card" data-item='${this.encodeItemData(item)}'>
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
                            <button class="stat-btn copy-btn primary" title="复制模板内容">
                                <span class="stat-text large">复制</span>
                            </button>
                            ${statsHtml}
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
            
            buttonElement.querySelector('.stat-text').textContent = '复制中';
            buttonElement.disabled = true;

            // 尝试使用现代 Clipboard API
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(fullContent);
            } else {
                // 降级到传统方法
                this.fallbackCopy(fullContent);
            }

            // 恢复按钮状态并显示成功提示
            buttonElement.querySelector('.stat-text').textContent = '已复制';
            
            this.showToast('提示词已复制到剪贴板', 'success', 2000);

            // 2秒后恢复原始状态
            setTimeout(() => {
                buttonElement.querySelector('.stat-text').textContent = originalText;
                buttonElement.disabled = false;
            }, 2000);

        } catch (error) {
            console.error('复制失败:', error);
            
            // 恢复按钮状态
            buttonElement.querySelector('.stat-text').textContent = '失败';
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
                const itemData = this.decodeItemData(cardElement.dataset.item);
                const stars = itemData?.stars || 0;
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

        // 添加详情模式类，隐藏header
        document.body.classList.add('detail-mode');

        // 显示详情视图
        const tabContent = document.querySelector('.tab-content');
        const detailView = document.getElementById('detailView');
        
        if (tabContent) tabContent.style.display = 'none';
        if (detailView) detailView.style.display = 'flex';

        // 隐藏置顶按钮（详情页面不显示）
        const scrollToTopBtn = document.getElementById('scrollToTop');
        if (scrollToTopBtn) {
            scrollToTopBtn.classList.remove('show');
        }
    }

    // 隐藏详情视图，返回列表
    hideDetailView() {
        console.log('Hiding detail view');
        this.isDetailView = false;
        this.currentDetailItem = null;

        // 移除详情模式类，显示header
        document.body.classList.remove('detail-mode');

        // 隐藏详情视图，显示列表
        const tabContent = document.querySelector('.tab-content');
        const detailView = document.getElementById('detailView');
        
        if (detailView) detailView.style.display = 'none';
        if (tabContent) tabContent.style.display = 'block';

        // 恢复置顶按钮的显示状态（如果需要的话）
        const scrollToTopBtn = document.getElementById('scrollToTop');
        if (scrollToTopBtn && this.currentUser) {
            // 检查当前滚动位置，决定是否显示按钮
            const activeTabContent = document.querySelector('.tab-content');
            if (activeTabContent && activeTabContent.scrollTop > 100) {
                scrollToTopBtn.classList.add('show');
            }
        }
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

    // 安全地将对象编码为HTML属性值
    encodeItemData(item) {
        try {
            const jsonString = JSON.stringify(item);
            // 使用更简单的Base64编码方式
            return btoa(encodeURIComponent(jsonString));
        } catch (error) {
            console.error('编码项目数据失败:', error);
            return '';
        }
    }

    // 安全地从HTML属性值解码对象
    decodeItemData(encodedData) {
        try {
            // 使用更简单的Base64解码方式
            const jsonString = decodeURIComponent(atob(encodedData));
            return JSON.parse(jsonString);
        } catch (error) {
            console.error('解码项目数据失败:', error);
            return null;
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
