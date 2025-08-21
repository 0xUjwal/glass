const { BrowserWindow, globalShortcut, screen, app, shell, powerMonitor } = require('electron');
const WindowLayoutManager = require('./windowLayoutManager');
const SmoothMovementManager = require('./smoothMovementManager');
const path = require('node:path');
const os = require('os');
const shortcutsService = require('../features/shortcuts/shortcutsService');
const internalBridge = require('../bridge/internalBridge');
const permissionRepository = require('../features/common/repositories/permission');

/* ────────────────[ GLASS BYPASS ]─────────────── */
let liquidGlass;
const isLiquidGlassSupported = () => {
    if (process.platform !== 'darwin') {
        return false;
    }
    const majorVersion = parseInt(os.release().split('.')[0], 10);
    return majorVersion >= 26;
};
let shouldUseLiquidGlass = isLiquidGlassSupported();
if (shouldUseLiquidGlass) {
    try {
        liquidGlass = require('electron-liquid-glass');
    } catch (e) {
        console.warn('Could not load optional dependency "electron-liquid-glass". The feature will be disabled.');
        shouldUseLiquidGlass = false;
    }
}
/* ────────────────[ GLASS BYPASS ]─────────────── */

let isContentProtectionOn = true;
let lastVisibleWindows = new Set(['header']);
let shouldMaintainFocus = true;
let aggressiveFocusMode = true;

let currentHeaderState = 'apikey';
const windowPool = new Map();

let settingsHideTimer = null;

let layoutManager = null;
let movementManager = null;

// Platform-specific always-on-top logic function
function applyAggressiveAlwaysOnTop(window) {
    if (!window || window.isDestroyed()) return;
    if (process.platform === 'win32') {
        window.setAlwaysOnTop(true, 'screen-saver', 1);
    } else if (process.platform === 'darwin') {
        window.setAlwaysOnTop(true, 'screen-saver');
    } else {
        window.setAlwaysOnTop(true);
    }
}
function removeAggressiveAlwaysOnTop(window) {
    if (!window || window.isDestroyed()) return;
    window.setAlwaysOnTop(false);
}

function updateChildWindowLayouts(animated = true) {
    const visibleWindows = {};
    const listenWin = windowPool.get('listen');
    const askWin = windowPool.get('ask');
    if (listenWin && !listenWin.isDestroyed() && listenWin.isVisible()) {
        visibleWindows.listen = true;
    }
    if (askWin && !askWin.isDestroyed() && askWin.isVisible()) {
        visibleWindows.ask = true;
    }
    if (Object.keys(visibleWindows).length === 0) return;
    const newLayout = layoutManager.calculateFeatureWindowLayout(visibleWindows);
    movementManager.animateLayout(newLayout, animated);
}

const showSettingsWindow = () => {
    internalBridge.emit('window:requestVisibility', { name: 'settings', visible: true });
};
const hideSettingsWindow = () => {
    internalBridge.emit('window:requestVisibility', { name: 'settings', visible: false });
};
const cancelHideSettingsWindow = () => {
    internalBridge.emit('window:requestVisibility', { name: 'settings', visible: true });
};
const moveWindowStep = direction => {
    internalBridge.emit('window:moveStep', { direction });
};
const resizeHeaderWindow = ({ width, height }) => {
    internalBridge.emit('window:resizeHeaderWindow', { width, height });
};
const handleHeaderAnimationFinished = state => {
    internalBridge.emit('window:headerAnimationFinished', state);
};
const getHeaderPosition = () => {
    return new Promise(resolve => {
        internalBridge.emit('window:getHeaderPosition', position => {
            resolve(position);
        });
    });
};
const moveHeaderTo = (newX, newY) => {
    internalBridge.emit('window:moveHeaderTo', { newX, newY });
};
const adjustWindowHeight = (winName, targetHeight) => {
    internalBridge.emit('window:adjustWindowHeight', { winName, targetHeight });
};

// Focus logic: Only restore focus if no other app is active
const restoreWindowFocus = () => {
    const header = windowPool.get('header');
    if (!header || header.isDestroyed() || !header.isVisible()) return false;
    const activeWindow = BrowserWindow.getFocusedWindow();
    const isOtherAppActive = activeWindow && !Array.from(windowPool.values()).includes(activeWindow);
    if (isOtherAppActive) {
        applyAggressiveAlwaysOnTop(header);
        return true;
    }
    try {
        applyAggressiveAlwaysOnTop(header);
        header.moveTop();
        header.focus();
        setTimeout(() => {
            if (!header.isDestroyed() && !header.isFocused()) {
                header.moveTop();
                header.focus();
            }
        }, 100);
        return true;
    } catch (error) {
        try {
            header.focus();
            return true;
        } catch {
            return false;
        }
    }
};

function setupWindowController(windowPool, layoutManager, movementManager) {
    internalBridge.on('window:requestVisibility', ({ name, visible }) => {
        handleWindowVisibilityRequest(windowPool, layoutManager, movementManager, name, visible);
    });
    internalBridge.on('window:requestToggleAllWindowsVisibility', ({ targetVisibility }) => {
        changeAllWindowsVisibility(windowPool, targetVisibility);
    });
    
    // MOVE LOGIC - Added from your original code
    internalBridge.on('window:moveToDisplay', ({ displayId }) => {
        const header = windowPool.get('header');
        if (!header || header.isDestroyed()) return;

        const newPosition = layoutManager.calculateNewPositionForDisplay(header, displayId);
        if (newPosition) {
            movementManager.animateWindowPosition(header, newPosition, {
                onComplete: () => updateChildWindowLayouts(true),
            });
        }
    });

    internalBridge.on('window:moveToEdge', ({ direction }) => {
        const header = windowPool.get('header');
        if (!header || header.isDestroyed()) return;

        const newPosition = layoutManager.calculateEdgePosition(header, direction);
        if (!newPosition) return;

        movementManager.animateWindowPosition(header, newPosition, {
            onComplete: () => updateChildWindowLayouts(true),
        });
    });

    internalBridge.on('window:moveStep', ({ direction }) => {
        const header = windowPool.get('header');
        if (!header || header.isDestroyed()) return;

        const newHeaderPosition = layoutManager.calculateStepMovePosition(header, direction);
        if (!newHeaderPosition) return;

        const futureHeaderBounds = { ...header.getBounds(), ...newHeaderPosition };
        const visibleWindows = {};
        const listenWin = windowPool.get('listen');
        const askWin = windowPool.get('ask');
        if (listenWin && !listenWin.isDestroyed() && listenWin.isVisible()) {
            visibleWindows.listen = true;
        }
        if (askWin && !askWin.isDestroyed() && askWin.isVisible()) {
            visibleWindows.ask = true;
        }

        const newChildLayout = layoutManager.calculateFeatureWindowLayout(visibleWindows, futureHeaderBounds);

        movementManager.animateWindowPosition(header, newHeaderPosition);
        movementManager.animateLayout(newChildLayout);
    });

    internalBridge.on('window:resizeHeaderWindow', ({ width, height }) => {
        const header = windowPool.get('header');
        if (!header || header.isDestroyed() || movementManager.isAnimating) return;

        const newHeaderBounds = layoutManager.calculateHeaderResize(header, { width, height });
        if (!newHeaderBounds) return;

        const wasResizable = header.isResizable();
        if (!wasResizable) header.setResizable(true);

        movementManager.animateWindowBounds(header, newHeaderBounds, {
            onComplete: () => {
                if (!header || header.isDestroyed()) return;
                if (!wasResizable) header.setResizable(false);
                updateChildWindowLayouts(true);
            },
        });
    });

    internalBridge.on('window:headerAnimationFinished', state => {
        const header = windowPool.get('header');
        if (!header || header.isDestroyed()) return;

        if (state === 'hidden') {
            header.hide();
        } else if (state === 'visible') {
            updateChildWindowLayouts(false);
        }
    });

    internalBridge.on('window:getHeaderPosition', reply => {
        const header = windowPool.get('header');
        if (header && !header.isDestroyed()) {
            reply(header.getBounds());
        } else {
            reply({ x: 0, y: 0, width: 0, height: 0 });
        }
    });

    internalBridge.on('window:moveHeaderTo', ({ newX, newY }) => {
        const header = windowPool.get('header');
        if (!header || header.isDestroyed()) return;

        const newPosition = layoutManager.calculateClampedPosition(header, { x: newX, y: newY });
        if (newPosition) {
            header.setPosition(newPosition.x, newPosition.y);
        }
    });

    internalBridge.on('window:adjustWindowHeight', ({ winName, targetHeight }) => {
        console.log(`[Layout Debug] adjustWindowHeight: targetHeight=${targetHeight}`);
        const senderWindow = windowPool.get(winName);
        if (!senderWindow || senderWindow.isDestroyed()) return;

        const newBounds = layoutManager.calculateWindowHeightAdjustment(senderWindow, targetHeight);
        if (!newBounds) return;

        const wasResizable = senderWindow.isResizable();
        if (!wasResizable) senderWindow.setResizable(true);

        movementManager.animateWindowBounds(senderWindow, newBounds, {
            onComplete: () => {
                if (!senderWindow || senderWindow.isDestroyed()) return;
                if (!wasResizable) senderWindow.setResizable(false);
                updateChildWindowLayouts(true);
            },
        });
    });
}

function changeAllWindowsVisibility(windowPool, targetVisibility) {
    const header = windowPool.get('header');
    if (!header) return;

    if (typeof targetVisibility === 'boolean' && header.isVisible() === targetVisibility) {
        return;
    }

    if (header.isVisible()) {
        lastVisibleWindows.clear();
        windowPool.forEach((win, name) => {
            if (win && !win.isDestroyed() && win.isVisible()) {
                lastVisibleWindows.add(name);
            }
        });

        lastVisibleWindows.forEach(name => {
            if (name === 'header') return;
            const win = windowPool.get(name);
            if (win && !win.isDestroyed()) win.hide();
        });
        header.hide();

        return;
    }

    lastVisibleWindows.forEach(name => {
        const win = windowPool.get(name);
        if (win && !win.isDestroyed()) win.showInactive();
    });
}

// Shows/hides windows and applies always-on-top logic
async function handleWindowVisibilityRequest(windowPool, layoutManager, movementManager, name, shouldBeVisible) {
    const win = windowPool.get(name);
    if (!win || win.isDestroyed()) return;

    if (name !== 'settings') {
        const isCurrentlyVisible = win.isVisible();
        if (isCurrentlyVisible === shouldBeVisible) return;
    }

    const disableClicks = selectedWindow => {
        for (const [name, win] of windowPool) {
            if (win !== selectedWindow && !win.isDestroyed()) {
                win.setIgnoreMouseEvents(true, { forward: true });
            }
        }
    };

    const restoreClicks = () => {
        for (const [, win] of windowPool) {
            if (!win.isDestroyed()) win.setIgnoreMouseEvents(false);
        }
    };

    if (name === 'settings') {
        if (shouldBeVisible) {
            if (settingsHideTimer) {
                clearTimeout(settingsHideTimer);
                settingsHideTimer = null;
            }
            const position = layoutManager.calculateSettingsWindowPosition();
            if (position && !win.isDestroyed()) {
                win.setBounds(position);
                win.__lockedByButton = true;
                win.showInactive();
                applyAggressiveAlwaysOnTop(win);
            }
        } else {
            if (settingsHideTimer) clearTimeout(settingsHideTimer);
            settingsHideTimer = setTimeout(() => {
                if (win && !win.isDestroyed()) {
                    removeAggressiveAlwaysOnTop(win);
                    win.hide();
                }
                settingsHideTimer = null;
            }, 200);
            win.__lockedByButton = false;
        }
        return;
    }

    if (name === 'shortcut-settings') {
        if (shouldBeVisible) {
            const newBounds = layoutManager.calculateShortcutSettingsWindowPosition();
            if (newBounds && !win.isDestroyed()) win.setBounds(newBounds);
            if (!win.isDestroyed()) {
                applyAggressiveAlwaysOnTop(win);
                disableClicks(win);
                win.showInactive();
            }
        } else {
            if (!win.isDestroyed()) {
                removeAggressiveAlwaysOnTop(win);
                restoreClicks();
                win.hide();
            }
        }
        return;
    }

    if (name === 'listen' || name === 'ask') {
        const otherName = name === 'listen' ? 'ask' : 'listen';
        const otherWin = windowPool.get(otherName);
        const isOtherWinVisible = otherWin && !otherWin.isDestroyed() && otherWin.isVisible();

        const ANIM_OFFSET_X = 50;
        const ANIM_OFFSET_Y = 20;

        const finalVisibility = {
            listen: (name === 'listen' && shouldBeVisible) || (otherName === 'listen' && isOtherWinVisible),
            ask: (name === 'ask' && shouldBeVisible) || (otherName === 'ask' && isOtherWinVisible),
        };
        if (!shouldBeVisible) finalVisibility[name] = false;

        const targetLayout = layoutManager.calculateFeatureWindowLayout(finalVisibility);

        if (shouldBeVisible) {
            const targetBounds = targetLayout[name];
            if (!targetBounds) return;

            const startPos = { ...targetBounds };
            if (name === 'listen') startPos.x -= ANIM_OFFSET_X;
            else if (name === 'ask') startPos.y -= ANIM_OFFSET_Y;

            if (!win.isDestroyed()) {
                win.setOpacity(0);
                win.setBounds(startPos);
                win.showInactive();
                applyAggressiveAlwaysOnTop(win);
            }
            movementManager.fade(win, { to: 1 });
            movementManager.animateLayout(targetLayout);
        } else {
            if (!win || !win.isVisible()) return;

            const currentBounds = win.getBounds();
            const targetPos = { ...currentBounds };
            if (name === 'listen') targetPos.x -= ANIM_OFFSET_X;
            else if (name === 'ask') targetPos.y -= ANIM_OFFSET_Y;

            movementManager.fade(win, {
                to: 0,
                onComplete: () => {
                    if (!win || win.isDestroyed()) return;
                    removeAggressiveAlwaysOnTop(win);
                    win.hide();
                },
            });
            movementManager.animateWindowPosition(win, targetPos);
            const otherWindowsLayout = { ...targetLayout };
            delete otherWindowsLayout[name];
            movementManager.animateLayout(otherWindowsLayout);
        }
    }
}

const setContentProtection = status => {
    isContentProtectionOn = status;
    windowPool.forEach(win => {
        if (win && !win.isDestroyed()) {
            win.setContentProtection(isContentProtectionOn);
        }
    });
};
const getContentProtectionStatus = () => isContentProtectionOn;
const toggleContentProtection = () => {
    const newStatus = !getContentProtectionStatus();
    setContentProtection(newStatus);
    return newStatus;
};
const openLoginPage = () => {
    const webUrl = process.env.pickleglass_WEB_URL || 'http://localhost:3000';
    shell.openExternal(`${webUrl}/personalize?desktop=true`);
};

function createFeatureWindows(header, namesToCreate) {
    const commonChildOptions = {
        parent: header,
        show: false,
        frame: false,
        transparent: true,
        vibrancy: false,
        hasShadow: false,
        skipTaskbar: true,
        hiddenInMissionControl: true,
        resizable: false,
        movable: true, // Make feature windows movable
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, '../preload.js'),
        },
    };
    const createFeatureWindow = name => {
        if (windowPool.has(name)) return;
        let win;
        switch (name) {
            case 'listen':
                win = new BrowserWindow({ ...commonChildOptions, width: 400, minWidth: 400, maxWidth: 900, maxHeight: 900 });
                break;
            case 'ask':
                win = new BrowserWindow({ ...commonChildOptions, width: 600 });
                break;
            case 'settings':
                win = new BrowserWindow({ ...commonChildOptions, width: 240, maxHeight: 400, parent: undefined });
                break;
            case 'shortcut-settings':
                win = new BrowserWindow({ ...commonChildOptions, width: 353, height: 720, modal: false, parent: undefined, alwaysOnTop: true, titleBarOverlay: false });
                break;
        }
        if (!win) return;
        win.setContentProtection(isContentProtectionOn);
        win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
        applyAggressiveAlwaysOnTop(win);
        if (process.platform === 'darwin') win.setWindowButtonVisibility(false);
        let view = name === 'shortcut-settings' ? 'shortcut-settings' : name;
        let loadOptions = { query: { view } };
        if (shouldUseLiquidGlass) {
            loadOptions.query.glass = 'true';
            win.loadFile(path.join(__dirname, '../ui/app/content.html'), loadOptions)
                .catch(console.error);
            win.webContents.once('did-finish-load', () => {
                if (liquidGlass) {
                    const viewId = liquidGlass.addView(win.getNativeWindowHandle());
                    if (viewId !== -1) {
                        liquidGlass.unstable_setVariant(viewId, liquidGlass.GlassMaterialVariant.bubbles);
                    }
                }
            });
        } else {
            win.loadFile(path.join(__dirname, '../ui/app/content.html'), loadOptions)
                .catch(console.error);
        }
        windowPool.set(name, win);
    };

    if (Array.isArray(namesToCreate)) namesToCreate.forEach(createFeatureWindow);
    else if (typeof namesToCreate === 'string') createFeatureWindow(namesToCreate);
    else ['listen', 'ask', 'settings', 'shortcut-settings'].forEach(createFeatureWindow);
}

function destroyFeatureWindows() {
    const featureWindows = ['listen', 'ask', 'settings', 'shortcut-settings'];
    if (settingsHideTimer) clearTimeout(settingsHideTimer);
    featureWindows.forEach(name => {
        const win = windowPool.get(name);
        if (win && !win.isDestroyed()) win.destroy();
        windowPool.delete(name);
    });
}

function getCurrentDisplay(window) {
    if (!window || window.isDestroyed()) return screen.getPrimaryDisplay();
    const windowBounds = window.getBounds();
    const windowCenter = {
        x: windowBounds.x + windowBounds.width / 2,
        y: windowBounds.y + windowBounds.height / 2,
    };
    return screen.getDisplayNearestPoint(windowCenter);
}

function createWindows() {
    const HEADER_HEIGHT = 47;
    const DEFAULT_WINDOW_WIDTH = 353;

    const primaryDisplay = screen.getPrimaryDisplay();
    const { y: workAreaY, width: screenWidth } = primaryDisplay.workArea;
    const initialX = Math.round((screenWidth - DEFAULT_WINDOW_WIDTH) / 2);
    const initialY = workAreaY + 21;

    const header = new BrowserWindow({
        width: DEFAULT_WINDOW_WIDTH,
        height: HEADER_HEIGHT,
        x: initialX,
        y: initialY,
        frame: false,
        transparent: true,
        vibrancy: false,
        hasShadow: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        hiddenInMissionControl: true,
        resizable: false,
        movable: true, // This is the key to allow the header window to be moved!
        focusable: true,
        acceptFirstMouse: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, '../preload.js'),
            backgroundThrottling: false,
            webSecurity: false,
            enableRemoteModule: false,
            experimentalFeatures: false,
        },
        useContentSize: true,
        disableAutoHideCursor: true,
    });
    applyAggressiveAlwaysOnTop(header);
    if (process.platform === 'darwin') header.setWindowButtonVisibility(false);

    const headerLoadOptions = shouldUseLiquidGlass ? { query: { glass: 'true' } } : {};
    header.loadFile(path.join(__dirname, '../ui/app/header.html'), headerLoadOptions);

    windowPool.set('header', header);
    layoutManager = new WindowLayoutManager(windowPool);
    movementManager = new SmoothMovementManager(windowPool);

    header.on('moved', () => {
        if (movementManager.isAnimating) return;
        updateChildWindowLayouts(false);
    });

    header.webContents.once('dom-ready', () => {
        shortcutsService.initialize(windowPool);
        shortcutsService.registerShortcuts();
    });

    setupIpcHandlers(windowPool, layoutManager);
    setupWindowController(windowPool, layoutManager, movementManager);

    // Avoid random focus stealing: only restore focus on system interference
    let focusRestoreTimer = null;
    const restoreFocusIfNeeded = () => {
        if (focusRestoreTimer) clearTimeout(focusRestoreTimer);
        focusRestoreTimer = setTimeout(() => {
            if (!header.isDestroyed() && !header.isFocused() && header.isVisible() && shouldMaintainFocus) {
                const activeWindow = BrowserWindow.getFocusedWindow();
                const isOtherAppActive = activeWindow && !Array.from(windowPool.values()).includes(activeWindow);
                if (isOtherAppActive) return;
                try {
                    applyAggressiveAlwaysOnTop(header);
                    header.moveTop();
                    header.focus();
                } catch (error) {}
            }
            focusRestoreTimer = null;
        }, 100);
    };

    header.on('focus', () => {});
    header.on('blur', () => {
        if (header.isVisible() && header.isAlwaysOnTop()) {
            setTimeout(() => {
                const activeWindow = BrowserWindow.getFocusedWindow();
                if (!activeWindow || !Array.from(windowPool.values()).includes(activeWindow)) {
                    restoreFocusIfNeeded();
                }
            }, 500);
        }
    });

    if (powerMonitor) {
        powerMonitor.on('resume', () => {
            setTimeout(() => {
                if (header.isVisible() && !header.isDestroyed()) {
                    restoreFocusIfNeeded();
                }
            }, 1000);
        });
        if (process.platform === 'win32') {
            powerMonitor.on('unlock-screen', () => {
                setTimeout(() => {
                    if (header.isVisible() && !header.isDestroyed()) {
                        restoreFocusIfNeeded();
                    }
                }, 500);
            });
        }
    }
    app.on('activate', () => {
        if (header.isVisible() && !header.isDestroyed()) {
            setTimeout(() => restoreFocusIfNeeded(), 100);
        }
    });

    screen.on('display-metrics-changed', () => {
        if (header.isVisible() && !header.isDestroyed()) {
            restoreFocusIfNeeded();
        }
    });

    header.on('resize', () => updateChildWindowLayouts(false));
    if (currentHeaderState === 'main') createFeatureWindows(header, ['listen', 'ask', 'settings', 'shortcut-settings']);
    header.setContentProtection(isContentProtectionOn);
    header.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    return windowPool;
}

function setupIpcHandlers(windowPool, layoutManager) {
    screen.on('display-added', (event, newDisplay) => {
        console.log('[Display] New display added:', newDisplay.id);
    });
    screen.on('display-removed', (event, oldDisplay) => {
        console.log('[Display] Display removed:', oldDisplay.id);
        const header = windowPool.get('header');
        if (header && getCurrentDisplay(header).id === oldDisplay.id) {
            const primaryDisplay = screen.getPrimaryDisplay();
            const newPosition = layoutManager.calculateNewPositionForDisplay(header, primaryDisplay.id);
            if (newPosition) {
                header.setPosition(newPosition.x, newPosition.y, false);
                updateChildWindowLayouts(false);
            }
        }
    });
    screen.on('display-metrics-changed', (event, display, changedMetrics) => {
        updateChildWindowLayouts(false);
    });
}

const handleHeaderStateChanged = state => {
    console.log(`[WindowManager] Header state changed to: ${state}`);
    currentHeaderState = state;
    if (state === 'main') {
        createFeatureWindows(windowPool.get('header'));
    } else {
        destroyFeatureWindows();
    }
    internalBridge.emit('reregister-shortcuts');
};

const setAggressiveFocusMode = (enabled) => {
    aggressiveFocusMode = enabled;
    console.log(`[WindowManager] Aggressive focus mode ${enabled ? 'enabled' : 'disabled'}`);
};
const getAggressiveFocusMode = () => aggressiveFocusMode;

/**
 * Recreate a window after crash
 */
const recreateWindow = async (windowName) => {
    console.log(`[WindowManager] Recreating window: ${windowName}`);
    
    try {
        // Remove old window from pool if it exists
        const oldWindow = windowPool.get(windowName);
        if (oldWindow && !oldWindow.isDestroyed()) {
            oldWindow.close();
        }
        windowPool.delete(windowName);

        // Recreate based on window type
        switch (windowName) {
            case 'header':
                await recreateHeaderWindow();
                break;
            case 'ask':
                await recreateAskWindow();
                break;
            case 'listen':
                await recreateListenWindow();
                break;
            case 'settings':
                await recreateSettingsWindow();
                break;
            case 'shortcut-settings':
                await recreateShortcutSettingsWindow();
                break;
            default:
                throw new Error(`Unknown window type: ${windowName}`);
        }

        console.log(`[WindowManager] Successfully recreated window: ${windowName}`);
        return true;
    } catch (error) {
        console.error(`[WindowManager] Failed to recreate window ${windowName}:`, error);
        throw error;
    }
};

/**
 * Recreate header window
 */
const recreateHeaderWindow = async () => {
    const header = new BrowserWindow({
        title: 'pickleglass',
        width: 600,
        height: 60,
        titleBarStyle: 'hidden',
        trafficLightPosition: { x: 16, y: 8 },
        resizable: false,
        minimizable: false,
        maximizable: false,
        fullscreenable: false,
        skipTaskbar: false,
        alwaysOnTop: true,
        hasShadow: false,
        roundedCorners: false,
        frame: false,
        transparent: true,
        backgroundColor: '#00000000',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, '..', 'preload.js'),
            backgroundThrottling: false,
            webSecurity: true
        }
    });

    windowPool.set('header', header);
    
    header.loadFile(path.join(__dirname, '..', 'ui', 'app', 'header.html'));
    setupHeaderWindowEvents(header);
    
    if (shouldUseLiquidGlass) {
        liquidGlass.applyLiquidGlass(header);
    }
    
    return header;
};

/**
 * Recreate ask window
 */
const recreateAskWindow = async () => {
    const header = windowPool.get('header');
    if (!header) {
        throw new Error('Header window required for ask window creation');
    }

    const ask = new BrowserWindow({
        width: 600,
        height: 400,
        titleBarStyle: 'hidden',
        resizable: true,
        minimizable: false,
        maximizable: false,
        fullscreenable: false,
        skipTaskbar: true,
        show: false,
        alwaysOnTop: true,
        hasShadow: false,
        roundedCorners: false,
        frame: false,
        transparent: true,
        backgroundColor: '#00000000',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, '..', 'preload.js'),
            backgroundThrottling: false,
            webSecurity: true
        }
    });

    windowPool.set('ask', ask);
    
    ask.loadFile(path.join(__dirname, '..', 'ui', 'ask', 'ask.html'));
    setupFeatureWindowEvents(ask, 'ask');
    
    if (shouldUseLiquidGlass) {
        liquidGlass.applyLiquidGlass(ask);
    }
    
    return ask;
};

/**
 * Recreate listen window
 */
const recreateListenWindow = async () => {
    const header = windowPool.get('header');
    if (!header) {
        throw new Error('Header window required for listen window creation');
    }

    const listen = new BrowserWindow({
        width: 400,
        height: 300,
        titleBarStyle: 'hidden',
        resizable: true,
        minimizable: false,
        maximizable: false,
        fullscreenable: false,
        skipTaskbar: true,
        show: false,
        alwaysOnTop: true,
        hasShadow: false,
        roundedCorners: false,
        frame: false,
        transparent: true,
        backgroundColor: '#00000000',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, '..', 'preload.js'),
            backgroundThrottling: false,
            webSecurity: true
        }
    });

    windowPool.set('listen', listen);
    
    listen.loadFile(path.join(__dirname, '..', 'ui', 'listen', 'listen.html'));
    setupFeatureWindowEvents(listen, 'listen');
    
    if (shouldUseLiquidGlass) {
        liquidGlass.applyLiquidGlass(listen);
    }
    
    return listen;
};

/**
 * Recreate settings window
 */
const recreateSettingsWindow = async () => {
    const settings = new BrowserWindow({
        width: 240,
        height: 400,
        titleBarStyle: 'hidden',
        resizable: false,
        minimizable: false,
        maximizable: false,
        fullscreenable: false,
        skipTaskbar: true,
        show: false,
        alwaysOnTop: true,
        hasShadow: false,
        roundedCorners: false,
        frame: false,
        transparent: true,
        backgroundColor: '#00000000',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, '..', 'preload.js'),
            backgroundThrottling: false,
            webSecurity: true
        }
    });

    windowPool.set('settings', settings);
    
    settings.loadFile(path.join(__dirname, '..', 'ui', 'settings', 'settings.html'));
    setupFeatureWindowEvents(settings, 'settings');
    
    if (shouldUseLiquidGlass) {
        liquidGlass.applyLiquidGlass(settings);
    }
    
    return settings;
};

/**
 * Recreate shortcut settings window
 */
const recreateShortcutSettingsWindow = async () => {
    const shortcutSettings = new BrowserWindow({
        width: 353,
        height: 720,
        titleBarStyle: 'hidden',
        resizable: false,
        minimizable: false,
        maximizable: false,
        fullscreenable: false,
        skipTaskbar: true,
        show: false,
        alwaysOnTop: true,
        hasShadow: false,
        roundedCorners: false,
        frame: false,
        transparent: true,
        backgroundColor: '#00000000',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, '..', 'preload.js'),
            backgroundThrottling: false,
            webSecurity: true
        }
    });

    windowPool.set('shortcut-settings', shortcutSettings);
    
    shortcutSettings.loadFile(path.join(__dirname, '..', 'ui', 'shortcuts', 'shortcuts.html'));
    setupFeatureWindowEvents(shortcutSettings, 'shortcut-settings');
    
    if (shouldUseLiquidGlass) {
        liquidGlass.applyLiquidGlass(shortcutSettings);
    }
    
    return shortcutSettings;
};

/**
 * Setup event handlers for header window
 */
const setupHeaderWindowEvents = (header) => {
    // Copy relevant event handlers from the original header creation
    header.on('focus', () => {
        if (aggressiveFocusMode) {
            applyAggressiveAlwaysOnTop(header);
        }
    });

    header.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    header.on('closed', () => {
        windowPool.delete('header');
    });
};

/**
 * Setup event handlers for feature windows
 */
const setupFeatureWindowEvents = (window, windowName) => {
    window.on('focus', () => {
        if (aggressiveFocusMode) {
            applyAggressiveAlwaysOnTop(window);
        }
    });

    window.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    window.on('closed', () => {
        windowPool.delete(windowName);
    });
};

/**
 * Close all windows gracefully
 */
const closeAllWindows = async () => {
    console.log('[WindowManager] Closing all windows gracefully');
    
    const closePromises = [];
    
    for (const [name, window] of windowPool.entries()) {
        if (window && !window.isDestroyed()) {
            closePromises.push(new Promise((resolve) => {
                window.once('closed', resolve);
                window.close();
            }));
        }
    }
    
    try {
        await Promise.all(closePromises);
        windowPool.clear();
        console.log('[WindowManager] All windows closed gracefully');
    } catch (error) {
        console.error('[WindowManager] Error closing windows:', error);
    }
};

/**
 * Get window manager instance for crash recovery
 */
const windowManager = {
    windowPool,
    recreateWindow,
    closeAllWindows
};

module.exports = {
    createWindows,
    windowPool,
    toggleContentProtection,
    resizeHeaderWindow,
    getContentProtectionStatus,
    showSettingsWindow,
    hideSettingsWindow,
    cancelHideSettingsWindow,
    openLoginPage,
    moveWindowStep,
    handleHeaderStateChanged,
    handleHeaderAnimationFinished,
    getHeaderPosition,
    moveHeaderTo,
    adjustWindowHeight,
    restoreWindowFocus,
    setAggressiveFocusMode,
    getAggressiveFocusMode,
    // Crash recovery functions
    recreateWindow,
    closeAllWindows,
    windowManager
};