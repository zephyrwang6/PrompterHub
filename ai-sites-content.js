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
        }).catch((error) => {
            // 即使元素检测失败，也标记为就绪，在实际使用时再重试
            setTimeout(() => {
                this.isReady = true;
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
                    'textarea[data-testid="chat_input"]',
                    'textarea[placeholder*="输入"]',
                    'textarea[placeholder*="请输入"]',
                    'textarea[placeholder*="有什么想聊"]',
                    '.chat-input textarea',
                    '.input-area textarea',
                    '#chat-input',
                    'textarea',
                    '[contenteditable="true"]'
                ],
                sendSelectors: [
                    'button[data-testid="send_button"]',
                    'button[aria-label*="发送"]',
                    'button[title*="发送"]',
                    'button[type="submit"]',
                    'button:has(svg[class*="send"])',
                    'button:has(svg)',
                    '.send-button',
                    'button:last-of-type'
                ],
                waitTime: 1500,
                specialHandling: true
            },
            'www.kimi.com': {
                name: 'Kimi',
                inputSelectors: [
                    'textarea[placeholder*="Ask Anything"]',
                    'textarea[placeholder*="输入"]',
                    'textarea[placeholder*="请输入"]',
                    'textarea[data-testid="chat-input"]',
                    'textarea[aria-label*="输入"]',
                    '.input-area textarea',
                    '.chat-input textarea',
                    '.composer textarea',
                    '#chat-input',
                    'div[contenteditable="true"][role="textbox"]',
                    '[contenteditable="true"]',
                    'textarea',
                    'input[type="text"]'
                ],
                sendSelectors: [
                    'button[data-testid="send-button"]',
                    'button[aria-label*="Send"]',
                    'button[aria-label*="发送"]',
                    'button[title*="Send"]',
                    'button[title*="发送"]',
                    'button[type="submit"]',
                    'button:has(svg[class*="send"])',
                    'button:has(svg)',
                    '.send-button',
                    'button:last-of-type'
                ],
                waitTime: 1500,
                specialHandling: true
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
                    'rich-textarea[placeholder*="Enter a prompt here"] textarea',
                    'rich-textarea textarea',
                    'textarea[placeholder*="Enter a prompt here"]',
                    'textarea[placeholder*="Enter"]',
                    'textarea[placeholder*="输入"]',
                    'textarea[aria-label*="Message"]',
                    'textarea[data-testid="input-textarea"]',
                    '.input-area textarea',
                    '.chat-input textarea',
                    'div[contenteditable="true"][role="textbox"]',
                    '[contenteditable="true"]',
                    'textarea'
                ],
                sendSelectors: [
                    'button[data-testid="send-button"]',
                    'button[aria-label*="Send message"]',
                    'button[aria-label*="Send"]',
                    'button[aria-label*="发送"]',
                    'button[title*="Send"]',
                    'button[type="submit"]',
                    'button:has(svg[class*="send"])',
                    'button:has(svg)',
                    '.send-button',
                    'button:last-of-type'
                ],
                waitTime: 1500,
                specialHandling: true
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
            },
            'chatgpt.com': {
                name: 'ChatGPT',
                inputSelectors: [
                    '#prompt-textarea',
                    'textarea[id="prompt-textarea"]',
                    'textarea[placeholder*="Message ChatGPT"]',
                    'textarea[placeholder*="Message"]',
                    'textarea[data-id="root"]',
                    'textarea[rows]',
                    '.composer-text-area textarea',
                    '.text-base textarea',
                    'div[contenteditable="true"][data-id="root"]',
                    'div[contenteditable="true"]',
                    '[contenteditable="true"]',
                    'textarea',
                    '#chat-input'
                ],
                sendSelectors: [
                    'button[data-testid="send-button"]',
                    'button[aria-label*="Send message"]',
                    'button[aria-label*="Send"]',
                    'button[title*="Send"]',
                    'button:has([data-testid="send-button-icon"])',
                    'button:has(svg[class*="send"])',
                    'button[type="submit"]',
                    'button:has(svg)',
                    '.send-button',
                    'button:last-of-type'
                ],
                waitTime: 1500,
                specialHandling: true
            }
        };
    }

    detectCurrentSite() {
        const hostname = window.location.hostname;
        return this.siteConfigs[hostname] || null;
    }

    async handleMessage(request, sender, sendResponse) {
        if (request.action === 'fillAndSend') {
            try {
                const result = await this.fillAndSend(request.text);
                sendResponse({ success: true, message: result });
            } catch (error) {
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
                if (attempt === this.maxRetries) {
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
            // 聚焦失败，继续执行
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
                        return element;
                    }
                }
            } catch (error) {
                // 选择器无效，继续尝试下一个
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
        
        // 豆包特殊处理
        if (this.currentSite && this.currentSite.specialHandling && window.location.hostname === 'www.doubao.com') {
            return await this.handleDoubaoInput(element, text);
        }
        
        // Gemini特殊处理
        if (this.currentSite && this.currentSite.specialHandling && window.location.hostname === 'gemini.google.com') {
            return await this.handleGeminiInput(element, text);
        }
        
        // ChatGPT特殊处理
        if (this.currentSite && this.currentSite.specialHandling && window.location.hostname === 'chatgpt.com') {
            return await this.handleChatGPTInput(element, text);
        }
        
        // Kimi特殊处理
        if (this.currentSite && this.currentSite.specialHandling && window.location.hostname === 'www.kimi.com') {
            return await this.handleKimiInput(element, text);
        }
        
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
                    return true;
                }
            } catch (error) {
                // 填充方法失败，继续尝试下一个
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
                    return { success: true, method: 'button' };
                } catch (error) {
                    // 按钮点击方式失败，继续尝试下一个
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
                    return { success: true, method: `keyboard-${i + 1}` };
                }
                
                return { success: true, method: `keyboard-${i + 1}` };
            } catch (error) {
                // 键盘发送方式失败，继续尝试下一个
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
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 豆包专用输入处理方法
    async handleDoubaoInput(element, text) {
        
        try {
            // 确保元素获得焦点
            element.focus();
            await this.sleep(200);
            
            // 方法1: React/Vue兼容的填充方式
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
            nativeInputValueSetter.call(element, text);
            
            // 触发React/Vue的change事件
            const inputEvent = new Event('input', { bubbles: true });
            element.dispatchEvent(inputEvent);
            
            await this.sleep(300);
            
            // 验证内容
            if (this.verifyInputContent(element, text)) {
                return true;
            }
            
            // 方法2: 如果方法1失败，尝试逐字符输入
            element.value = '';
            element.focus();
            
            for (let i = 0; i < text.length; i++) {
                const char = text[i];
                
                // 模拟键盘按下
                const keydownEvent = new KeyboardEvent('keydown', {
                    key: char,
                    keyCode: char.charCodeAt(0),
                    which: char.charCodeAt(0),
                    bubbles: true,
                    cancelable: true
                });
                element.dispatchEvent(keydownEvent);
                
                // 更新值
                element.value += char;
                
                // 触发input事件
                const inputEvent = new InputEvent('input', {
                    bubbles: true,
                    cancelable: true,
                    inputType: 'insertText',
                    data: char
                });
                element.dispatchEvent(inputEvent);
                
                // 模拟键盘释放
                const keyupEvent = new KeyboardEvent('keyup', {
                    key: char,
                    keyCode: char.charCodeAt(0),
                    which: char.charCodeAt(0),
                    bubbles: true,
                    cancelable: true
                });
                element.dispatchEvent(keyupEvent);
                
                // 短暂延迟，模拟真实输入
                await this.sleep(20);
            }
            
            // 最终验证
            await this.sleep(500);
            if (this.verifyInputContent(element, text)) {
                return true;
            }
            
            throw new Error('豆包填充验证失败');
            
        } catch (error) {
            throw error;
        }
    }

    // Gemini专用输入处理方法
    async handleGeminiInput(element, text) {
        
        try {
            // 确保元素获得焦点
            element.focus();
            await this.sleep(300);
            
            // 方法1: 处理contenteditable元素
            if (element.contentEditable === 'true' || element.getAttribute('contenteditable') === 'true') {
                
                // 清空内容
                element.textContent = '';
                element.innerHTML = '';
                
                // 设置新内容
                element.textContent = text;
                element.innerHTML = text;
                
                // 触发事件
                const inputEvent = new Event('input', { bubbles: true, cancelable: true });
                const changeEvent = new Event('change', { bubbles: true, cancelable: true });
                element.dispatchEvent(inputEvent);
                element.dispatchEvent(changeEvent);
                
                await this.sleep(500);
                
                if (element.textContent.includes(text) || element.innerHTML.includes(text)) {
                    return true;
                }
            }
            
            // 方法2: 标准textarea处理
            if (element.tagName.toLowerCase() === 'textarea') {
                
                // 使用原生setter
                const nativeValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
                nativeValueSetter.call(element, text);
                
                // 触发完整的事件序列
                const events = [
                    new Event('focus', { bubbles: true }),
                    new Event('input', { bubbles: true, cancelable: true }),
                    new Event('change', { bubbles: true, cancelable: true }),
                    new KeyboardEvent('keyup', { bubbles: true, cancelable: true })
                ];
                
                events.forEach(event => element.dispatchEvent(event));
                
                await this.sleep(500);
                
                if (this.verifyInputContent(element, text)) {
                    return true;
                }
            }
            
            // 方法3: 模拟键盘输入（适用于复杂的富文本编辑器）
            // 尝试模拟键盘输入
            
            // 先清空
            element.focus();
            await this.sleep(200);
            
            // 全选并删除
            document.execCommand('selectAll', false, null);
            document.execCommand('delete', false, null);
            
            await this.sleep(200);
            
            // 逐字符输入
            for (let i = 0; i < text.length; i++) {
                const char = text[i];
                
                // 使用execCommand插入文本
                if (document.execCommand) {
                    document.execCommand('insertText', false, char);
                } else {
                    // 备用方法：直接设置值
                    if (element.tagName.toLowerCase() === 'textarea') {
                        element.value += char;
                    } else {
                        element.textContent += char;
                    }
                }
                
                // 触发输入事件
                const inputEvent = new InputEvent('input', {
                    bubbles: true,
                    cancelable: true,
                    inputType: 'insertText',
                    data: char
                });
                element.dispatchEvent(inputEvent);
                
                // 短暂延迟
                await this.sleep(10);
            }
            
            // 最终验证
            await this.sleep(800);
            const finalContent = element.value || element.textContent || element.innerHTML;
            if (finalContent.includes(text)) {
                return true;
            }
            
            throw new Error('Gemini填充验证失败');
            
        } catch (error) {
            throw error;
        }
    }

    // ChatGPT专用输入处理方法
    async handleChatGPTInput(element, text) {
        
        try {
            // 确保元素获得焦点
            element.focus();
            await this.sleep(300);
            
            // 方法1: 处理textarea元素
            if (element.tagName.toLowerCase() === 'textarea') {
                
                // 清空现有内容
                element.value = '';
                element.focus();
                
                // 使用原生setter设置值
                const nativeValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
                nativeValueSetter.call(element, text);
                
                // 触发React事件
                const inputEvent = new Event('input', { bubbles: true });
                const changeEvent = new Event('change', { bubbles: true });
                element.dispatchEvent(inputEvent);
                element.dispatchEvent(changeEvent);
                
                await this.sleep(500);
                
                if (this.verifyInputContent(element, text)) {
                    return true;
                }
            }
            
            // 方法2: 处理contenteditable元素
            if (element.contentEditable === 'true' || element.getAttribute('contenteditable') === 'true') {
                
                // 清空内容
                element.textContent = '';
                element.innerHTML = '';
                element.focus();
                
                await this.sleep(200);
                
                // 设置新内容
                element.textContent = text;
                
                // 触发事件
                const events = [
                    new Event('input', { bubbles: true, cancelable: true }),
                    new Event('change', { bubbles: true, cancelable: true }),
                    new KeyboardEvent('keyup', { bubbles: true, cancelable: true })
                ];
                
                events.forEach(event => element.dispatchEvent(event));
                
                await this.sleep(500);
                
                if (element.textContent.includes(text) || element.innerHTML.includes(text)) {
                    return true;
                }
            }
            
            // 方法3: 模拟键盘输入
            // ChatGPT模拟键盘输入
            
            // 先清空
            element.focus();
            await this.sleep(200);
            
            // 全选并删除现有内容
            if (element.tagName.toLowerCase() === 'textarea') {
                element.select();
                document.execCommand('delete', false, null);
            } else {
                document.execCommand('selectAll', false, null);
                document.execCommand('delete', false, null);
            }
            
            await this.sleep(300);
            
            // 逐字符输入
            for (let i = 0; i < text.length; i++) {
                const char = text[i];
                
                // 模拟键盘事件
                const keydownEvent = new KeyboardEvent('keydown', {
                    key: char,
                    keyCode: char.charCodeAt(0),
                    which: char.charCodeAt(0),
                    bubbles: true,
                    cancelable: true
                });
                element.dispatchEvent(keydownEvent);
                
                // 使用execCommand插入文本
                if (document.execCommand) {
                    document.execCommand('insertText', false, char);
                } else {
                    // 备用方法
                    if (element.tagName.toLowerCase() === 'textarea') {
                        element.value += char;
                    } else {
                        element.textContent += char;
                    }
                }
                
                // 触发输入事件
                const inputEvent = new InputEvent('input', {
                    bubbles: true,
                    cancelable: true,
                    inputType: 'insertText',
                    data: char
                });
                element.dispatchEvent(inputEvent);
                
                // 模拟键盘释放
                const keyupEvent = new KeyboardEvent('keyup', {
                    key: char,
                    keyCode: char.charCodeAt(0),
                    which: char.charCodeAt(0),
                    bubbles: true,
                    cancelable: true
                });
                element.dispatchEvent(keyupEvent);
                
                // 短暂延迟模拟真实输入
                await this.sleep(15);
            }
            
            // 最终验证
            await this.sleep(800);
            const finalContent = element.value || element.textContent || element.innerHTML;
            if (finalContent.includes(text)) {
                return true;
            }
            
            throw new Error('ChatGPT填充验证失败');
            
        } catch (error) {
            throw error;
        }
    }

    // Kimi专用输入处理方法
    async handleKimiInput(element, text) {
        
        try {
            // 确保元素获得焦点
            element.focus();
            await this.sleep(300);
            
            // 方法1: 处理textarea元素
            if (element.tagName.toLowerCase() === 'textarea') {
                
                // 清空现有内容
                element.value = '';
                element.focus();
                
                // 使用原生setter设置值
                const nativeValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
                nativeValueSetter.call(element, text);
                
                // 触发现代框架事件
                const events = [
                    new Event('input', { bubbles: true, cancelable: true }),
                    new Event('change', { bubbles: true, cancelable: true }),
                    new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: text }),
                    new KeyboardEvent('keyup', { bubbles: true, cancelable: true })
                ];
                
                events.forEach(event => element.dispatchEvent(event));
                
                await this.sleep(500);
                
                if (this.verifyInputContent(element, text)) {
                    return true;
                }
            }
            
            // 方法2: 处理contenteditable元素
            if (element.contentEditable === 'true' || element.getAttribute('contenteditable') === 'true') {
                
                // 清空内容
                element.textContent = '';
                element.innerHTML = '';
                element.focus();
                
                await this.sleep(200);
                
                // 设置新内容
                element.textContent = text;
                
                // 触发事件
                const events = [
                    new Event('input', { bubbles: true, cancelable: true }),
                    new Event('change', { bubbles: true, cancelable: true }),
                    new KeyboardEvent('keyup', { bubbles: true, cancelable: true }),
                    new Event('blur', { bubbles: true }),
                    new Event('focus', { bubbles: true })
                ];
                
                events.forEach(event => element.dispatchEvent(event));
                
                await this.sleep(500);
                
                if (element.textContent.includes(text) || element.innerHTML.includes(text)) {
                    return true;
                }
            }
            
            // 方法3: 模拟用户输入（适用于复杂的前端框架）
            // Kimi模拟用户输入
            
            // 先清空
            element.focus();
            await this.sleep(200);
            
            // 全选并删除现有内容
            if (element.tagName.toLowerCase() === 'textarea' || element.tagName.toLowerCase() === 'input') {
                element.select();
                document.execCommand('delete', false, null);
            } else {
                document.execCommand('selectAll', false, null);
                document.execCommand('delete', false, null);
            }
            
            await this.sleep(300);
            
            // 逐字符输入模拟真实用户行为
            for (let i = 0; i < text.length; i++) {
                const char = text[i];
                
                // 模拟按键按下
                const keydownEvent = new KeyboardEvent('keydown', {
                    key: char,
                    code: `Key${char.toUpperCase()}`,
                    keyCode: char.charCodeAt(0),
                    which: char.charCodeAt(0),
                    bubbles: true,
                    cancelable: true,
                    composed: true
                });
                element.dispatchEvent(keydownEvent);
                
                // 插入字符
                if (document.execCommand) {
                    document.execCommand('insertText', false, char);
                } else {
                    // 备用方法
                    if (element.tagName.toLowerCase() === 'textarea' || element.tagName.toLowerCase() === 'input') {
                        element.value += char;
                    } else {
                        element.textContent += char;
                    }
                }
                
                // 触发输入事件
                const inputEvent = new InputEvent('input', {
                    bubbles: true,
                    cancelable: true,
                    composed: true,
                    inputType: 'insertText',
                    data: char
                });
                element.dispatchEvent(inputEvent);
                
                // 模拟按键释放
                const keyupEvent = new KeyboardEvent('keyup', {
                    key: char,
                    code: `Key${char.toUpperCase()}`,
                    keyCode: char.charCodeAt(0),
                    which: char.charCodeAt(0),
                    bubbles: true,
                    cancelable: true,
                    composed: true
                });
                element.dispatchEvent(keyupEvent);
                
                // 短暂延迟模拟真实输入速度
                await this.sleep(20);
            }
            
            // 最终验证
            await this.sleep(800);
            const finalContent = element.value || element.textContent || element.innerHTML;
            if (finalContent.includes(text)) {
                return true;
            }
            
            throw new Error('Kimi填充验证失败');
            
        } catch (error) {
            throw error;
        }
    }
}

// 初始化自动填充器
const autoFiller = new AIAutoFiller();

// 导出到全局作用域以便调试
window.prompterhubAutoFiller = autoFiller;
