"use strict";
/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
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
exports.PythonCppDebugSession = void 0;
const vscode_debugadapter_1 = require("vscode-debugadapter");
const vscode = require("vscode");
const activatePythonCppDebug_1 = require("./activatePythonCppDebug");
const logger_1 = require("./logger");
class PythonCppDebugSession extends vscode_debugadapter_1.LoggingDebugSession {
    constructor() {
        super();
        logger_1.logger.info('Creating new PythonCppDebugSession', 'DebugSession');
        let folders = vscode.workspace.workspaceFolders;
        if (!folders) {
            let message = "Working folder not found, open a folder and try again";
            logger_1.logger.error(message, 'DebugSession');
            vscode.window.showErrorMessage(message);
            this.sendEvent(new vscode_debugadapter_1.TerminatedEvent());
            return;
        }
        this.folder = folders[0];
        logger_1.logger.info(`Workspace folder: ${this.folder.uri.fsPath}`, 'DebugSession');
    }
    launchRequest(response, args) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.logger.divider('Launch Request Started');
            logger_1.logger.info('Processing launch request...', 'DebugSession');
            logger_1.logger.logConfig('Launch arguments', args, 'DebugSession');
            // We terminate the session so that the active debugsession 
            // will be python when we will need it
            this.sendEvent(new vscode_debugadapter_1.TerminatedEvent());
            if (!this.folder) {
                let message = "Working folder not found, open a folder and try again";
                logger_1.logger.error(message, 'DebugSession');
                vscode.window.showErrorMessage(message);
                return;
            }
            let config = yield this.checkConfig(args, this.folder);
            if (!config) {
                logger_1.logger.error('Configuration check failed, aborting launch', 'DebugSession');
                return;
            }
            args = config;
            let pyConf = args.pythonLaunch;
            let cppConf = args.cppAttach;
            logger_1.logger.logConfig('Python configuration', pyConf, 'DebugSession');
            logger_1.logger.logConfig('C++ configuration', cppConf, 'DebugSession');
            // We force the Debugger to stopOnEntry so we can attach the cpp debugger
            let oldStopOnEntry = pyConf.stopOnEntry ? true : false;
            pyConf.stopOnEntry = true;
            logger_1.logger.info(`Original stopOnEntry: ${oldStopOnEntry}, forcing stopOnEntry=true for C++ attach`, 'DebugSession');
            logger_1.logger.info('Starting Python debugger...', 'DebugSession');
            yield vscode.debug.startDebugging(this.folder, pyConf, undefined).then(pythonStartResponse => {
                if (!vscode.debug.activeDebugSession || !pythonStartResponse) {
                    logger_1.logger.error('Python debugger failed to start', 'DebugSession');
                    return;
                }
                logger_1.logger.info('Python debugger started successfully', 'DebugSession');
                const pySession = vscode.debug.activeDebugSession;
                logger_1.logger.info(`Python session ID: ${pySession.id}, name: ${pySession.name}`, 'DebugSession');
                logger_1.logger.info('Requesting process info from Python debugger (pydevdSystemInfo)...', 'DebugSession');
                pySession.customRequest('pydevdSystemInfo').then(res => {
                    if (!res.process.pid) {
                        let message = "The python debugger couldn't send its processId,						\
					 				make sure to enter an Issue on the official Python Cp++ Debug Github about this issue!";
                        logger_1.logger.error(message, 'DebugSession');
                        return vscode.window.showErrorMessage(message).then(_ => {
                            return;
                        });
                    }
                    logger_1.logger.info(`Python process PID: ${res.process.pid}`, 'DebugSession');
                    // set processid to debugpy processid to attach to
                    cppConf.processId = res.process.pid;
                    cppConf.pid = res.process.pid;
                    logger_1.logger.info(`Starting C++ debugger, attaching to PID: ${res.process.pid}...`, 'DebugSession');
                    vscode.debug.startDebugging(this.folder, cppConf, undefined).then(cppStartResponse => {
                        // If the Cpp debugger wont start make sure to stop the python debugsession
                        if (!cppStartResponse) {
                            logger_1.logger.error('C++ debugger failed to start, stopping Python session', 'DebugSession');
                            vscode.debug.stopDebugging(pySession);
                            return;
                        }
                        logger_1.logger.info('C++ debugger started successfully', 'DebugSession');
                        // We have to delay the call to continue the process as it might not have fully attached yet
                        const delay = (!args.optimizedLaunch) ? 500 : 0;
                        logger_1.logger.info(`Waiting ${delay}ms before continuing...`, 'DebugSession');
                        setTimeout(_ => {
                            /**
                             * If the user hasn't defined/set stopOnEntry in the Python config
                             * we continue as we force a stopOnEntry to attach the Cpp debugger
                             * */
                            if (!oldStopOnEntry) {
                                logger_1.logger.info('Continuing Python execution (stopOnEntry was not set by user)', 'DebugSession');
                                pySession.customRequest('continue');
                            }
                            else {
                                logger_1.logger.info('Keeping stopOnEntry as user requested', 'DebugSession');
                            }
                            logger_1.logger.divider('Debug Session Ready');
                            logger_1.logger.info('Both Python and C++ debuggers are attached and ready!', 'DebugSession');
                        }, delay);
                    });
                });
            });
            this.sendResponse(response);
        });
    }
    checkConfig(config, folder) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.logger.info('Checking and resolving configuration...', 'ConfigCheck');
            // Python Launch configuration can be set manually or automatically with the default settings
            let pythonLaunch;
            if (config.entirePythonConfig) {
                logger_1.logger.info('Using entirePythonConfig from launch.json', 'ConfigCheck');
                pythonLaunch = config.entirePythonConfig;
            }
            else if (!config.pythonConfig || config.pythonConfig === "custom" || config.pythonConfig === "manual") {
                // Make sure the user has defined the properties 'pythonLaunchName' & 'cppAttachName
                if (!config.pythonLaunchName) {
                    let msg = "Please make sure to define 'pythonLaunchName' for pythonCpp in your launch.json file or set 'pythonConfig' to default";
                    logger_1.logger.error(msg, 'ConfigCheck');
                    return vscode.window.showErrorMessage(msg).then(_ => {
                        return undefined; // abort launch
                    });
                }
                else {
                    logger_1.logger.info(`Looking for Python config named: "${config.pythonLaunchName}"`, 'ConfigCheck');
                    pythonLaunch = getConfig(config.pythonLaunchName, folder);
                    if (!pythonLaunch) {
                        let message = "Please make sure you have a configurations with the names '" + config.pythonLaunchName + "' in your launch.json file.";
                        logger_1.logger.error(message, 'ConfigCheck');
                        vscode.window.showErrorMessage(message);
                        return undefined;
                    }
                    logger_1.logger.info(`Found Python config: "${config.pythonLaunchName}"`, 'ConfigCheck');
                }
            }
            else if (config.pythonConfig === "default") {
                logger_1.logger.info('Using default Python configuration', 'ConfigCheck');
                pythonLaunch = {
                    "name": "Python: Current File",
                    "type": "python",
                    "request": "launch",
                    "program": "${file}",
                    "console": "integratedTerminal"
                };
            }
            // C++ launch configuration can be set manually or automatically with the default settings
            let cppAttach;
            if (config.entireCppConfig) {
                logger_1.logger.info('Using entireCppConfig from launch.json', 'ConfigCheck');
                cppAttach = config.entireCppConfig;
            }
            else if (!config.cppConfig || config.cppConfig === "custom" || config.cppConfig === "manual") {
                // Make sure the user has defined the property 'cppAttachName'
                if (!config.cppAttachName) {
                    let msg = "Make sure to either define 'cppAttachName' for pythonCpp in your launch.json file or use the default configurations with the attribute 'cppConfig'";
                    logger_1.logger.error(msg, 'ConfigCheck');
                    return vscode.window.showErrorMessage(msg).then(_ => {
                        return undefined; // abort launch
                    });
                }
                else {
                    logger_1.logger.info(`Looking for C++ config named: "${config.cppAttachName}"`, 'ConfigCheck');
                    cppAttach = getConfig(config.cppAttachName, folder);
                    if (!cppAttach) {
                        let message = "Make sure you have a configurations with the names '" + config.cppAttachName + "' in your launch.json file.";
                        logger_1.logger.error(message, 'ConfigCheck');
                        vscode.window.showErrorMessage(message);
                        return undefined;
                    }
                    logger_1.logger.info(`Found C++ config: "${config.cppAttachName}"`, 'ConfigCheck');
                    // If the program field isn't specified, fill it in automatically
                    if (!cppAttach["program"] && cppAttach["type"] === "cppdbg") {
                        const pythonPath = yield activatePythonCppDebug_1.getPythonPath(null);
                        logger_1.logger.info(`Auto-filling C++ program field with Python path: ${pythonPath}`, 'ConfigCheck');
                        cppAttach["program"] = pythonPath;
                    }
                    cppAttach["processId"] = "";
                }
            }
            else if (config.cppConfig === "default (win) Attach") {
                logger_1.logger.info('Using default Windows C++ attach configuration', 'ConfigCheck');
                cppAttach = {
                    "name": "(Windows) Attach",
                    "type": "cppvsdbg",
                    "request": "attach",
                    "processId": ""
                };
            }
            else if (config.cppConfig === "default (gdb) Attach") {
                logger_1.logger.info('Using default GDB C++ attach configuration', 'ConfigCheck');
                const pythonPath = yield activatePythonCppDebug_1.getPythonPath(null);
                logger_1.logger.info(`Python executable path: ${pythonPath}`, 'ConfigCheck');
                cppAttach = {
                    "name": "(gdb) Attach",
                    "type": "cppdbg",
                    "request": "attach",
                    "program": pythonPath,
                    "processId": "",
                    "MIMode": "gdb",
                    "setupCommands": [
                        {
                            "description": "Enable pretty-printing for gdb",
                            "text": "-enable-pretty-printing",
                            "ignoreFailures": true
                        }
                    ]
                };
            }
            else if (config.cppConfig === "default (codelldb) Attach") {
                logger_1.logger.info('Using default CodeLLDB attach configuration', 'ConfigCheck');
                cppAttach = {
                    "name": "(codelldb) Attach",
                    "type": "lldb",
                    "request": "attach",
                    "pid": ""
                };
            }
            config.pythonLaunch = pythonLaunch;
            config.cppAttach = cppAttach;
            logger_1.logger.info('Configuration check completed successfully', 'ConfigCheck');
            return config;
        });
    }
}
exports.PythonCppDebugSession = PythonCppDebugSession;
function getConfig(name, folder) {
    const launchConfigs = vscode.workspace.getConfiguration('launch', folder.uri);
    const values = launchConfigs.get('configurations');
    if (!values) {
        let message = "Unexpected error with the launch.json file";
        vscode.window.showErrorMessage(message);
        return undefined;
    }
    return nameDefinedInLaunch(name, values);
}
function nameDefinedInLaunch(name, launch) {
    let i = 0;
    while (launch[i]) {
        if (launch[i].name === name) {
            return launch[i];
        }
        i++;
    }
    return undefined;
}
//# sourceMappingURL=pythonCppDebug.js.map