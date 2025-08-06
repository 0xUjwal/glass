# Test Plan for Ctrl+S Clear Ask Chat Shortcut

## Changes Made:

1. **Added `clearAskChat` to default keybinds** in `shortcutsService.js`
   - Mac: `Cmd+Shift+D`
   - Windows: `Ctrl+Shift+D`

2. **Added shortcut registration** in `shortcutsService.js`
   - Sends `clear-ask-chat` IPC message to ask window
   - Only triggers when ask window is visible and not destroyed

3. **Added IPC event handlers** in `preload.js`
   - `onClearAskChat` and `removeOnClearAskChat` methods

4. **Connected event listener** in `AskView.js`
   - Calls `clearResponseContent()` when `clear-ask-chat` event received
   - Added proper cleanup in `disconnectedCallback`

5. **Enhanced `clearResponseContent()`** in `AskView.js`
   - Added `this.requestUpdate()` to ensure UI updates
   - Clears all response data and resets state

6. **Updated settings configuration**
   - Added `clearAskChat: 'Clear Ask Chat'` to display name map
   - Added to both Mac and Windows default keybinds in `settingsService.js`

7. **Removed Ctrl+S/Cmd+S from blocked shortcuts**
   - Removed from `commonSystemShortcuts` set to allow custom usage

## Testing Steps:

1. **Basic Functionality:**
   - Open the Glass app
   - Open Ask window with some content
   - Press `Ctrl+Shift+D` (or `Cmd+Shift+D` on Mac)
   - Verify that the response content clears
   - Verify that the question text clears
   - Verify that the input field becomes visible

2. **Focus Behavior:**
   - Have another application in focus
   - Open Glass Ask window (it should be visible but not focused)
   - Press `Ctrl+Shift+D`
   - Verify that the content clears
   - Verify that focus remains on the original application

3. **Edge Cases:**
   - Try shortcut when Ask window is not visible (should do nothing)
   - Try shortcut when no content is present (should not cause errors)
   - Try shortcut while loading/streaming (should clear and stop)

4. **Settings Integration:**
   - Open shortcut settings
   - Verify "Clear Ask Chat" appears in the list
   - Verify it shows `Ctrl+Shift+D` as default
   - Try changing the shortcut to something else
   - Verify new shortcut works and old one doesn't

## Expected Behavior:

- ✅ Pressing `Ctrl+Shift+D` clears the Ask chat content
- ✅ Focus remains on the currently active application
- ✅ No errors or console warnings
- ✅ UI updates properly after clearing
- ✅ Shortcut can be customized in settings
- ✅ Works consistently across different states
