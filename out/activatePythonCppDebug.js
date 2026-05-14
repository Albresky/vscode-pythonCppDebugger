/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPythonPath = exports.activatePythonCppDebug = exports.getDefaultCppConfig = void 0;
const vscode = require("vscode");
const pythonCppDebug_1 = require("./pythonCppDebug");
const logger_1 = require("./logger");
const os = require("os");
/**
 * Windows: cppvsdbg
 * macOS/Linux: codelldb (Requires vadimcn.vscode-lldb)
 * Linux: gdb
 */
function getDefaultCppConfig() {
    const platform = os.platform();
    if (platform === 'win32') {
        return 'default (win) Attach';
    }
    else if (platform === 'darwin') {
        return 'default (codelldb) Attach';
    }
    else {
        return 'default (gdb) Attach';
    }
}
exports.getDefaultCppConfig = getDefaultCppConfig;
function activatePythonCppDebug(context, factory) {
    logger_1.logger.info('Registering debug commands and providers...', 'Activate');
    context.subscriptions.push(vscode.commands.registerCommand('extension.pythonCpp-debug.runEditorContents', (resource) => {
        logger_1.logger.info('Command: runEditorContents triggered', 'Command');
        let targetResource = resource;
        if (!targetResource && vscode.window.activeTextEditor) {
            targetResource = vscode.window.activeTextEditor.document.uri;
        }
        if (targetResource) {
            const cppConfig = getDefaultCppConfig();
            logger_1.logger.info(`Running file: ${targetResource.fsPath}, using ${cppConfig}`, 'Command');
            vscode.debug.startDebugging(undefined, {
                type: 'pythoncpp',
                name: 'PythonCpp Debug',
                request: 'launch',
                pythonConfig: 'default',
                cppConfig: cppConfig
            }, { noDebug: true });
        }
    }), vscode.commands.registerCommand('extension.pythonCpp-debug.debugEditorContents', (resource) => {
        logger_1.logger.info('Command: debugEditorContents triggered', 'Command');
        let targetResource = resource;
        if (!targetResource && vscode.window.activeTextEditor) {
            targetResource = vscode.window.activeTextEditor.document.uri;
        }
        if (targetResource) {
            const cppConfig = getDefaultCppConfig();
            logger_1.logger.info(`Debugging file: ${targetResource.fsPath}, using ${cppConfig}`, 'Command');
            vscode.debug.startDebugging(undefined, {
                type: 'pythoncpp',
                name: 'PythonCpp Debug',
                request: 'launch',
                pythonConfig: 'default',
                cppConfig: cppConfig
            });
        }
    }));
    // register a configuration provider for 'pythoncpp' debug type
    const provider = new PythonCppConfigurationProvider();
    context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('pythoncpp', provider));
    logger_1.logger.info('Registered DebugConfigurationProvider for pythoncpp', 'Activate');
    if (!factory) {
        factory = new InlineDebugAdapterFactory();
    }
    context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('pythoncpp', factory));
    if ('dispose' in factory) {
        context.subscriptions.push(factory);
    }
    logger_1.logger.info('Registered DebugAdapterDescriptorFactory', 'Activate');
    logger_1.logger.info('Debug activation completed', 'Activate');
}
exports.activatePythonCppDebug = activatePythonCppDebug;
class PythonCppConfigurationProvider {
    /**
     * Check Debug Configuration before DebugSession is launched
     */
    resolveDebugConfiguration(folder, config, token) {
        logger_1.logger.divider('Resolving Debug Configuration');
        logger_1.logger.logConfig('Input configuration', config, 'ConfigProvider');
        // if launch.json is missing or empty
        if (!config.type && !config.request && !config.name) {
            let msg = "Please make sure you have a launch.json file with a configuration of type 'pythoncpp' to use this debugger";
            logger_1.logger.error(msg, 'ConfigProvider');
            return vscode.window.showErrorMessage(msg).then(_ => {
                return undefined; // abort launch
            });
        }
        if (!folder) {
            let msg = "Working folder not found, open a folder and try again";
            logger_1.logger.error(msg, 'ConfigProvider');
            return vscode.window.showErrorMessage(msg).then(_ => {
                return undefined;
            });
        }
        logger_1.logger.info(`Working folder: ${folder.uri.fsPath}`, 'ConfigProvider');
        if (!config.entirePythonConfig &&
            ((config.pythonConfig && (config.pythonConfig === 'custom' || config.pythonConfig === 'manual')) || !config.pythonConfig) &&
            !config.pythonLaunchName) {
            let msg = "Make sure to either set 'pythonLaunchName' to the name of " +
                "your python configuration or set 'pythonConfig: default'";
            logger_1.logger.error(msg, 'ConfigProvider');
            return vscode.window.showErrorMessage(msg).then(_ => {
                return undefined; // abort launch
            });
        }
        if (!config.entireCppConfig &&
            ((config.cppConfig && (config.cppConfig === 'custom' || config.cppConfig === 'manual')) || !config.cppConfig) &&
            !config.cppAttachName) {
            let msg = "Make sure to either set 'cppAttachName' to the name of " +
                "your C++ configuration or set 'cppConfig' to the default configuration you wish to use";
            logger_1.logger.error(msg, 'ConfigProvider');
            return vscode.window.showErrorMessage(msg).then(_ => {
                return undefined; // abort launch
            });
        }
        logger_1.logger.info('Configuration validation passed', 'ConfigProvider');
        return config;
    }
    provideDebugConfigurations(folder, token) {
        return __awaiter(this, void 0, void 0, function* () {
            const gdbConfig = {
                "name": "(gdb) Attach",
                "type": "cppdbg",
                "request": "attach",
                "program": yield getPythonPath(null),
                "processId": "",
                // eslint-disable-next-line @typescript-eslint/naming-convention
                "MIMode": "gdb",
                "miDebuggerPath": "/path/to/gdb or remove this attribute for the path to be found automatically",
                "setupCommands": [
                    {
                        "description": "Enable pretty-printing for gdb",
                        "text": "-enable-pretty-printing",
                        "ignoreFailures": true
                    }
                ]
            };
            // CodeLLDB
            const codelldbConfig = {
                "name": "(codelldb) Attach",
                "type": "lldb",
                "request": "attach",
                "pid": ""
            };
            const winConfig = {
                "name": "(Windows) Attach",
                "type": "cppvsdbg",
                "request": "attach",
                "processId": ""
            };
            const items = [
                { label: "Python C++ Debugger", configuration: winConfig, description: "Default", type: "Default" },
                { label: "Python C++ Debugger", configuration: winConfig, description: "Custom: Windows", type: "(Windows)" },
                { label: "Python C++ Debugger", configuration: gdbConfig, description: "Custom: GDB", type: "(gdb)" },
                { label: "Python C++ Debugger", configuration: codelldbConfig, description: "Custom: CodeLLDB", type: "(codelldb)" }
            ];
            const selection = yield vscode.window.showQuickPick(items, { placeHolder: "Select a configuration" });
            if (!selection || selection.type === "Default") {
                const defaultConfig = {
                    "name": "Python C++ Debugger",
                    "type": "pythoncpp",
                    "request": "launch",
                    "pythonConfig": "default",
                    "cppConfig": getDefaultCppConfig()
                };
                return [defaultConfig];
            }
            const pythonConfig = {
                "name": "Python: Current File",
                "type": "python",
                "request": "launch",
                "program": "${file}",
                "console": "integratedTerminal"
            };
            const pythonCppConfig = {
                "name": "Python C++ Debugger",
                "type": "pythoncpp",
                "request": "launch",
                "pythonLaunchName": "Python: Current File",
                "cppAttachName": selection.type + " Attach"
            };
            return [pythonCppConfig, selection.configuration, pythonConfig];
        });
    }
}
function getPythonPath(document) {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let pyExt = vscode.extensions.getExtension('ms-python.python');
            if (!pyExt) {
                return 'python';
            }
            if ((_b = (_a = pyExt.packageJSON) === null || _a === void 0 ? void 0 : _a.featureFlags) === null || _b === void 0 ? void 0 : _b.usingNewInterpreterStorage) {
                if (!pyExt.isActive) {
                    yield pyExt.activate();
                }
                const pythonPath = pyExt.exports.settings.getExecutionDetails ?
                    pyExt.exports.settings.getExecutionDetails(document === null || document === void 0 ? void 0 : document.uri).execCommand :
                    pyExt.exports.settings.getExecutionCommand(document === null || document === void 0 ? void 0 : document.uri);
                return pythonPath ? pythonPath.join(' ') : 'python';
            }
            else {
                let path;
                if (document) {
                    path = vscode.workspace.getConfiguration('python', document.uri).get('pythonPath');
                }
                else {
                    path = vscode.workspace.getConfiguration('python').get('pythonPath');
                }
                if (!path) {
                    return 'python';
                }
            }
        }
        catch (ignored) {
            return 'python';
        }
        return 'python';
    });
}
exports.getPythonPath = getPythonPath;
class InlineDebugAdapterFactory {
    createDebugAdapterDescriptor(_session) {
        return new vscode.DebugAdapterInlineImplementation(new pythonCppDebug_1.PythonCppDebugSession());
    }
}
//# sourceMappingURL=activatePythonCppDebug.js.map