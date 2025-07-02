// PrompterHub助手 - 弹窗脚本

document.addEventListener('DOMContentLoaded', () => {
    // 打开侧边栏面板
    document.getElementById('openSidepanel').addEventListener('click', async () => {
        try {
            // 获取当前活跃窗口
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            // 打开侧边栏面板
            await chrome.sidePanel.open({ windowId: tab.windowId });
            
            // 关闭弹窗
            window.close();
        } catch (error) {
            console.error('打开侧边栏失败:', error);
        }
    });

    // 访问PrompterHub网站
    document.getElementById('visitWebsite').addEventListener('click', async () => {
        try {
            await chrome.tabs.create({
                url: 'https://www.prompterhub.cn'
            });
            
            // 关闭弹窗
            window.close();
        } catch (error) {
            console.error('打开网站失败:', error);
        }
    });
}); 