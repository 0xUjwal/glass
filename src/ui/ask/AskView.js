import { html, css, LitElement } from '../../ui/assets/lit-core-2.7.4.min.js';
import { parser, parser_write, parser_end, default_renderer } from '../../ui/assets/smd.js';

export class AskView extends LitElement {
    static properties = {
        currentResponse: { type: String },
        currentQuestion: { type: String },
        isLoading: { type: Boolean },
        copyState: { type: String },
        isHovering: { type: Boolean },
        hoveredLineIndex: { type: Number },
        lineCopyState: { type: Object },
        showTextInput: { type: Boolean },
        headerText: { type: String },
        headerAnimating: { type: Boolean },
        isStreaming: { type: Boolean },
        // Response navigation properties
        responses: { type: Array },
        currentResponseIndex: { type: Number },
        // Always-on-top control
        isAlwaysOnTop: { type: Boolean },
    };

    static styles = css`
        :host {
            display: block;
            width: 100%;
            height: 100%;
            color: white;
            transform: translate3d(0, 0, 0);
            backface-visibility: hidden;
            transition: transform 0.2s cubic-bezier(0.23, 1, 0.32, 1), opacity 0.2s ease-out;
            will-change: transform, opacity;
        }

        :host(.hiding) {
            animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.6, 1) forwards;
        }

        :host(.showing) {
            animation: slideDown 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        :host(.hidden) {
            opacity: 0;
            transform: translateY(-150%) scale(0.85);
            pointer-events: none;
        }

        @keyframes slideUp {
            0% {
                opacity: 1;
                transform: translateY(0) scale(1);
                filter: blur(0px);
            }
            30% {
                opacity: 0.7;
                transform: translateY(-20%) scale(0.98);
                filter: blur(0.5px);
            }
            70% {
                opacity: 0.3;
                transform: translateY(-80%) scale(0.92);
                filter: blur(1.5px);
            }
            100% {
                opacity: 0;
                transform: translateY(-150%) scale(0.85);
                filter: blur(2px);
            }
        }

        @keyframes slideDown {
            0% {
                opacity: 0;
                transform: translateY(-150%) scale(0.85);
                filter: blur(2px);
            }
            30% {
                opacity: 0.5;
                transform: translateY(-50%) scale(0.92);
                filter: blur(1px);
            }
            65% {
                opacity: 0.9;
                transform: translateY(-5%) scale(0.99);
                filter: blur(0.2px);
            }
            85% {
                opacity: 0.98;
                transform: translateY(2%) scale(1.005);
                filter: blur(0px);
            }
            100% {
                opacity: 1;
                transform: translateY(0) scale(1);
                filter: blur(0px);
            }
        }

        * {
            font-family: 'Helvetica Neue', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            cursor: default;
            user-select: none;
        }

        /* Allow text selection in assistant responses */
        .response-container, .response-container * {
            user-select: text !important;
            cursor: text !important;
        }

        .response-container pre {
            background: rgba(22, 27, 34, 0.8) !important;
            border: 3px solid #7c897fff !important; /* Pink border for testing */
            border-radius: 8px !important;
            padding: 1rem !important;
            margin: 8px 0 !important;
            overflow-x: auto !important;
            white-space: pre-wrap !important;
            word-break: break-all !important;
            position: relative !important;
        }

        /* Code block copy button */
        .code-copy-button {
            position: absolute;
            top: 8px;
            right: 8px;
            background: rgba(255, 255, 255, 0.15) !important;
            border: 1px solid rgba(255, 255, 255, 0.3) !important;
            border-radius: 4px;
            padding: 6px 8px;
            cursor: pointer;
            opacity: 1 !important; /* Always visible for testing */
            transition: all 0.2s ease;
            display: flex !important;
            align-items: center;
            gap: 4px;
            font-size: 11px;
            color: rgba(255, 255, 255, 0.9) !important;
            z-index: 100 !important;
            min-width: 60px;
            justify-content: center;
            font-family: 'Helvetica Neue', sans-serif;
        }

        .response-container pre:hover .code-copy-button {
            opacity: 1;
        }

        .code-copy-button:hover {
            background: rgba(255, 255, 255, 0.25) !important;
            border-color: rgba(255, 255, 255, 0.5) !important;
            color: rgba(255, 255, 255, 1) !important;
            transform: translateY(-1px);
        }

        .code-copy-button.copied {
            background: rgba(40, 167, 69, 0.4) !important;
            border-color: rgba(40, 167, 69, 0.6) !important;
            color: #fff !important;
        }

        .code-copy-button svg {
            width: 12px;
            height: 12px;
            stroke: currentColor;
            transition: opacity 0.2s ease-in-out, transform 0.2s ease-in-out;
        }

        .code-copy-button .check-icon {
            opacity: 0;
            transform: scale(0.5);
        }

        .code-copy-button.copied .copy-icon {
            opacity: 0;
            transform: scale(0.5);
        }

        .code-copy-button.copied .check-icon {
            opacity: 1;
            transform: scale(1);
        }

        .response-container code {
            font-family: 'Monaco', 'Menlo', 'Consolas', 'Courier New', monospace !important;
            font-size: 13px !important;
            background: transparent !important;
            white-space: pre-wrap !important;
            word-break: break-all !important;
            line-height: 1.5 !important;
        }

        .response-container pre code {
            white-space: pre-wrap !important;
            word-break: break-all !important;
            display: block !important;
            color: #f8f8f2 !important; /* Default Dracula text color */
        }

        .response-container p code {
            background: rgba(255, 255, 255, 0.1) !important;
            padding: 2px 4px !important;
            border-radius: 3px !important;
            color: #ffd700 !important;
        }

        /* Dracula theme inspired syntax highlighting - TEST VERSION */
        .hljs-keyword {
            color: #ff0000 !important; /* Bright red for testing */
            background: yellow !important; /* Yellow background for testing */
            font-weight: bold !important;
        }
        .hljs-string {
            color: #f1fa8c !important; /* Yellow for strings */
        }
        .hljs-comment {
            color: #6272a4 !important; /* Blue-gray for comments */
            font-style: italic !important;
        }
        .hljs-number {
            color: #bd93f9 !important; /* Purple for numbers */
        }
        .hljs-function {
            color: #50fa7b !important; /* Green for functions */
        }
        .hljs-variable {
            color: #8be9fd !important; /* Cyan for variables */
        }
        .hljs-built_in {
            color: #ffb86c !important; /* Orange for built-ins */
        }
        .hljs-title {
            color: #50fa7b !important; /* Green for titles */
            font-weight: 600 !important;
        }
        .hljs-attr {
            color: #50fa7b !important; /* Green for attributes */
        }
        .hljs-tag {
            color: #ff79c6 !important; /* Pink for tags */
        }
        .hljs-type {
            color: #8be9fd !important; /* Cyan for types */
        }
        .hljs-literal {
            color: #bd93f9 !important; /* Purple for literals */
        }
        .hljs-operator {
            color: #ff79c6 !important; /* Pink for operators */
        }
        .hljs-punctuation {
            color: #f8f8f2 !important; /* Default text for punctuation */
        }
        .hljs-meta {
            color: #6272a4 !important; /* Blue-gray for meta */
        }
        .hljs-params {
            color: #ffb86c !important; /* Orange for parameters */
        }
        .hljs-class {
            color: #8be9fd !important; /* Cyan for classes */
        }

        /* Line numbers styling */
        .code-block-with-lines {
            position: relative;
            counter-reset: line-counter;
        }

        .code-line {
            counter-increment: line-counter;
            position: relative;
            padding-left: 3.5em;
            min-height: 1.5em;
            line-height: 1.5;
        }

        .code-line::before {
            content: counter(line-counter);
            position: absolute;
            left: 0;
            width: 3em;
            text-align: right;
            color: rgba(248, 248, 242, 0.3);
            font-size: 12px;
            user-select: none;
            border-right: 1px solid rgba(255, 255, 255, 0.1);
            padding-right: 0.5em;
            margin-right: 0.5em;
        }

        .ask-container {
            display: flex;
            flex-direction: column;
            height: 100%;
            width: 100%;
            background: rgba(0, 0, 0, 0.6);
            border-radius: 12px;
            outline: 0.5px rgba(255, 255, 255, 0.3) solid;
            outline-offset: -1px;
            backdrop-filter: blur(1px);
            box-sizing: border-box;
            position: relative;
            overflow: hidden;
        }

        .ask-container::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.15);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            border-radius: 12px;
            filter: blur(10px);
            z-index: -1;
        }

        .response-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
            background: transparent;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            flex-shrink: 0;
        }

        .response-header.hidden {
            display: none;
        }

        .header-left {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-shrink: 0;
        }

        .response-icon {
            width: 20px;
            height: 20px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        }

        .response-icon svg {
            width: 12px;
            height: 12px;
            stroke: rgba(255, 255, 255, 0.9);
        }

        .response-label {
            font-size: 13px;
            font-weight: 500;
            color: rgba(255, 255, 255, 0.9);
            white-space: nowrap;
            position: relative;
            overflow: hidden;
        }

        .response-label.animating {
            animation: fadeInOut 0.3s ease-in-out;
        }

        @keyframes fadeInOut {
            0% {
                opacity: 1;
                transform: translateY(0);
            }
            50% {
                opacity: 0;
                transform: translateY(-10px);
            }
            100% {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .header-right {
            display: flex;
            align-items: center;
            gap: 8px;
            flex: 1;
            justify-content: flex-end;
        }

        .question-text {
            font-size: 13px;
            color: rgba(255, 255, 255, 0.7);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 300px;
            margin-right: 8px;
        }

        .header-controls {
            display: flex;
            gap: 8px;
            align-items: center;
            flex-shrink: 0;
        }

        .copy-button {
            background: transparent;
            color: rgba(255, 255, 255, 0.9);
            border: 1px solid rgba(255, 255, 255, 0.2);
            padding: 4px;
            border-radius: 3px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            min-width: 24px;
            height: 24px;
            flex-shrink: 0;
            transition: background-color 0.15s ease;
            position: relative;
            overflow: hidden;
        }

        .copy-button:hover {
            background: rgba(255, 255, 255, 0.15);
        }

        .copy-button svg {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            transition: opacity 0.2s ease-in-out, transform 0.2s ease-in-out;
        }

        .copy-button .check-icon {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.5);
        }

        .copy-button.copied .copy-icon {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.5);
        }

        .copy-button.copied .check-icon {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
        }

        .always-on-top-button {
            background: rgba(255, 255, 255, 0.07);
            color: rgba(255, 255, 255, 0.8);
            border: none;
            padding: 4px;
            border-radius: 20px;
            outline: 1px rgba(255, 255, 255, 0.3) solid;
            outline-offset: -1px;
            backdrop-filter: blur(0.5px);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 20px;
            height: 20px;
            transition: all 0.2s ease;
        }

        .always-on-top-button:hover {
            background: rgba(255, 255, 255, 0.12);
            color: rgba(255, 255, 255, 1);
            transform: translateY(-1px);
        }

        .always-on-top-button.active {
            background: rgba(59, 130, 246, 0.6);
            color: white;
            outline-color: rgba(59, 130, 246, 0.8);
            box-shadow: 0 0 8px rgba(59, 130, 246, 0.3);
        }

        .always-on-top-button.active:hover {
            background: rgba(59, 130, 246, 0.8);
            box-shadow: 0 0 12px rgba(59, 130, 246, 0.4);
        }

        .close-button {
            background: rgba(255, 255, 255, 0.07);
            color: white;
            border: none;
            padding: 4px;
            border-radius: 20px;
            outline: 1px rgba(255, 255, 255, 0.3) solid;
            outline-offset: -1px;
            backdrop-filter: blur(0.5px);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 20px;
            height: 20px;
        }

        .close-button:hover {
            background: rgba(255, 255, 255, 0.1);
            color: rgba(255, 255, 255, 1);
        }

        .response-container {
            flex: 1;
            padding: 16px;
            padding-left: 48px;
            overflow-y: auto;
            font-size: 14px;
            line-height: 1.6;
            background: transparent;
            min-height: 0;
            max-height: 400px;
            position: relative;
        }

        .response-container.hidden {
            display: none;
        }

        .response-container::-webkit-scrollbar {
            width: 6px;
        }

        .response-container::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 3px;
        }

        .response-container::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.2);
            border-radius: 3px;
        }

        .response-container::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.3);
        }

        .loading-dots {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 40px;
        }

        .loading-dot {
            width: 8px;
            height: 8px;
            background: rgba(255, 255, 255, 0.6);
            border-radius: 50%;
            animation: pulse 1.5s ease-in-out infinite;
        }

        .loading-dot:nth-child(1) {
            animation-delay: 0s;
        }

        .loading-dot:nth-child(2) {
            animation-delay: 0.2s;
        }

        .loading-dot:nth-child(3) {
            animation-delay: 0.4s;
        }

        @keyframes pulse {
            0%,
            80%,
            100% {
                opacity: 0.3;
                transform: scale(0.8);
            }
            40% {
                opacity: 1;
                transform: scale(1.2);
            }
        }

        .response-line {
            position: relative;
            padding: 2px 0;
            margin: 0;
            transition: background-color 0.15s ease;
        }

        .response-line:hover {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 4px;
        }

        .line-copy-button {
            position: absolute;
            left: -32px;
            top: 50%;
            transform: translateY(-50%);
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 3px;
            padding: 2px;
            cursor: pointer;
            opacity: 0;
            transition: opacity 0.15s ease, background-color 0.15s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 20px;
            height: 20px;
        }

        .response-line:hover .line-copy-button {
            opacity: 1;
        }

        .line-copy-button:hover {
            background: rgba(255, 255, 255, 0.2);
        }

        .line-copy-button.copied {
            background: rgba(40, 167, 69, 0.3);
            color: #fff;
        }

        .line-copy-button svg {
            width: 12px;
            height: 12px;
            stroke: rgba(255, 255, 255, 0.9);
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            transition: opacity 0.2s ease-in-out, transform 0.2s ease-in-out;
        }

        .line-copy-button .check-icon {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.5);
        }

        .line-copy-button.copied .copy-icon {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.5);
        }

        .line-copy-button.copied .check-icon {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
        }

        .text-input-container {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 12px 16px;
            background: rgba(0, 0, 0, 0.1);
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            flex-shrink: 0;
            transition: opacity 0.1s ease-in-out, transform 0.1s ease-in-out;
            transform-origin: bottom;
        }

        .text-input-container.hidden {
            opacity: 0;
            transform: scaleY(0);
            padding: 0;
            height: 0;
            overflow: hidden;
            border-top: none;
        }

        .text-input-container.no-response {
            border-top: none;
        }

        #textInput {
            flex: 1;
            padding: 10px 14px;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 20px;
            outline: none;
            border: none;
            color: white;
            font-size: 14px;
            font-family: 'Helvetica Neue', sans-serif;
            font-weight: 400;
        }

        #textInput::placeholder {
            color: rgba(255, 255, 255, 0.5);
        }

        #textInput:focus {
            outline: none;
        }

        .response-line h1,
        .response-line h2,
        .response-line h3,
        .response-line h4,
        .response-line h5,
        .response-line h6 {
            color: rgba(255, 255, 255, 0.95);
            margin: 16px 0 8px 0;
            font-weight: 600;
        }

        .response-line p {
            margin: 8px 0;
            color: rgba(255, 255, 255, 0.9);
        }

        .response-line ul,
        .response-line ol {
            margin: 8px 0;
            padding-left: 20px;
        }

        .response-line li {
            margin: 4px 0;
            color: rgba(255, 255, 255, 0.9);
        }

        .response-line code {
            background: rgba(255, 255, 255, 0.1);
            color: rgba(255, 255, 255, 0.95);
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'Monaco', 'Menlo', monospace;
            font-size: 13px;
        }

        .response-line pre {
            background: rgba(255, 255, 255, 0.05);
            color: rgba(255, 255, 255, 0.95);
            padding: 12px;
            border-radius: 6px;
            overflow-x: auto;
            margin: 12px 0;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .response-line pre code {
            background: none;
            padding: 0;
        }

        .response-line blockquote {
            border-left: 3px solid rgba(255, 255, 255, 0.3);
            margin: 12px 0;
            padding: 8px 16px;
            background: rgba(255, 255, 255, 0.05);
            color: rgba(255, 255, 255, 0.8);
        }

        .empty-state {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: rgba(255, 255, 255, 0.5);
            font-size: 14px;
        }

        .btn-gap {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
            gap: 4px;
        }

        /* ────────────────[ GLASS BYPASS ]─────────────── */
        :host-context(body.has-glass) .ask-container,
        :host-context(body.has-glass) .response-header,
        :host-context(body.has-glass) .response-icon,
        :host-context(body.has-glass) .copy-button,
        :host-context(body.has-glass) .close-button,
        :host-context(body.has-glass) .line-copy-button,
        :host-context(body.has-glass) .text-input-container,
        :host-context(body.has-glass) .response-container pre,
        :host-context(body.has-glass) .response-container p code,
        :host-context(body.has-glass) .response-container pre code {
            background: transparent !important;
            border: none !important;
            outline: none !important;
            box-shadow: none !important;
            filter: none !important;
            backdrop-filter: none !important;
        }

        :host-context(body.has-glass) .ask-container::before {
            display: none !important;
        }

        :host-context(body.has-glass) .copy-button:hover,
        :host-context(body.has-glass) .close-button:hover,
        :host-context(body.has-glass) .line-copy-button,
        :host-context(body.has-glass) .line-copy-button:hover,
        :host-context(body.has-glass) .response-line:hover {
            background: transparent !important;
        }

        :host-context(body.has-glass) .response-container::-webkit-scrollbar-track,
        :host-context(body.has-glass) .response-container::-webkit-scrollbar-thumb {
            background: transparent !important;
        }

        .submit-btn, .clear-btn {
            display: flex;
            align-items: center;
            background: transparent;
            color: white;
            border: none;
            border-radius: 6px;
            margin-left: 8px;
            font-size: 13px;
            font-family: 'Helvetica Neue', sans-serif;
            font-weight: 500;
            overflow: hidden;
            cursor: pointer;
            transition: background 0.15s;
            height: 32px;
            padding: 0 10px;
            box-shadow: none;
        }
        .submit-btn:hover, .clear-btn:hover {
            background: rgba(255,255,255,0.1);
        }
        .btn-label {
            margin-right: 8px;
            display: flex;
            align-items: center;
            height: 100%;
        }
        .btn-icon {
            background: rgba(255,255,255,0.1);
            border-radius: 13%;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 18px;
            height: 18px;
        }
        .btn-icon img, .btn-icon svg {
            width: 13px;
            height: 13px;
            display: block;
        }
        .header-clear-btn {
            background: transparent;
            border: none;
            display: flex;
            align-items: center;
            gap: 2px;
            cursor: pointer;
            padding: 0 2px;
        }
        .header-clear-btn .icon-box {
            color: white;
            font-size: 12px;
            font-family: 'Helvetica Neue', sans-serif;
            font-weight: 500;
            background-color: rgba(255, 255, 255, 0.1);
            border-radius: 13%;
            width: 18px;
            height: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .header-clear-btn:hover .icon-box {
            background-color: rgba(255,255,255,0.18);
        }

        .ai-response-container {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 8px 16px;
            background: rgba(0, 0, 0, 0.1);
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            flex-shrink: 0;
        }

        .nav-btn {
            background: rgba(255, 255, 255, 0.1);
            color: white;
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 3px;
            padding: 6px 8px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            min-width: 30px;
            height: 30px;
            transition: all 0.15s ease;
            font-size: 16px;
            font-weight: bold;
        }

        .nav-btn:hover:not(:disabled) {
            background: rgba(255, 255, 255, 0.2);
            border-color: rgba(255, 255, 255, 0.4);
        }

        .nav-btn:disabled {
            opacity: 0.4;
            cursor: not-allowed;
            background: rgba(255, 255, 255, 0.05);
        }

        .response-counter {
            font-size: 12px;
            color: rgba(255, 255, 255, 0.7);
            font-weight: 500;
            min-width: 60px;
            text-align: center;
        }

        .ai-response-text {
            flex: 1;
            color: rgba(255, 255, 255, 0.9);
            font-size: 13px;
            line-height: 1.4;
            margin: 0 12px;
            overflow-wrap: break-word;
            text-align: center;
        }
    `;

    constructor() {
        super();
        this.currentResponse = '';
        this.currentQuestion = '';
        this.isLoading = false;
        this.copyState = 'idle';
        this.showTextInput = true;
        this.headerText = 'AI Response';
        this.headerAnimating = false;
        this.isStreaming = false;
        this.lineCopyState = {}; // For managing per-line copy states
        this.lineCopyTimeouts = {}; // For managing per-line copy timeouts

        // Response navigation properties
        this.responses = [];
        this.currentResponseIndex = -1;
        this.isNavigatingHistory = false; // Flag to prevent state updates during navigation
        
        // Separate state for live vs navigated content
        this.liveResponse = '';
        this.liveQuestion = '';
        this.displayResponse = '';
        this.displayQuestion = '';

        // Always on top state
        this.isAlwaysOnTop = false;

        this.marked = null;
        this.hljs = null;
        this.DOMPurify = null;
        this.isLibrariesLoaded = false;

        // SMD.js streaming markdown parser
        this.smdParser = null;
        this.smdContainer = null;
        this.lastProcessedLength = 0;

        this.handleSendText = this.handleSendText.bind(this);
        this.handleTextKeydown = this.handleTextKeydown.bind(this);
        this.handleCopy = this.handleCopy.bind(this);
        this.clearResponseContent = this.clearResponseContent.bind(this);
        this.handleEscKey = this.handleEscKey.bind(this);
        this.handleScroll = this.handleScroll.bind(this);
        this.handleCloseAskWindow = this.handleCloseAskWindow.bind(this);
        this.handleCloseIfNoContent = this.handleCloseIfNoContent.bind(this);

        this.loadLibraries();

        // --- Resize helpers ---
        this.isThrottled = false;
    }

    connectedCallback() {
        super.connectedCallback();

        console.log('📱 AskView connectedCallback - IPC 이벤트 리스너 설정');

        document.addEventListener('keydown', this.handleEscKey);

        this.resizeObserver = new ResizeObserver(entries => {
            for (const entry of entries) {
                const needed = entry.contentRect.height;
                const current = window.innerHeight;

                if (needed > current - 4) {
                    this.requestWindowResize(Math.ceil(needed));
                }
            }
        });

        const container = this.shadowRoot?.querySelector('.ask-container');
        if (container) this.resizeObserver.observe(container);

        this.handleQuestionFromAssistant = (event, question) => {
            console.log('AskView: Received question from ListenView:', question);
            this.handleSendText(null, question);
        };

        if (window.api) {
            window.api.askView.onShowTextInput(() => {
                console.log('Show text input signal received');
                if (!this.showTextInput) {
                    this.showTextInput = true;
                    this.updateComplete.then(() => this.focusTextInput());
                  } else {
                    this.focusTextInput();
                  }
            });

            window.api.askView.onScrollResponseUp(() => this.handleScroll('up'));
            window.api.askView.onScrollResponseDown(() => this.handleScroll('down'));
            window.api.askView.onClearAskChat(() => this.clearResponseContent());
            window.api.askView.onAskStateUpdate((event, newState) => {
                const prevLoading = this.isLoading;
                const prevStreaming = this.isStreaming;

                // Always update live state
                this.liveResponse = newState.currentResponse;
                this.liveQuestion = newState.currentQuestion;
                
                // Update display state only if not navigating
                if (!this.isNavigatingHistory) {
                    this.currentResponse = newState.currentResponse;
                    this.currentQuestion = newState.currentQuestion;
                    this.displayResponse = newState.currentResponse;
                    this.displayQuestion = newState.currentQuestion;
                } else {
                    console.log('[AskView Navigation] Skipping display update due to history navigation');
                }
                
                this.isLoading       = newState.isLoading;
                this.isStreaming     = newState.isStreaming;
              
                const wasHidden = !this.showTextInput;
                this.showTextInput = newState.showTextInput;
              
                // When streaming ends and we have a completed response, add it to history
                const wasActive = prevLoading || prevStreaming;
                const nowIdle = !this.isStreaming && !this.isLoading;
                if (wasActive && nowIdle && this.liveResponse && this.liveResponse.length > 0) {
                    console.log('[AskView Navigation] Response completed, adding to history');
                    // Clear navigation flag to allow new response to be displayed
                    this.isNavigatingHistory = false;
                    this.onResponseCompleted(this.liveResponse, this.liveQuestion);
                }

                if (newState.showTextInput) {
                  if (wasHidden) {
                    this.updateComplete.then(() => this.focusTextInput());
                  } else {
                    this.focusTextInput();
                  }
                }
              });

            // Navigation event listeners for shortcuts and buttons
            this._onNavigatePreviousResponse = () => this.navigatePreviousResponse();
            this._onNavigateNextResponse = () => this.navigateNextResponse();
            window.api.askView.onNavigatePreviousResponse(this._onNavigatePreviousResponse);
            window.api.askView.onNavigateNextResponse(this._onNavigateNextResponse);

            console.log('AskView: IPC 이벤트 리스너 등록 완료');
            
            // Load always on top state
            this.loadAlwaysOnTopState();
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.resizeObserver?.disconnect();

        console.log('📱 AskView disconnectedCallback - IPC 이벤트 리스너 제거');

        document.removeEventListener('keydown', this.handleEscKey);

        if (this.copyTimeout) {
            clearTimeout(this.copyTimeout);
        }

        if (this.headerAnimationTimeout) {
            clearTimeout(this.headerAnimationTimeout);
        }

        if (this.streamingTimeout) {
            clearTimeout(this.streamingTimeout);
        }

        Object.values(this.lineCopyTimeouts).forEach(timeout => clearTimeout(timeout));

        if (window.api) {
            window.api.askView.removeOnAskStateUpdate(this.handleAskStateUpdate);
            window.api.askView.removeOnShowTextInput(this.handleShowTextInput);
            window.api.askView.removeOnScrollResponseUp(this.handleScroll);
            window.api.askView.removeOnScrollResponseDown(this.handleScroll);
            window.api.askView.removeOnClearAskChat(this.clearResponseContent);
            if (this._onNavigatePreviousResponse) {
                window.api.askView.removeOnNavigatePreviousResponse(this._onNavigatePreviousResponse);
            }
            if (this._onNavigateNextResponse) {
                window.api.askView.removeOnNavigateNextResponse(this._onNavigateNextResponse);
            }
            console.log('✅ AskView: IPC 이벤트 리스너 제거 필요');
        }
    }

    async loadLibraries() {
        try {
            if (!window.marked) {
                await this.loadScript('../../assets/marked-4.3.0.min.js');
            }

            if (!window.hljs) {
                await this.loadScript('../../assets/highlight-11.9.0.min.js');
            }

            if (!window.DOMPurify) {
                await this.loadScript('../../assets/dompurify-3.0.7.min.js');
            }

            this.marked = window.marked;
            this.hljs = window.hljs;
            this.DOMPurify = window.DOMPurify;

            if (this.marked && this.hljs) {
                this.marked.setOptions({
                    highlight: (code, lang) => {
                        if (lang && this.hljs.getLanguage(lang)) {
                            try {
                                return this.hljs.highlight(code, { language: lang }).value;
                            } catch (err) {
                                console.warn('Highlight error:', err);
                            }
                        }
                        try {
                            return this.hljs.highlightAuto(code).value;
                        } catch (err) {
                            console.warn('Auto highlight error:', err);
                        }
                        return code;
                    },
                    breaks: true,
                    gfm: true,
                    pedantic: false,
                    smartypants: false,
                    xhtml: false,
                });

                this.isLibrariesLoaded = true;
                this.renderContent();
                console.log('Markdown libraries loaded successfully in AskView');
            }

            if (this.DOMPurify) {
                this.isDOMPurifyLoaded = true;
                console.log('DOMPurify loaded successfully in AskView');
            }
        } catch (error) {
            console.error('Failed to load libraries in AskView:', error);
        }
    }

    handleCloseAskWindow() {
        // this.clearResponseContent();
        window.api.askView.closeAskWindow();
    }

    handleCloseIfNoContent() {
        if (!this.currentResponse && !this.isLoading && !this.isStreaming) {
            this.handleCloseAskWindow();
        }
    }

    // Always on top functionality
    async loadAlwaysOnTopState() {
        try {
            if (window.api && window.api.askView.isAlwaysOnTop) {
                this.isAlwaysOnTop = await window.api.askView.isAlwaysOnTop();
                this.requestUpdate();
            }
        } catch (error) {
            console.error('Failed to load always on top state:', error);
            this.isAlwaysOnTop = false;
        }
    }

    async toggleAlwaysOnTop() {
        try {
            if (window.api && window.api.askView.toggleAlwaysOnTop) {
                const newState = await window.api.askView.toggleAlwaysOnTop();
                this.isAlwaysOnTop = newState;
                this.requestUpdate();
                console.log(`Always on top toggled: ${newState}`);
            }
        } catch (error) {
            console.error('Failed to toggle always on top:', error);
        }
    }

    handleEscKey(e) {
        if (e.key === 'Escape') {
            e.preventDefault();
            this.handleCloseIfNoContent();
        }
    }

    clearResponseContent() {
        this.currentResponse = '';
        this.currentQuestion = '';
        this.liveResponse = '';
        this.liveQuestion = '';
        this.displayResponse = '';
        this.displayQuestion = '';
        this.isLoading = false;
        this.isStreaming = false;
        this.headerText = 'AI Response';
        this.showTextInput = true;
        this.lastProcessedLength = 0;
        this.smdParser = null;
        this.smdContainer = null;
        this.lineCopyState = {}; // Reset line copy states
        this.isNavigatingHistory = false; // Clear navigation flag
        // Clear all line copy timeouts
        Object.values(this.lineCopyTimeouts).forEach(timeout => clearTimeout(timeout));
        this.lineCopyTimeouts = {};
        
        // Clear response history
        this.responses = [];
        this.currentResponseIndex = -1;
        
        this.requestUpdate();
    }

    handleInputFocus() {
        this.isInputFocused = true;
    }

    focusTextInput() {
        requestAnimationFrame(() => {
            const textInput = this.shadowRoot?.getElementById('textInput');
            if (textInput) {
                textInput.focus();
            }
        });
    }

    loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    parseMarkdown(text) {
        if (!text) return '';

        if (!this.isLibrariesLoaded || !this.marked) {
            return text;
        }

        try {
            return this.marked(text);
        } catch (error) {
            console.error('Markdown parsing error in AskView:', error);
            return text;
        }
    }

    fixIncompleteCodeBlocks(text) {
        if (!text) return text;

        const codeBlockMarkers = text.match(/```/g) || [];
        const markerCount = codeBlockMarkers.length;

        if (markerCount % 2 === 1) {
            return text + '\n```';
        }

        return text;
    }

    handleScroll(direction) {
        const scrollableElement = this.shadowRoot.querySelector('#responseContainer');
        if (scrollableElement) {
            const scrollAmount = 100; // 한 번에 스크롤할 양 (px)
            if (direction === 'up') {
                scrollableElement.scrollTop -= scrollAmount;
            } else {
                scrollableElement.scrollTop += scrollAmount;
            }
        }
    }

    /**
     * Renders the response content as lines, each with a per-line copy button.
     * Call this instead of renderStreamingMarkdown in renderContent().
     */
    renderResponseWithLineCopy(responseContainer) {
        if (!this.currentResponse) {
            responseContainer.innerHTML = `<div class="empty-state">...</div>`;
            return;
        }
        
        // Split response into lines
        const lines = this.currentResponse.split('\n');
        responseContainer.innerHTML = lines.map((line, idx) => `
            <div class="response-line" style="position:relative;">
                <button class="line-copy-button${this.lineCopyState && this.lineCopyState[idx] ? ' copied' : ''}" 
                    data-idx="${idx}" 
                    title="Copy line"
                    tabindex="-1"
                    style="left: -32px; top: 50%; transform: translateY(-50%); position: absolute;">
                    <svg class="copy-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                    </svg>
                    <svg class="check-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <path d="M20 6L9 17l-5-5" />
                    </svg>
                </button>
                <span>${this.renderMarkdown(line || '&nbsp;')}</span>
            </div>
        `).join('');
        
        // Attach event listeners for all copy buttons
        responseContainer.querySelectorAll('.line-copy-button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.getAttribute('data-idx'), 10);
                this.handleLineCopy(idx);
            });
        });

        // Apply code highlighting if available
        if (this.hljs) {
            responseContainer.querySelectorAll('pre code').forEach(block => {
                if (!block.hasAttribute('data-highlighted')) {
                    // Add line numbers if it's a code block
                    const codeText = block.textContent;
                    const lines = codeText.split('\n');
                    
                    // Only add line numbers for multi-line code blocks
                    if (lines.length > 1) {
                        block.parentElement.classList.add('code-block-with-lines');
                        
                        // Apply syntax highlighting first
                        this.hljs.highlightElement(block);
                        
                        // Then add line numbers by wrapping each line
                        const numberedContent = lines.map((line, index) => 
                            `<span class="code-line">${this.escapeHtml(line || ' ')}</span>`
                        ).join('\n');
                        
                        // Apply the numbered content
                        block.innerHTML = numberedContent;
                    } else {
                        this.hljs.highlightElement(block);
                    }
                    
                    block.setAttribute('data-highlighted', 'true');
                }
            });
            
            // Add copy buttons to code blocks
            this.addCopyButtonsToCodeBlocks(responseContainer);
        }
    }

    renderContent() {
        const responseContainer = this.shadowRoot.getElementById('responseContainer');
        if (!responseContainer) return;

        console.log('[AskView Render] Rendering content, response length:', this.currentResponse.length);
        console.log('[AskView Render] Navigation state:', this.isNavigatingHistory);
        console.log('[AskView Render] Response preview:', this.currentResponse.substring(0, 100) + '...');

        // Check loading state
        if (this.isLoading) {
            responseContainer.innerHTML = `
              <div class="loading-dots">
                <div class="loading-dot"></div>
                <div class="loading-dot"></div>
                <div class="loading-dot"></div>
              </div>`;
            this.resetStreamingParser();
            return;
        }
        
        // If there is no response, show empty state
        if (!this.currentResponse) {
            responseContainer.innerHTML = `<div class="empty-state">...</div>`;
            this.resetStreamingParser();
            return;
        }
        
        // Use streaming markdown rendering for better code highlighting
        this.renderStreamingMarkdown(responseContainer);

        // After updating content, recalculate window height
        this.adjustWindowHeightThrottled();
        
        // Add copy buttons as a fallback (for cases where streaming doesn't trigger it)
        setTimeout(() => {
            console.log('[AskView] Adding copy buttons as fallback');
            this.addCopyButtonsToCodeBlocks(responseContainer);
        }, 100);
    }

    resetStreamingParser() {
        this.smdParser = null;
        this.smdContainer = null;
        this.lastProcessedLength = 0;
    }

    renderStreamingMarkdown(responseContainer) {
        try {
            console.log('[AskView Render] Starting renderStreamingMarkdown');
            console.log('[AskView Render] Current response length:', this.currentResponse.length);
            console.log('[AskView Render] Is navigating:', this.isNavigatingHistory);
            
            // 파서가 없거나 컨테이너가 변경되었으면 새로 생성
            // 또는 네비게이션 중이면 새로 생성 (완전 재렌더링을 위해)
            if (!this.smdParser || this.smdContainer !== responseContainer || this.isNavigatingHistory) {
                console.log('[AskView Render] Creating new parser');
                this.smdContainer = responseContainer;
                this.smdContainer.innerHTML = '';
                
                // smd.js의 default_renderer 사용
                const renderer = default_renderer(this.smdContainer);
                this.smdParser = parser(renderer);
                this.lastProcessedLength = 0;
            }

            // 네비게이션 중이면 전체 텍스트를 처리 (스트리밍 최적화 우회)
            const currentText = this.currentResponse;
            let newText;
            
            if (this.isNavigatingHistory) {
                // 네비게이션 중: 전체 텍스트 처리
                newText = currentText;
                this.lastProcessedLength = 0;
                console.log('[AskView Render] Navigation mode: processing full text');
            } else {
                // 일반 모드: 새로운 텍스트만 처리 (스트리밍 최적화)
                newText = currentText.slice(this.lastProcessedLength);
                console.log('[AskView Render] Streaming mode: processing new text chunk');
            }
            
            console.log('[AskView Render] Processing text chunk, length:', newText.length);
            
            if (newText.length > 0) {
                // 텍스트 청크를 파서에 전달
                parser_write(this.smdParser, newText);
                this.lastProcessedLength = currentText.length;
            }

            // 스트리밍이 완료되면 파서 종료
            if (!this.isStreaming && !this.isLoading) {
                console.log('[AskView Render] Ending parser (not streaming)');
                parser_end(this.smdParser);
            }

            // 코드 하이라이팅 적용
            if (this.hljs) {
                console.log('[AskView] Applying syntax highlighting in streaming...');
                responseContainer.querySelectorAll('pre code').forEach(block => {
                    if (!block.hasAttribute('data-highlighted')) {
                        console.log('[AskView] Found code block in streaming, applying highlighting');
                        // Add line numbers if it's a code block
                        const codeText = block.textContent;
                        const lines = codeText.split('\n');
                        
                        // Only add line numbers for multi-line code blocks
                        if (lines.length > 1) {
                            console.log('[AskView] Adding line numbers for multi-line code block in streaming');
                            block.parentElement.classList.add('code-block-with-lines');
                            const numberedContent = lines.map((line, index) => 
                                `<span class="code-line">${this.escapeHtml(line || ' ')}</span>`
                            ).join('\n');
                            
                            // Apply syntax highlighting first
                            this.hljs.highlightElement(block);
                            
                            // Then add line numbers
                            block.innerHTML = numberedContent;
                        } else {
                            console.log('[AskView] Applying highlighting for single-line code in streaming');
                            this.hljs.highlightElement(block);
                        }
                        
                        block.setAttribute('data-highlighted', 'true');
                    }
                });
                
                // Add copy buttons to code blocks
                this.addCopyButtonsToCodeBlocks(responseContainer);
            } else {
                console.log('[AskView] hljs library not available in streaming');
            }

            // 스크롤을 맨 아래로
            responseContainer.scrollTop = responseContainer.scrollHeight;
            
        } catch (error) {
            console.error('Error rendering streaming markdown:', error);
            // 에러 발생 시 기본 텍스트 렌더링으로 폴백
            this.renderFallbackContent(responseContainer);
        }
    }

    renderFallbackContent(responseContainer) {
        const textToRender = this.currentResponse || '';
        
        if (this.isLibrariesLoaded && this.marked && this.DOMPurify) {
            try {
                // 마크다운 파싱
                const parsedHtml = this.marked.parse(textToRender);

                // DOMPurify로 정제
                const cleanHtml = this.DOMPurify.sanitize(parsedHtml, {
                    ALLOWED_TAGS: [
                        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'strong', 'b', 'em', 'i',
                        'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'a', 'img', 'table', 'thead',
                        'tbody', 'tr', 'th', 'td', 'hr', 'sup', 'sub', 'del', 'ins',
                    ],
                    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'id', 'target', 'rel'],
                });

                responseContainer.innerHTML = cleanHtml;

                // 코드 하이라이팅 적용
                if (this.hljs) {
                    responseContainer.querySelectorAll('pre code').forEach(block => {
                        if (!block.hasAttribute('data-highlighted')) {
                            // Add line numbers if it's a code block
                            const codeText = block.textContent;
                            const lines = codeText.split('\n');
                            
                            // Only add line numbers for multi-line code blocks
                            if (lines.length > 1) {
                                block.parentElement.classList.add('code-block-with-lines');
                                const numberedContent = lines.map((line, index) => 
                                    `<span class="code-line">${this.escapeHtml(line || ' ')}</span>`
                                ).join('\n');
                                
                                // Apply syntax highlighting first
                                this.hljs.highlightElement(block);
                                
                                // Then add line numbers
                                block.innerHTML = numberedContent;
                            } else {
                                this.hljs.highlightElement(block);
                            }
                            
                            block.setAttribute('data-highlighted', 'true');
                        }
                    });
                    
                    // Add copy buttons to code blocks
                    this.addCopyButtonsToCodeBlocks(responseContainer);
                }
            } catch (error) {
                console.error('Error in fallback rendering:', error);
                responseContainer.textContent = textToRender;
            }
        } else {
            // 라이브러리가 로드되지 않았을 때 기본 렌더링
            const basicHtml = textToRender
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/\n\n/g, '</p><p>')
                .replace(/\n/g, '<br>')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/`([^`]+)`/g, '<code>$1</code>');

            responseContainer.innerHTML = `<p>${basicHtml}</p>`;
        }
    }

    requestWindowResize(targetHeight) {
        if (window.api) {
            window.api.askView.adjustWindowHeight(targetHeight);
        }
    }

    animateHeaderText(text) {
        this.headerAnimating = true;
        this.requestUpdate();

        setTimeout(() => {
            this.headerText = text;
            this.headerAnimating = false;
            this.requestUpdate();
        }, 150);
    }

    startHeaderAnimation() {
        this.animateHeaderText('analyzing screen...');

        if (this.headerAnimationTimeout) {
            clearTimeout(this.headerAnimationTimeout);
        }

        this.headerAnimationTimeout = setTimeout(() => {
            this.animateHeaderText('thinking...');
        }, 1500);
    }

    renderMarkdown(content) {
        if (!content) return '';

        if (this.isLibrariesLoaded && this.marked) {
            return this.parseMarkdown(content);
        }

        return content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>');
    }

    fixIncompleteMarkdown(text) {
        if (!text) return text;

        // 불완전한 볼드체 처리
        const boldCount = (text.match(/\*\*/g) || []).length;
        if (boldCount % 2 === 1) {
            text += '**';
        }

        // 불완전한 이탤릭체 처리
        const italicCount = (text.match(/(?<!\*)\*(?!\*)/g) || []).length;
        if (italicCount % 2 === 1) {
            text += '*';
        }

        // 불완전한 인라인 코드 처리
        const inlineCodeCount = (text.match(/`/g) || []).length;
        if (inlineCodeCount % 2 === 1) {
            text += '`';
        }

        // 불완전한 링크 처리
        const openBrackets = (text.match(/\[/g) || []).length;
        const closeBrackets = (text.match(/\]/g) || []).length;
        if (openBrackets > closeBrackets) {
            text += ']';
        }

        const openParens = (text.match(/\]\(/g) || []).length;
        const closeParens = (text.match(/\)\s*$/g) || []).length;
        if (openParens > closeParens && text.endsWith('(')) {
            text += ')';
        }

        return text;
    }

    async handleCopy() {
        if (this.copyState === 'copied') return;

        let responseToCopy = this.currentResponse;

        if (this.isDOMPurifyLoaded && this.DOMPurify) {
            const testHtml = this.renderMarkdown(responseToCopy);
            const sanitized = this.DOMPurify.sanitize(testHtml);

            if (this.DOMPurify.removed && this.DOMPurify.removed.length > 0) {
                console.warn('Unsafe content detected, copy blocked');
                return;
            }
        }

        const textToCopy = `Question: ${this.currentQuestion}\n\nAnswer: ${responseToCopy}`;

        try {
            await navigator.clipboard.writeText(textToCopy);
            console.log('Content copied to clipboard');

            this.copyState = 'copied';
            this.requestUpdate();

            if (this.copyTimeout) {
                clearTimeout(this.copyTimeout);
            }

            this.copyTimeout = setTimeout(() => {
                this.copyState = 'idle';
                this.requestUpdate();
            }, 1500);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    }

    async handleLineCopy(lineIndex) {
        const originalLines = this.currentResponse.split('\n');
        const lineToCopy = originalLines[lineIndex];

        if (!lineToCopy) return;

        try {
            await navigator.clipboard.writeText(lineToCopy);
            console.log('Line copied to clipboard');

            // '복사됨' 상태로 UI 즉시 업데이트
            this.lineCopyState = { ...this.lineCopyState, [lineIndex]: true };
            this.requestUpdate(); // LitElement에 UI 업데이트 요청

            // 기존 타임아웃이 있다면 초기화
            if (this.lineCopyTimeouts && this.lineCopyTimeouts[lineIndex]) {
                clearTimeout(this.lineCopyTimeouts[lineIndex]);
            }

            // ✨ 수정된 타임아웃: 1.5초 후 '복사됨' 상태 해제
            this.lineCopyTimeouts[lineIndex] = setTimeout(() => {
                const updatedState = { ...this.lineCopyState };
                delete updatedState[lineIndex];
                this.lineCopyState = updatedState;
                this.requestUpdate(); // UI 업데이트 요청
            }, 1500);
        } catch (err) {
            console.error('Failed to copy line:', err);
        }
    }

    async handleCodeBlockCopy(codeBlock) {
        const codeText = codeBlock.textContent;
        
        try {
            await navigator.clipboard.writeText(codeText);
            console.log('Code block copied to clipboard');

            // Find the copy button for this code block
            const copyButton = codeBlock.parentElement.querySelector('.code-copy-button');
            if (copyButton) {
                copyButton.classList.add('copied');
                copyButton.innerHTML = `
                    <svg class="check-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M20 6L9 17l-5-5" />
                    </svg>
                    <span>Copied</span>
                `;

                // Reset button after 1.5 seconds
                setTimeout(() => {
                    copyButton.classList.remove('copied');
                    copyButton.innerHTML = `
                        <svg class="copy-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                        </svg>
                        <span>Copy</span>
                    `;
                }, 1500);
            }
        } catch (err) {
            console.error('Failed to copy code block:', err);
        }
    }

    addCopyButtonsToCodeBlocks(container) {
        console.log('[AskView] addCopyButtonsToCodeBlocks called');
        const codeBlocks = container.querySelectorAll('pre code');
        console.log('[AskView] Found', codeBlocks.length, 'code blocks');
        
        codeBlocks.forEach((codeBlock, index) => {
            const preElement = codeBlock.parentElement;
            console.log('[AskView] Processing code block', index, 'with parent:', preElement?.tagName);
            
            // Check if copy button already exists
            if (preElement.querySelector('.code-copy-button')) {
                console.log('[AskView] Copy button already exists for block', index);
                return;
            }

            // Skip if this is an inline code block (not in a pre tag)
            if (!preElement || preElement.tagName !== 'PRE') {
                console.log('[AskView] Skipping non-PRE element for block', index);
                return;
            }

            // Create copy button
            const copyButton = document.createElement('button');
            copyButton.className = 'code-copy-button';
            copyButton.title = 'Copy code to clipboard';
            copyButton.innerHTML = `
                <svg class="copy-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
                <span>Copy</span>
            `;

            // Add click handler
            copyButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.handleCodeBlockCopy(codeBlock);
            });

            // Append to pre element
            preElement.appendChild(copyButton);
            
            console.log('[AskView] Added copy button to code block', index);
        });
    }

    async handleSendText(e, overridingText = '') {
        const textInput = this.shadowRoot?.getElementById('textInput');
        const text = (overridingText || textInput?.value || '').trim();
        // if (!text) return;

        textInput.value = '';
        
        // Clear navigation flag when sending new message
        this.isNavigatingHistory = false;

        if (window.api) {
            window.api.askView.sendMessage(text).catch(error => {
                console.error('Error sending text:', error);
            });
        }
    }

    handleTextKeydown(e) {
        // Fix for IME composition issue: Ignore Enter key presses while composing.
        if (e.isComposing) {
            return;
        }

        const isPlainEnter = e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey;
        const isModifierEnter = e.key === 'Enter' && (e.metaKey || e.ctrlKey);

        if (isPlainEnter || isModifierEnter) {
            e.preventDefault();
            this.handleSendText();
        }
    }

    updated(changedProperties) {
        super.updated(changedProperties);
    
        // ✨ isLoading 또는 currentResponse가 변경될 때마다 뷰를 다시 그립니다.
        if (changedProperties.has('isLoading') || changedProperties.has('currentResponse')) {
            this.renderContent();
        }
    
        if (changedProperties.has('showTextInput') || changedProperties.has('isLoading') || changedProperties.has('currentResponse')) {
            this.adjustWindowHeightThrottled();
        }
    
        if (changedProperties.has('showTextInput') && this.showTextInput) {
            this.focusTextInput();
        }

        // Update navigation buttons when responses change
        if (changedProperties.has('responses') || changedProperties.has('currentResponseIndex') || changedProperties.has('isLoading') || changedProperties.has('isStreaming')) {
            console.log('[AskView Navigation] Updating navigation buttons due to responses or index change');
            this.updateNavigationButtons();
        }
    }

    firstUpdated() {
        setTimeout(() => this.adjustWindowHeight(), 200);
    }

    getTruncatedQuestion(question, maxLength = 30) {
        if (!question) return '';
        if (question.length <= maxLength) return question;
        return question.substring(0, maxLength) + '...';
    }

    // Navigation helper methods
    onResponseCompleted(response, question = '') {
        console.log('[AskView Navigation] New response completed, length:', response.length);
        const responseObj = {
            content: response,
            question: question,
            timestamp: new Date().toISOString(),
            id: Date.now()
        };
        
        this.responses.push(responseObj);
        this.currentResponseIndex = this.responses.length - 1;
        
        // Update current display to show the new response
        this.currentResponse = response;
        this.currentQuestion = question;
        this.displayResponse = response;
        this.displayQuestion = question;
        
        console.log(`[AskView Navigation] Added response to history. Total responses: ${this.responses.length}`);
        
        this.updateNavigationButtons();
        this.requestUpdate();
    }

    updateNavigationButtons() {
        // Update button states in the next render cycle
        this.requestUpdate();
    }

    getResponseCounter() {
        if (this.responses.length === 0) return '';
        return `${this.currentResponseIndex + 1}/${this.responses.length}`;
    }

    getResponseStatusText() {
        if (this.isLoading) return 'Loading...';
        if (this.isStreaming) return 'Streaming...';
        if (this.responses.length === 0) return 'No responses yet';
        return 'Response history';
    }

    canNavigatePrevious() {
        return this.responses.length > 0 && this.currentResponseIndex > 0 && !this.isLoading && !this.isStreaming;
    }

    canNavigateNext() {
        return this.responses.length > 0 && this.currentResponseIndex < this.responses.length - 1 && !this.isLoading && !this.isStreaming;
    }

    loadResponseAtIndex(index) {
        if (index < 0 || index >= this.responses.length) {
            console.warn('[AskView Navigation] Invalid response index:', index);
            return;
        }

        // Set navigation flag to prevent state updates from overriding
        this.isNavigatingHistory = true;
        console.log(`[AskView Navigation] Setting navigation flag for index ${index}`);

        const response = this.responses[index];
        // Update both current and display state for navigation
        this.currentResponse = response.content;
        this.currentQuestion = response.question;
        this.displayResponse = response.content;
        this.displayQuestion = response.question;
        this.currentResponseIndex = index;
        
        // Reset streaming parser to force complete re-render
        this.resetStreamingParser();
        
        console.log(`[AskView Navigation] Loaded response ${index + 1}/${this.responses.length}`);
        console.log('[AskView Navigation] Response preview:', response.content.substring(0, 100) + '...');
        
        // Re-render the content after loading the response
        this.updateComplete.then(() => {
            this.renderContent();
            // Clear navigation flag after rendering is complete
            requestAnimationFrame(() => {
                setTimeout(() => {
                    this.isNavigatingHistory = false;
                    console.log('[AskView Navigation] Cleared navigation flag');
                }, 300);
            });
        });
        
        this.requestUpdate();
    }

    render() {
        const hasResponse = this.isLoading || this.currentResponse || this.isStreaming;
        const headerText = this.isLoading ? 'Thinking...' : 'AI Response';

        return html`
            <div class="ask-container">
                <!-- Response Header -->
                <div class="response-header ${!hasResponse ? 'hidden' : ''}">
                    <div class="header-left">
                        <div class="response-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
                                <path d="M8 12l2 2 4-4" />
                            </svg>
                        </div>
                        <span class="response-label">${headerText}</span>
                    </div>
                    <div class="header-right">
                        <span class="question-text">${this.getTruncatedQuestion(this.currentQuestion)}</span>
                        <div class="header-controls">
                            <button class="copy-button ${this.copyState === 'copied' ? 'copied' : ''}" @click=${this.handleCopy}>
                                <svg class="copy-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                                </svg>
                                <svg
                                    class="check-icon"
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="2.5"
                                >
                                    <path d="M20 6L9 17l-5-5" />
                                </svg>
                            </button>
                            <button class="always-on-top-button ${this.isAlwaysOnTop ? 'active' : ''}" @click=${this.toggleAlwaysOnTop} title="${this.isAlwaysOnTop ? 'Disable Always On Top' : 'Enable Always On Top'}">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                                    <path d="M21 12c0-1.66-4-3-9-3s-9 1.34-9 3" />
                                    <path d="M12 2v7" />
                                    <path d="M12 15v7" />
                                    <path d="M8 5l4-3 4 3" />
                                </svg>
                            </button>
                            <button class="close-button" @click=${this.handleCloseAskWindow}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Response Container -->
                <div class="response-container ${!hasResponse ? 'hidden' : ''}" id="responseContainer">
                    <!-- Content is dynamically generated in updateResponseContent() -->
                </div>

                <!-- AI Response Navigation -->
                <div class="ai-response-container ${!hasResponse ? 'hidden' : ''}">
                    <button 
                        class="nav-btn prev" 
                        @click="${this.navigatePreviousResponse}" 
                        title="Previous Response"
                        ?disabled="${!this.canNavigatePrevious()}">
                        &#8592;
                    </button>
                    <span class="response-counter">${this.getResponseCounter()}</span>
                    <span class="ai-response-text">${this.getResponseStatusText()}</span>
                    <button 
                        class="nav-btn next" 
                        @click="${this.navigateNextResponse}" 
                        title="Next Response"
                        ?disabled="${!this.canNavigateNext()}">
                        &#8594;
                    </button>
                </div>

                <!-- Text Input Container -->
                <div class="text-input-container ${!hasResponse ? 'no-response' : ''} ${!this.showTextInput ? 'hidden' : ''}">
                    <input
                        type="text"
                        id="textInput"
                        placeholder="Ask about your screen or audio"
                        @keydown=${this.handleTextKeydown}
                        @focus=${this.handleInputFocus}
                    />
                    <button
                        class="submit-btn"
                        @click=${this.handleSendText}
                    >
                        <span class="btn-label">Submit</span>
                        <span class="btn-icon">
                            ↵
                        </span>
                    </button>
                </div>
            </div>
        `;
    }

        // Dynamically resize the BrowserWindow to fit current content
    adjustWindowHeight() {
        if (!window.api) return;

        this.updateComplete.then(() => {
            const headerEl = this.shadowRoot.querySelector('.response-header');
            const responseEl = this.shadowRoot.querySelector('.response-container');
            const navEl = this.shadowRoot.querySelector('.ai-response-container');
            const inputEl = this.shadowRoot.querySelector('.text-input-container');

            if (!headerEl || !responseEl) return;

            const headerHeight = headerEl.classList.contains('hidden') ? 0 : headerEl.offsetHeight;
            const responseHeight = responseEl.scrollHeight;
            const navHeight = (navEl && !navEl.classList.contains('hidden')) ? navEl.offsetHeight : 0;
            const inputHeight = (inputEl && !inputEl.classList.contains('hidden')) ? inputEl.offsetHeight : 0;

            const idealHeight = headerHeight + responseHeight + navHeight + inputHeight;

            const targetHeight = Math.min(700, idealHeight);

            window.api.askView.adjustWindowHeight("ask", targetHeight);

        }).catch(err => console.error('AskView adjustWindowHeight error:', err));
    }

    // Throttled wrapper to avoid excessive IPC spam (executes at most once per animation frame)
    adjustWindowHeightThrottled() {
        if (this.isThrottled) return;

        this.isThrottled = true;
        requestAnimationFrame(() => {
            this.adjustWindowHeight();
            this.isThrottled = false;
        });
    }

    // Navigation methods - Now fully implemented
    navigatePreviousResponse() {
        console.log('[AskView Navigation] Attempting to navigate to previous response');
        console.log(`[AskView Navigation] Current index: ${this.currentResponseIndex}, Total responses: ${this.responses.length}`);
        
        if (!this.canNavigatePrevious()) {
            console.log('[AskView Navigation] Cannot navigate to previous response');
            return;
        }

        const newIndex = this.currentResponseIndex - 1;
        console.log(`[AskView Navigation] Navigating from ${this.currentResponseIndex} to ${newIndex}`);
        
        this.loadResponseAtIndex(newIndex);
    }

    navigateNextResponse() {
        console.log('[AskView Navigation] Attempting to navigate to next response');
        console.log(`[AskView Navigation] Current index: ${this.currentResponseIndex}, Total responses: ${this.responses.length}`);
        
        if (!this.canNavigateNext()) {
            console.log('[AskView Navigation] Cannot navigate to next response');
            return;
        }

        const newIndex = this.currentResponseIndex + 1;
        console.log(`[AskView Navigation] Navigating from ${this.currentResponseIndex} to ${newIndex}`);
        
        this.loadResponseAtIndex(newIndex);
    }

    // Force clear navigation state - emergency method
    forceExitNavigationMode() {
        console.log('[AskView Navigation] Force exiting navigation mode');
        this.isNavigatingHistory = false;
        this.currentResponse = this.liveResponse;
        this.currentQuestion = this.liveQuestion;
        this.displayResponse = this.liveResponse;
        this.displayQuestion = this.liveQuestion;
        this.renderContent();
        this.requestUpdate();
    }
}

customElements.define('ask-view', AskView);