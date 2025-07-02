// PrompterHub助手 - 后台脚本

// 插件安装时设置侧边栏
chrome.runtime.onInstalled.addListener(() => {
  console.log('PrompterHub助手已安装');
});

// 处理来自content script的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'AUTH_STATUS_CHANGED') {
    // 通知所有侧边栏更新认证状态
    chrome.storage.local.set({
      userAuth: {
        isLoggedIn: request.isLoggedIn,
        user: request.user,
        timestamp: Date.now()
      }
    });
  }
});

// 处理插件图标点击事件，打开侧边栏
chrome.action.onClicked.addListener(async (tab) => {
  try {
    // 检查chrome.sidePanel API是否可用
    if (chrome.sidePanel && chrome.sidePanel.open) {
      await chrome.sidePanel.open({ windowId: tab.windowId });
    } else {
      console.log('Side panel API not available');
    }
  } catch (error) {
    console.error('Error opening side panel:', error);
  }
}); 