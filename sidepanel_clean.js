// PrompterHub Assistant - Sidepanel JavaScript

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
        this.currentTab = 'homepage'; // 默认显示首页
        this.baseUrl = 'https://www.prompterhub.cn';
        this.apiUrl = 'https://www.prompterhub.cn/api';
        this.checkingAuth = false;
        this.lastAuthState = null;
        this.starredTemplates = [];
        this.currentDetailItem = null; // 当前显示详情的项目
        this.isDetailView = false; // 是否在详情视图
        this.activeToasts = []; // 当前显示的提示列表
        
        // 首页相关状态
        this.selectedModels = new Set(); // 选中的模型
        this.modelUrls = { // 模型对应的URL
            'deepseek': 'https://chat.deepseek.com/',
            'doubao': 'https://www.doubao.com/chat/',
            'kimi': 'https://www.kimi.com/',
            'jimeng': 'https://jimeng.jianying.com/ai-tool/home',
            'zhipu': 'https://chatglm.cn/main/alltoolsdetail?lang=zh',
            'gemini': 'https://gemini.google.com/app',
            'grok': 'https://grok.com/'
        };
        
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

        // 绑定首页事件
        this.bindHomepageEvents();

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

    // 绑定首页事件
    bindHomepageEvents() {
        // 模型选择事件
        document.querySelectorAll('.model-card').forEach(card => {
            card.addEventListener('click', () => {
                this.toggleModelSelection(card);
            });
        });

        // 发送按钮事件
        const sendBtn = document.getElementById('sendToModelsBtn');
        if (sendBtn) {
            sendBtn.addEventListener('click', () => {
                this.sendToSelectedModels();
            });
        }

        // 输入框事件 - 实时更新按钮状态
        const promptInput = document.getElementById('promptInput');
        if (promptInput) {
            promptInput.addEventListener('input', () => {
                this.updateSendButtonState();
            });
        }

        // 初始化时默认选中所有模型
        this.selectAllModels();
    }

    // 切换模型选择状态
    toggleModelSelection(card) {
        const isSelected = card.classList.contains('selected');
        const modelValue = card.dataset.value;
        
        if (isSelected) {
            // 取消选择
            card.classList.remove('selected');
            this.selectedModels.delete(modelValue);
        } else {
            // 选择
            card.classList.add('selected');
            this.selectedModels.add(modelValue);
        }
        
        this.updateSendButtonState();
    }

    // 选中所有模型
    selectAllModels() {
        const cards = document.querySelectorAll('.model-card');
        cards.forEach(card => {
            const modelValue = card.dataset.value;
            card.classList.add('selected');
            this.selectedModels.add(modelValue);
        });
        this.updateSendButtonState();
    }

    // 处理模型选择
    handleModelSelection() {
        const checkboxes = document.querySelectorAll('input[name="selectedModels"]');
        this.selectedModels.clear();
        
        checkboxes.forEach(checkbox => {
            const card = checkbox.closest('.model-card');
            if (checkbox.checked) {
                this.selectedModels.add(checkbox.value);
                card.classList.add('selected');
            } else {
                card.classList.remove('selected');
            }
        });

        this.updateSelectedCount();
        this.updateSendButtonState();
    }

    // 更新选中数量显示
    updateSelectedCount() {
        const countElement = document.getElementById('selectedCount');
        if (!countElement) return;

        const count = this.selectedModels.size;
        if (count === 0) {
            countElement.textContent = '未选择任何模型';
        } else {
            const modelNames = Array.from(this.selectedModels).map(modelId => {
                const card = document.querySelector(`input[value="${modelId}"]`).closest('.model-card');
                return card.dataset.name;
            }).join('、');
            countElement.textContent = `已选择 ${count} 个模型：${modelNames}`;
        }
    }

    // 更新发送按钮状态
    updateSendButtonState() {
        const sendBtn = document.getElementById('sendToModelsBtn');
        const promptInput = document.getElementById('promptInput');
        
        if (!sendBtn || !promptInput) return;

        const hasContent = promptInput.value.trim().length > 0;
        const hasSelectedModels = this.selectedModels.size > 0;
        
        // 发送按钮状态依赖于是否有内容和是否选择了模型
        sendBtn.disabled = !hasContent || !hasSelectedModels;
        
        // 更新按钮文本
        const btnText = sendBtn.querySelector('.btn-text');
        if (btnText) {
            if (!hasContent) {
                btnText.textContent = '请输入提示词';
            } else if (!hasSelectedModels) {
                btnText.textContent = '请选择模型';
            } else {
                btnText.textContent = '发送';
            }
        }
    }

    // 发送到选中的模型
    async sendToSelectedModels() {
        const promptInput = document.getElementById('promptInput');
        if (!promptInput) return;

        const promptText = promptInput.value.trim();
        if (!promptText) {
            this.showToast('请输入提示词内容', 'warning');
            return;
        }

        if (this.selectedModels.size === 0) {
            this.showToast('请选择至少一个AI模型', 'warning');
            return;
        }

        // 定义所有模型映射
        const modelMap = {
            'deepseek': { id: 'deepseek', name: 'DeepSeek', url: 'https://chat.deepseek.com/' },
            'doubao': { id: 'doubao', name: '豆包', url: 'https://www.doubao.com/chat/' },
            'kimi': { id: 'kimi', name: 'Kimi', url: 'https://www.kimi.com/' },
            'jimeng': { id: 'jimeng', name: '即梦', url: 'https://jimeng.jianying.com/ai-tool/home' },
            'zhipu': { id: 'zhipu', name: '智谱清言', url: 'https://chatglm.cn/main/alltoolsdetail?lang=zh' },
            'gemini': { id: 'gemini', name: 'Gemini', url: 'https://gemini.google.com/app' },
            'grok': { id: 'grok', name: 'Grok', url: 'https://grok.com/' }
        };

        // 获取选中的模型
        const selectedModels = Array.from(this.selectedModels).map(id => modelMap[id]).filter(Boolean);

        try {
            // 首先复制到剪贴板作为备选方案
            try {
                await navigator.clipboard.writeText(promptText);
                console.log('✅ 提示词已复制到剪贴板');
            } catch (error) {
                console.warn('❌ 剪贴板复制失败:', error);
            }

            // 更新按钮状态
            const sendBtn = document.getElementById('sendToModelsBtn');
            const originalText = sendBtn.querySelector('.btn-text').textContent;
            sendBtn.disabled = true;
            sendBtn.querySelector('.btn-text').textContent = '正在发送...';

            // 显示开始提示
            this.showToast(`🚀 开始向 ${selectedModels.length} 个AI模型发送提示词...`, 'info', 2000);

            // 依次打开选中的模型并自动填充
            const results = [];
            
            for (let i = 0; i < selectedModels.length; i++) {
                const model = selectedModels[i];
                
                try {
                    // 创建新标签页
                    const tab = await chrome.tabs.create({ 
                        url: model.url,
                        active: i === 0 // 第一个标签页设为活动状态
                    });

                    // 等待页面加载并确保内容脚本已注入
                    await new Promise(resolve => setTimeout(resolve, 3000));

                    // 首先检查内容脚本是否已加载
                    let scriptReady = false;
                    try {
                        const readyResponse = await chrome.tabs.sendMessage(tab.id, {
                            action: 'checkReady'
                        });
                        scriptReady = readyResponse && readyResponse.ready;
                        console.log(`📊 ${model.name} 内容脚本状态:`, scriptReady ? '已就绪' : '未就绪');
                    } catch (error) {
                        console.warn(`⚠️ ${model.name}: 无法检查内容脚本状态`, error);
                    }

                    // 如果内容脚本未就绪，尝试手动注入
                    if (!scriptReady) {
                        try {
                            console.log(`🔧 手动注入内容脚本到 ${model.name}`);
                            await chrome.scripting.executeScript({
                                target: { tabId: tab.id },
                                files: ['ai-sites-content.js']
                            });
                            // 等待脚本初始化
                            await new Promise(resolve => setTimeout(resolve, 2000));
                        } catch (injectError) {
                            console.error(`❌ ${model.name}: 手动注入失败`, injectError);
                        }
                    }

                    // 发送消息到内容脚本进行自动填充和发送
                    try {
                        const response = await chrome.tabs.sendMessage(tab.id, {
                            action: 'fillAndSend',
                            text: promptText
                        });
                        
                        if (response && response.success) {
                            results.push({ model: model.name, success: true, message: response.message });
                            console.log(`✅ ${model.name}: ${response.message}`);
                        } else {
                            // 自动发送失败时，提示用户手动粘贴
                            const errorMsg = response?.error || '未知错误';
                            results.push({ 
                                model: model.name, 
                                success: false, 
                                message: `自动发送失败 (${errorMsg})，已复制到剪贴板，请在 ${model.name} 中手动粘贴 (Ctrl+V)` 
                            });
                            console.warn(`❌ ${model.name}: 自动发送失败 - ${errorMsg}`);
                        }
                    } catch (error) {
                        results.push({ 
                            model: model.name, 
                            success: false, 
                            message: `连接失败，已复制到剪贴板，请在 ${model.name} 中手动粘贴 (Ctrl+V)` 
                        });
                        console.warn(`❌ ${model.name}: 通信失败`, error);
                    }

                    // 间隔500ms避免浏览器阻止
                    if (i < selectedModels.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                } catch (error) {
                    results.push({ model: model.name, success: false, message: `打开失败: ${error.message}` });
                    console.error(`❌ ${model.name}: 打开失败`, error);
                }
            }

            // 统计结果
            const successCount = results.filter(r => r.success).length;
            const failedCount = results.filter(r => !r.success).length;

            // 显示结果
            if (successCount === selectedModels.length) {
                this.showToast(`🎉 成功自动向所有 ${selectedModels.length} 个AI模型发送提示词！`, 'success', 4000);
            } else if (successCount > 0) {
                this.showToast(`✅ 自动发送到 ${successCount} 个模型成功，${failedCount} 个需要手动粘贴`, 'info', 5000);
            } else {
                this.showToast(`📋 已复制提示词到剪贴板，请在各AI网站中手动粘贴 (Ctrl+V)`, 'info', 5000);
            }

            // 清空输入框
            promptInput.value = '';

        } catch (error) {
            console.error('发送过程出错:', error);
            this.showToast('发送过程出错，请重试', 'error');
        } finally {
            // 恢复按钮状态
            const sendBtn = document.getElementById('sendToModelsBtn');
            if (sendBtn) {
                sendBtn.disabled = false;
                const btnText = sendBtn.querySelector('.btn-text');
                if (btnText) {
                    btnText.textContent = '发送';
                }
            }
        }
    }

    // 处理自动填充切换开关
    handleAutoFillToggle() {
        const autoFillToggle = document.getElementById('autoFillToggle');
        const toggleDescription = document.getElementById('toggleDescription');
        
        if (!autoFillToggle || !toggleDescription) return;
        
        if (autoFillToggle.checked) {
            toggleDescription.textContent = '开启后将自动在AI网站中填充并发送提示词';
        } else {
            toggleDescription.textContent = '关闭后将复制到剪贴板，需手动粘贴到AI网站';
        }
        
        // 更新按钮文本
        this.updateSendButtonState();
    }

