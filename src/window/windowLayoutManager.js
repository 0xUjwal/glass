const { screen } = require('electron');

// Store original window dimensions
const ORIGINAL_WINDOW_DIMENSIONS = {
    ask: { width: 600, minHeight: 100 },
    listen: { width: 400, minHeight: 100 },
    settings: { width: 240, maxHeight: 400 },
    'shortcut-settings': { width: 353, height: 720 }
};

const getCurrentDisplay = window => {
    if (!window || window.isDestroyed()) return screen.getPrimaryDisplay();
    const windowBounds = window.getBounds();
    const windowCenter = {
        x: windowBounds.x + windowBounds.width / 2,
        y: windowBounds.y + windowBounds.height / 2,
    };
    return screen.getDisplayNearestPoint(windowCenter);
};

class WindowLayoutManager {
    constructor(windowPool) {
        this.windowPool = windowPool;
    }

    // Helper method to get original or current dimensions
    getWindowDimensions(windowName) {
        const win = this.windowPool.get(windowName);
        if (!win || win.isDestroyed()) return null;

        const original = ORIGINAL_WINDOW_DIMENSIONS[windowName];
        const current = win.getBounds();

        return {
            // Always use original width to prevent dimension creep
            width: original?.width || current.width,
            // Use current height but respect min/max constraints
            height: this.constrainHeight(current.height, original),
            x: current.x,
            y: current.y
        };
    }

    constrainHeight(currentHeight, originalConstraints) {
        if (!originalConstraints) return currentHeight;
        
        if (originalConstraints.minHeight && currentHeight < originalConstraints.minHeight) {
            return originalConstraints.minHeight;
        }
        if (originalConstraints.maxHeight && currentHeight > originalConstraints.maxHeight) {
            return originalConstraints.maxHeight;
        }
        if (originalConstraints.height) {
            return originalConstraints.height; // Fixed height
        }
        
        return currentHeight;
    }

    calculateSettingsWindowPosition() {
        const header = this.windowPool.get('header');
        const settings = this.windowPool.get('settings');

        if (!header || header.isDestroyed() || !settings || settings.isDestroyed()) {
            return null;
        }

        const headerBounds = header.getBounds();
        const settingsDimensions = this.getWindowDimensions('settings');

        const PAD = 5;
        const buttonPadding = 170;

        const x = headerBounds.x + headerBounds.width - settingsDimensions.width + buttonPadding;
        const y = headerBounds.y + headerBounds.height + PAD;

        return { 
            x: Math.round(x), 
            y: Math.round(y),
            width: settingsDimensions.width,
            height: settingsDimensions.height
        };
    }

    calculateHeaderResize(header, { width, height }) {
        if (!header || header.isDestroyed()) return null;
        const currentBounds = header.getBounds();
        const centerX = currentBounds.x + currentBounds.width / 2;
        const newX = Math.round(centerX - width / 2);
        return { x: newX, y: currentBounds.y, width, height };
    }

    calculateClampedPosition(header, { x: newX, y: newY }) {
        if (!header || header.isDestroyed()) return null;
        return { x: newX, y: newY };
    }

    calculateFeatureWindowLayout(visibility, headerBoundsOverride = null) {
        const header = this.windowPool.get('header');
        const headerBounds = headerBoundsOverride || (header ? header.getBounds() : null);

        if (!headerBounds) return {};

        let display;
        if (headerBoundsOverride) {
            const boundsCenter = {
                x: headerBounds.x + headerBounds.width / 2,
                y: headerBounds.y + headerBounds.height / 2,
            };
            display = screen.getDisplayNearestPoint(boundsCenter);
        } else {
            display = getCurrentDisplay(header);
        }

        const { width: screenWidth, height: screenHeight, x: workAreaX, y: workAreaY } = display.workArea;

        const askVis = visibility.ask && this.windowPool.get('ask') && !this.windowPool.get('ask').isDestroyed();
        const listenVis = visibility.listen && this.windowPool.get('listen') && !this.windowPool.get('listen').isDestroyed();

        if (!askVis && !listenVis) return {};

        const PAD = 8;
        const headerTopRel = headerBounds.y - workAreaY;
        const headerBottomRel = headerTopRel + headerBounds.height;
        const headerCenterXRel = headerBounds.x - workAreaX + headerBounds.width / 2;

        const relativeX = headerCenterXRel / screenWidth;
        const relativeY = (headerBounds.y - workAreaY) / screenHeight;
        const strategy = this.determineLayoutStrategy(headerBounds, screenWidth, screenHeight, relativeX, relativeY, workAreaX, workAreaY);

        // Use original dimensions instead of current bounds to prevent dimension creep
        const askDimensions = askVis ? this.getWindowDimensions('ask') : null;
        const listenDimensions = listenVis ? this.getWindowDimensions('listen') : null;

        if (askVis) {
            console.log(`[Layout Debug] Ask Window Dimensions: height=${askDimensions.height}, width=${askDimensions.width} (using original width)`);
        }
        if (listenVis) {
            console.log(`[Layout Debug] Listen Window Dimensions: height=${listenDimensions.height}, width=${listenDimensions.width} (using original width)`);
        }

        const layout = {};

        if (askVis && listenVis) {
            let askXRel = headerCenterXRel - askDimensions.width / 2;
            let listenXRel = askXRel - listenDimensions.width - PAD;

            if (strategy.primary === 'above') {
                const windowBottomAbs = headerBounds.y - PAD;
                layout.ask = {
                    x: Math.round(askXRel + workAreaX),
                    y: Math.round(windowBottomAbs - askDimensions.height),
                    width: askDimensions.width, // Fixed original width
                    height: askDimensions.height,
                };
                layout.listen = {
                    x: Math.round(listenXRel + workAreaX),
                    y: Math.round(windowBottomAbs - listenDimensions.height),
                    width: listenDimensions.width, // Fixed original width
                    height: listenDimensions.height,
                };
            } else {
                // 'below'
                const yAbs = headerBounds.y + headerBounds.height + PAD;
                layout.ask = { 
                    x: Math.round(askXRel + workAreaX), 
                    y: Math.round(yAbs), 
                    width: askDimensions.width, // Fixed original width
                    height: askDimensions.height 
                };
                layout.listen = { 
                    x: Math.round(listenXRel + workAreaX), 
                    y: Math.round(yAbs), 
                    width: listenDimensions.width, // Fixed original width
                    height: listenDimensions.height 
                };
            }
        } else {
            // Single window
            const winName = askVis ? 'ask' : 'listen';
            const winDimensions = askVis ? askDimensions : listenDimensions;
            
            let xRel = headerCenterXRel - winDimensions.width / 2;
            
            if (strategy.primary === 'above') {
                const windowBottomAbs = headerBounds.y - PAD;
                layout[winName] = {
                    x: Math.round(xRel + workAreaX),
                    y: Math.round(windowBottomAbs - winDimensions.height),
                    width: winDimensions.width, // Fixed original width
                    height: winDimensions.height,
                };
            } else {
                const yAbs = headerBounds.y + headerBounds.height + PAD;
                layout[winName] = { 
                    x: Math.round(xRel + workAreaX), 
                    y: Math.round(yAbs), 
                    width: winDimensions.width, // Fixed original width
                    height: winDimensions.height 
                };
            }
        }

        return layout;
    }

    calculateShortcutSettingsWindowPosition() {
        const header = this.windowPool.get('header');
        const shortcutSettings = this.windowPool.get('shortcut-settings');
        if (!header || !shortcutSettings) return null;

        const headerBounds = header.getBounds();
        const shortcutDimensions = this.getWindowDimensions('shortcut-settings');

        let newX = Math.round(headerBounds.x + headerBounds.width / 2 - shortcutDimensions.width / 2);
        let newY = Math.round(headerBounds.y);

        return { 
            x: newX, 
            y: newY, 
            width: shortcutDimensions.width, 
            height: shortcutDimensions.height 
        };
    }

    calculateStepMovePosition(header, direction) {
        if (!header || header.isDestroyed()) return null;
        const currentBounds = header.getBounds();
        const stepSize = 80;
        let targetX = currentBounds.x;
        let targetY = currentBounds.y;

        switch (direction) {
            case 'left':
                targetX -= stepSize;
                break;
            case 'right':
                targetX += stepSize;
                break;
            case 'up':
                targetY -= stepSize;
                break;
            case 'down':
                targetY += stepSize;
                break;
        }

        return { x: targetX, y: targetY };
    }

    calculateNewPositionForDisplay(window, targetDisplayId) {
        if (!window || window.isDestroyed()) return null;

        const targetDisplay = screen.getAllDisplays().find(d => d.id === targetDisplayId);
        if (!targetDisplay) return null;

        const currentBounds = window.getBounds();
        const currentDisplay = getCurrentDisplay(window);

        if (currentDisplay.id === targetDisplay.id) return { x: currentBounds.x, y: currentBounds.y };

        const relativeX = (currentBounds.x - currentDisplay.workArea.x) / currentDisplay.workArea.width;
        const relativeY = (currentBounds.y - currentDisplay.workArea.y) / currentDisplay.workArea.height;

        const targetX = targetDisplay.workArea.x + targetDisplay.workArea.width * relativeX;
        const targetY = targetDisplay.workArea.y + targetDisplay.workArea.height * relativeY;

        return { x: Math.round(targetX), y: Math.round(targetY) };
    }

    calculateEdgePosition(header, direction) {
        if (!header || header.isDestroyed()) return null;
        const currentBounds = header.getBounds();
        const display = getCurrentDisplay(header);
        const { x: workAreaX, width: workAreaWidth } = display.workArea;

        let targetX = currentBounds.x;

        switch (direction) {
            case 'left':
                targetX = workAreaX + 20;
                break;
            case 'right':
                targetX = workAreaX + workAreaWidth - currentBounds.width - 20;
                break;
        }

        return { x: targetX, y: currentBounds.y };
    }

    calculateWindowHeightAdjustment(window, targetHeight) {
        if (!window || window.isDestroyed()) return null;
        const currentBounds = window.getBounds();
        return {
            x: currentBounds.x,
            y: currentBounds.y,
            width: currentBounds.width,
            height: targetHeight
        };
    }

    determineLayoutStrategy(headerBounds, screenWidth, screenHeight, relativeX, relativeY, workAreaX, workAreaY) {
        const spaceAbove = headerBounds.y - workAreaY;
        const spaceBelow = screenHeight - (headerBounds.y - workAreaY + headerBounds.height);

        return {
            primary: spaceAbove > spaceBelow ? 'above' : 'below'
        };
    }
}

module.exports = WindowLayoutManager;