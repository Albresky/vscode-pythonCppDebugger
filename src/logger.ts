/*---------------------------------------------------------
 * Python C++ Debug - Logger Utility
 *--------------------------------------------------------*/

import * as vscode from 'vscode';

export enum LogLevel {
    DEBUG = 'DEBUG',
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR'
}

class Logger {
    private outputChannel: vscode.OutputChannel;
    private static instance: Logger;

    private constructor() {
        this.outputChannel = vscode.window.createOutputChannel('Python C++ Debug');
    }

    public static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }
    private getTimestamp(): string {
        const now = new Date();
        return now.toISOString().replace('T', ' ').substring(0, 23);
    }

    private formatMessage(level: LogLevel, message: string, context?: string): string {
        const timestamp = this.getTimestamp();
        const contextStr = context ? `[${context}] ` : '';
        return `[${timestamp}] [${level}] ${contextStr}${message}`;
    }

    private log(level: LogLevel, message: string, context?: string): void {
        const formattedMessage = this.formatMessage(level, message, context);
        this.outputChannel.appendLine(formattedMessage);
    }
    
    public debug(message: string, context?: string): void {
        this.log(LogLevel.DEBUG, message, context);
    }

    public info(message: string, context?: string): void {
        this.log(LogLevel.INFO, message, context);
    }

    public warn(message: string, context?: string): void {
        this.log(LogLevel.WARN, message, context);
    }

    public error(message: string, context?: string): void {
        this.log(LogLevel.ERROR, message, context);
    }

    public show(): void {
        this.outputChannel.show();
    }

    public clear(): void {
        this.outputChannel.clear();
    }

    public divider(title?: string): void {
        if (title) {
            this.outputChannel.appendLine(`\n${'='.repeat(20)} ${title} ${'='.repeat(20)}`);
        } else {
            this.outputChannel.appendLine('='.repeat(50));
        }
    }

    public logConfig(label: string, config: any, context?: string): void {
        this.info(`${label}:`, context);
        try {
            const formatted = JSON.stringify(config, null, 2);
            formatted.split('\n').forEach(line => {
                this.outputChannel.appendLine(`    ${line}`);
            });
        } catch (e) {
            this.outputChannel.appendLine(`    ${String(config)}`);
        }
    }

    public dispose(): void {
        this.outputChannel.dispose();
    }
}

export const logger = Logger.getInstance();
