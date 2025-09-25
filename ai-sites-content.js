// AI网站自动填充内容脚本
// 支持多个AI对话网站的自动填充和发送功能

class AIAutoFiller {
    constructor() {
        this.siteConfigs = this.getSiteConfigs();
        this.currentSite = this.detectCurrentSite();
        this.isReady = false;
        this.maxRetries = 3;
        this.retryCount = 0;
        this.init();
    }

    init() {
        console.log('🚀 PrompterHub AI自动填充脚本已加载:', window.location.hostname);
        
        // 等待页面加载完成
        this.waitForPageLoad().then(() => {
            this.initializeAfterLoad();
        });

        // 监听来自扩展的消息
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request, sender, sendResponse);
            return true; // 保持消息通道开放
        });
    }

    // 等待页面完全加载
    async waitForPageLoad() {
        return new Promise((resolve) => {
            if (document.readyState === 'complete') {
                resolve();
            } else {
                const checkReady = () => {
                    if (document.readyState === 'complete') {
                        resolve();
                    } else {
                        setTimeout(checkReady, 100);
                    }
                };
                checkReady();
            }
        });
    }

    initializeAfterLoad() {
        // 使用更智能的等待策略
        this.waitForElements().then(() => {
            this.isReady = true;
            console.log('✅ 页面加载完成，自动填充功能已就绪');
        }).catch((error) => {
            console.warn('⚠️ 页面初始化警告:', error);
            // 即使元素检测失败，也标记为就绪，在实际使用时再重试
            setTimeout(() => {
                this.isReady = true;
                console.log('✅ 延迟标记为就绪');
            }, 3000);
        });
    }

    // 等待关键元素出现
    async waitForElements() {
        if (!this.currentSite) {
            throw new Error('不支持的网站');
        }

        const timeout = 10000; // 10秒超时
        const startTime = Date.now();
        
        return new Promise((resolve, reject) => {
            const checkElements = () => {
                const inputElement = this.findElement(this.currentSite.inputSelectors);
                
                if (inputElement) {
                    console.log('✅ 找到输入元素');
                    resolve();
                } else if (Date.now() - startTime > timeout) {
                    reject(new Error('等待元素超时'));
                } else {
                    setTimeout(checkElements, 500);
                }
            };
            
            checkElements();
        });
    }

    getSiteConfigs() {
        return {
            'chat.deepseek.com': {
                name: 'DeepSeek',
                inputSelectors: [
                    'textarea[data-testid="chat-input"]',
                    'textarea[placeholder*="输入"]',
                    'textarea[placeholder*="请输入"]',
                    'textarea[placeholder*="Message"]',
                    'textarea[class*="input"]',
                    '.chat-input textarea',
                    '[role="textbox"]',
                    '#chat-input',
                    'textarea',
                    '[contenteditable="true"]'
                ],
                sendSelectors: [
                    'button[data-testid="send-button"]',
                    'button[aria-label*="发送"]',
                    'button[aria-label*="Send"]',
                    'button[title*="发送"]',
                    'button[type="submit"]',
                    'button:has(svg[class*="send"])',
                    'button:has(svg)',
                    '.send-button',
                    'button:last-of-type'
                ],
                waitTime: 1500
            },
            'www.doubao.com': {
                name: '豆包',
                inputSelectors: [
                    'textarea[placeholder*="输入"]',
                    'textarea[placeholder*="请输入"]',
                    '.chat-input textarea',
                    '#chat-input',
                    'textarea'
                ],
                sendSelectors: [
                    'button[type="submit"]',
                    'button:has(svg)',
                    '.send-button',
                    'button[aria-label*="发送"]'
                ],
                waitTime: 1000
            },
            'www.kimi.com': {
                name: 'Kimi',
                inputSelectors: [
                    'textarea[placeholder*="输入"]',
                    'textarea[placeholder*="请输入"]',
                    '.chat-input textarea',
                    '#chat-input',
                    'textarea'
                ],
                sendSelectors: [
                    'button[type="submit"]',
                    'button:has(svg)',
                    '.send-button',
                    'button[aria-label*="发送"]'
                ],
                waitTime: 1000
            },
            'jimeng.jianying.com': {
                name: '即梦',
                inputSelectors: [
                    'textarea[placeholder*="输入"]',
                    'textarea[placeholder*="请输入"]',
                    '.input-area textarea',
                    '#input',
                    'textarea'
                ],
                sendSelectors: [
                    'button[type="submit"]',
                    'button:has(svg)',
                    '.submit-btn',
                    'button[aria-label*="发送"]'
                ],
                waitTime: 1500
            },
            'chatglm.cn': {
                name: '智谱清言',
                inputSelectors: [
                    'textarea[placeholder*="输入"]',
                    'textarea[placeholder*="请输入"]',
                    '.chat-input textarea',
                    '#chat-input',
                    'textarea'
                ],
                sendSelectors: [
                    'button[type="submit"]',
                    'button:has(svg)',
                    '.send-button',
                    'button[aria-label*="发送"]'
                ],
                waitTime: 1000
            },
            'gemini.google.com': {
                name: 'Gemini',
                inputSelectors: [
                    'textarea[placeholder*="Enter"]',
                    'textarea[placeholder*="输入"]',
                    '.chat-input textarea',
                    'rich-textarea textarea',
                    'textarea[data-testid="chat-input"]',
                    'textarea'
                ],
                sendSelectors: [
                    'button[aria-label*="Send"]',
                    'button[aria-label*="发送"]',
                    'button[type="submit"]',
                    'button:has(svg)',
                    '.send-button'
                ],
                waitTime: 1000
            },
            'grok.com': {
                name: 'Grok',
                inputSelectors: [
                    'textarea[placeholder*="Ask"]',
                    'textarea[placeholder*="输入"]',
                    '.chat-input textarea',
                    '#chat-input',
                    'textarea'
                ],
                sendSelectors: [
                    'button[type="submit"]',
                    'button:has(svg)',
                    '.send-button',
                    'button[aria-label*="Send"]'
                ],
                waitTime: 1000
            }
        };
    }

    detectCurrentSite() {
        const hostname = window.location.hostname;
        return this.siteConfigs[hostname] || null;
    }

    async handleMessage(request, sender, sendResponse) {
        console.log('📨 收到消息:', request);

        if (request.action === 'fillAndSend') {
            try {
                const result = await this.fillAndSend(request.text);
                sendResponse({ success: true, message: result });
            } catch (error) {
                console.error('❌ 自动填充失败:', error);
                sendResponse({ success: false, error: error.message });
            }
        } else if (request.action === 'checkReady') {
            sendResponse({ 
                ready: this.isReady, 
                site: this.currentSite?.name || 'Unknown',
                hostname: window.location.hostname
            });
        }
    }

    // 带重试机制的填充和发送
    async fillAndSend(text) {
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                console.log(`📝 第 ${attempt}/${this.maxRetries} 次尝试在 ${this.currentSite?.name || window.location.hostname} 上自动填充`);
                
                // 等待页面就绪
                await this.ensureReady();
                
                if (!this.currentSite) {
                    throw new Error(`不支持的网站: ${window.location.hostname}`);
                }

                // 智能查找输入框
                const inputElement = await this.findElementWithWait(this.currentSite.inputSelectors, 8000);
                if (!inputElement) {
                    throw new Error(`在 ${this.currentSite.name} 上找不到输入框`);
                }

                console.log('✅ 找到输入框:', inputElement.tagName, inputElement.className);

                // 确保输入框准备就绪
                await this.ensureElementReady(inputElement);

                // 填充内容
                await this.smartFillInput(inputElement, text);
                
                // 验证填充结果
                await this.sleep(800);
                if (!this.verifyInputContent(inputElement, text)) {
                    throw new Error('内容填充验证失败');
                }

                // 智能发送
                const sendResult = await this.smartSend(inputElement);
                if (sendResult.success) {
                    return `✅ 成功在 ${this.currentSite.name} 上填充并发送内容`;
                } else {
                    throw new Error(sendResult.message || '发送失败');
                }

            } catch (error) {
                console.warn(`❌ 第 ${attempt} 次尝试失败:`, error.message);
                
                if (attempt === this.maxRetries) {
                    console.error('❌ 所有重试都失败了');
                    throw new Error(`自动填充失败: ${error.message}`);
                }
                
                // 等待后重试
                await this.sleep(1500 * attempt);
            }
        }
    }

    // 确保页面就绪
    async ensureReady() {
        const timeout = 15000; // 15秒超时
        const startTime = Date.now();
        
        while (!this.isReady && (Date.now() - startTime < timeout)) {
            await this.sleep(300);
        }
        
        if (!this.isReady) {
            // 即使未就绪也继续尝试，可能页面检测有问题
            console.warn('⚠️ 页面可能未完全就绪，继续尝试...');
        }
    }

    // 智能等待元素出现
    async findElementWithWait(selectors, timeout = 8000) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            const element = this.findElement(selectors);
            if (element) {
                return element;
            }
            await this.sleep(400);
        }
        
        return null;
    }

    // 确保元素准备就绪
    async ensureElementReady(element) {
        // 滚动到元素位置
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await this.sleep(500);
        
        // 聚焦元素
        try {
            element.focus();
            await this.sleep(300);
        } catch (e) {
            console.warn('聚焦失败:', e);
        }
        
        // 如果元素不可见，尝试点击父容器
        if (!this.isElementVisible(element)) {
            const clickableParent = element.closest('[role="textbox"], .input-wrapper, .chat-input, .input-container');
            if (clickableParent) {
                clickableParent.click();
                await this.sleep(800);
            }
        }
    }

    findElement(selectors) {
        for (const selector of selectors) {
            try {
                const elements = document.querySelectorAll(selector);
                for (const element of elements) {
                    // 检查元素是否可见和可交互
                    if (this.isElementVisible(element) && this.isElementInteractable(element)) {
                        console.log('✅ 找到可用元素:', selector);
                        return element;
                    }
                }
            } catch (error) {
                console.warn('⚠️ 选择器无效:', selector, error);
            }
        }
        return null;
    }

    isElementVisible(element) {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        
        return (
            rect.width > 0 &&
            rect.height > 0 &&
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            style.opacity !== '0'
        );
    }

    isElementInteractable(element) {
        return (
            !element.disabled &&
            element.getAttribute('aria-disabled') !== 'true' &&
            !element.readOnly
        );
    }

    // 智能填充输入框内容
    async smartFillInput(element, text) {
        console.log('🎯 开始智能填充内容...');
        
        // 多种清空和填充方法
        const fillMethods = [
            // 方法1: 标准方式
            () => {
                element.focus();
                element.value = '';
                element.value = text;
                this.triggerInputEvents(element);
            },
            // 方法2: contentEditable处理
            () => {
                element.focus();
                if (element.contentEditable === 'true' || element.isContentEditable) {
                    element.textContent = '';
                    element.textContent = text;
                    element.innerHTML = text;
                } else {
                    element.value = text;
                }
                this.triggerInputEvents(element);
            },
            // 方法3: execCommand方式
            () => {
                element.focus();
                if (document.execCommand) {
                    document.execCommand('selectAll', false, null);
                    document.execCommand('insertText', false, text);
                }
                this.triggerInputEvents(element);
            },
            // 方法4: 模拟键盘输入
            () => {
                element.focus();
                element.value = '';
                // 逐字符输入
                for (let i = 0; i < text.length; i++) {
                    const char = text[i];
                    element.value += char;
                    element.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
                    element.dispatchEvent(new Event('input', { bubbles: true }));
                }
                this.triggerInputEvents(element);
            }
        ];

        // 尝试不同的填充方法
        for (let i = 0; i < fillMethods.length; i++) {
            try {
                await fillMethods[i]();
                await this.sleep(500);
                
                // 验证填充是否成功
                if (this.verifyInputContent(element, text)) {
                    console.log(`✅ 填充方法 ${i + 1} 成功`);
                    return true;
                }
            } catch (error) {
                console.warn(`填充方法 ${i + 1} 失败:`, error);
            }
        }
        
        throw new Error('所有填充方法都失败了');
    }

    // 触发输入相关事件
    triggerInputEvents(element) {
        const events = [
            new Event('input', { bubbles: true, cancelable: true }),
            new Event('change', { bubbles: true, cancelable: true }),
            new KeyboardEvent('keyup', { bubbles: true, cancelable: true }),
            new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText' }),
            new Event('blur', { bubbles: true }),
            new Event('focus', { bubbles: true })
        ];

        events.forEach(event => {
            try {
                element.dispatchEvent(event);
            } catch (e) {
                // 忽略事件触发错误
            }
        });

        // React特殊处理
        if (element._valueTracker) {
            element._valueTracker.setValue(element.value || element.textContent);
        }
    }

    // 验证输入内容
    verifyInputContent(element, expectedText) {
        const actualContent = this.getElementValue(element);
        const textToCheck = expectedText.substring(0, Math.min(20, expectedText.length));
        const isValid = actualContent.includes(textToCheck) || actualContent.length > expectedText.length * 0.8;
        console.log('验证填充结果:', { expected: textToCheck, actual: actualContent.substring(0, 20), isValid });
        return isValid;
    }

    // 获取元素的值
    getElementValue(element) {
        if (element.value !== undefined) {
            return element.value;
        } else if (element.textContent) {
            return element.textContent;
        } else if (element.innerText) {
            return element.innerText;
        } else if (element.innerHTML) {
            return element.innerHTML.replace(/<[^>]*>/g, '');
        }
        return '';
    }

    // 智能发送
    async smartSend(inputElement) {
        console.log('🚀 开始智能发送...');
        
        // 查找发送按钮
        const sendButton = await this.findElementWithWait(this.currentSite.sendSelectors, 3000);
        
        if (sendButton && this.isElementClickable(sendButton)) {
            return await this.trySendWithButton(sendButton);
        } else {
            return await this.trySendWithKeyboard(inputElement);
        }
    }

    // 尝试用按钮发送
    async trySendWithButton(button) {
        try {
            // 确保按钮可见
            button.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await this.sleep(300);
            
            // 多种点击方式
            const clickMethods = [
                () => button.click(),
                () => {
                    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
                    button.dispatchEvent(event);
                },
                () => {
                    button.focus();
                    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
                }
            ];

            for (const method of clickMethods) {
                try {
                    method();
                    await this.sleep(500);
                    console.log('✅ 按钮点击成功');
                    return { success: true, method: 'button' };
                } catch (error) {
                    console.warn('按钮点击方式失败:', error);
                }
            }
            
            return { success: false, message: '按钮点击失败' };
        } catch (error) {
            return { success: false, message: `按钮发送失败: ${error.message}` };
        }
    }

    // 尝试用键盘发送
    async trySendWithKeyboard(inputElement) {
        const keyboardMethods = [
            // Enter键
            () => {
                inputElement.dispatchEvent(new KeyboardEvent('keydown', {
                    key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true
                }));
            },
            // Ctrl+Enter
            () => {
                inputElement.dispatchEvent(new KeyboardEvent('keydown', {
                    key: 'Enter', code: 'Enter', keyCode: 13, which: 13, ctrlKey: true, bubbles: true, cancelable: true
                }));
            },
            // 查找附近的发送按钮
            () => {
                const nearbyButton = inputElement.closest('form')?.querySelector('button[type="submit"]') ||
                                   inputElement.parentElement?.querySelector('button') ||
                                   document.querySelector('button[aria-label*="Send"], button[title*="Send"], button[data-testid*="send"]');
                if (nearbyButton) {
                    nearbyButton.click();
                    return true;
                }
                return false;
            }
        ];

        for (let i = 0; i < keyboardMethods.length; i++) {
            try {
                const result = keyboardMethods[i]();
                await this.sleep(500);
                
                // 如果方法返回了明确的成功标志，则认为成功
                if (result === true) {
                    console.log(`✅ 键盘发送方式 ${i + 1} 成功`);
                    return { success: true, method: `keyboard-${i + 1}` };
                }
                
                console.log(`✅ 键盘发送方式 ${i + 1} 执行`);
                return { success: true, method: `keyboard-${i + 1}` };
            } catch (error) {
                console.warn(`键盘发送方式 ${i + 1} 失败:`, error);
            }
        }

        return { success: false, message: '所有发送方式都失败了' };
    }

    // 检查元素是否可点击
    isElementClickable(element) {
        return element && 
               !element.disabled && 
               element.getAttribute('aria-disabled') !== 'true' &&
               this.isElementVisible(element);
    }

    clickSendButton(button) {
        console.log('🚀 点击发送按钮');
        
        // 确保按钮在视口中
        button.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // 多种点击方式确保成功
        button.focus();
        
        // 模拟鼠标点击
        const clickEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window
        });
        button.dispatchEvent(clickEvent);
        
        // 如果是按钮元素，也尝试直接调用click方法
        if (typeof button.click === 'function') {
            button.click();
        }

        console.log('✅ 发送按钮已点击');
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// 初始化自动填充器
const autoFiller = new AIAutoFiller();

// 导出到全局作用域以便调试
window.prompterhubAutoFiller = autoFiller;
