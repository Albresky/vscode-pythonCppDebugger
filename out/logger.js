"use strict";
/*---------------------------------------------------------
 * Python C++ Debug - Logger Utility
 *--------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.LogLevel = void 0;
const vscode = require("vscode");
var LogLevel;
(function (LogLevel) {
    LogLevel["DEBUG"] = "DEBUG";
    LogLevel["INFO"] = "INFO";
    LogLevel["WARN"] = "WARN";
    LogLevel["ERROR"] = "ERROR";
})(LogLevel = exports.LogLevel || (exports.LogLevel = {}));
class Logger {
    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('Python C++ Debug');
    }
    static getInstance() {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }
    getTimestamp() {
        const now = new Date();
        return now.toISOString().replace('T', ' ').substring(0, 23);
    }
    formatMessage(level, message, context) {
        const timestamp = this.getTimestamp();
        const contextStr = context ? `[${context}] ` : '';
        return `[${timestamp}] [${level}] ${contextStr}${message}`;
    }
    log(level, message, context) {
        const formattedMessage = this.formatMessage(level, message, context);
        this.outputChannel.appendLine(formattedMessage);
    }
    debug(message, context) {
        this.log(LogLevel.DEBUG, message, context);
    }
    info(message, context) {
        this.log(LogLevel.INFO, message, context);
    }
    warn(message, context) {
        this.log(LogLevel.WARN, message, context);
    }
    error(message, context) {
        this.log(LogLevel.ERROR, message, context);
    }
    show() {
        this.outputChannel.show();
    }
    clear() {
        this.outputChannel.clear();
    }
    divider(title) {
        if (title) {
            this.outputChannel.appendLine(`\n${'='.repeat(20)} ${title} ${'='.repeat(20)}`);
        }
        else {
            this.outputChannel.appendLine('='.repeat(50));
        }
    }
    logConfig(label, config, context) {
        this.info(`${label}:`, context);
        try {
            const formatted = JSON.stringify(config, null, 2);
            formatted.split('\n').forEach(line => {
                this.outputChannel.appendLine(`    ${line}`);
            });
        }
        catch (e) {
            this.outputChannel.appendLine(`    ${String(config)}`);
        }
    }
    dispose() {
        this.outputChannel.dispose();
    }
}
exports.logger = Logger.getInstance();
//# sourceMappingURL=logger.js.map