/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import {
	LoggingDebugSession, TerminatedEvent
} from 'vscode-debugadapter';
import * as vscode from 'vscode';
import { DebugProtocol } from 'vscode-debugprotocol';
import { getPythonPath } from './activatePythonCppDebug';
import { logger } from './logger';


interface ILaunchRequestArguments extends DebugProtocol.LaunchRequestArguments {
	/** An absolute path to the "program" to debug. */
	program: string;
	/** Automatically stop target after launch. If not specified, target does not stop. */
	stopOnEntry?: boolean;
	/** run without debugging */
	noDebug?: boolean;


	pythonLaunchName?;
	pythonLaunch;
	pythonConfig?;
	entirePythonConfig?;

	cppAttachName?;
	cppAttach;
	cppConfig?;
	entireCppConfig?;

	optimizedLaunch?: boolean;
}

export class PythonCppDebugSession extends LoggingDebugSession {

	private folder : vscode.WorkspaceFolder | undefined;

	public constructor() {
		super();

		logger.info('Creating new PythonCppDebugSession', 'DebugSession');

		let folders = vscode.workspace.workspaceFolders;
		if(!folders){
			let message = "Working folder not found, open a folder and try again" ;
			logger.error(message, 'DebugSession');
			vscode.window.showErrorMessage(message);
			this.sendEvent(new TerminatedEvent());
			return;
		}
		this.folder = folders[0];
		logger.info(`Workspace folder: ${this.folder.uri.fsPath}`, 'DebugSession');
	}

	protected async launchRequest(
		response: DebugProtocol.LaunchResponse, 
		args: ILaunchRequestArguments
	) {
		logger.divider('Launch Request Started');
		logger.info('Processing launch request...', 'DebugSession');
		logger.logConfig('Launch arguments', args, 'DebugSession');

		// We terminate the session so that the active debugsession 
		// will be python when we will need it
		this.sendEvent(new TerminatedEvent());
		if(!this.folder){
			let message = "Working folder not found, open a folder and try again" ;
			logger.error(message, 'DebugSession');
			vscode.window.showErrorMessage(message);
			return;
		}

		let config = await this.checkConfig(args, this.folder);
		if(!config){
			logger.error('Configuration check failed, aborting launch', 'DebugSession');
			return;
		}
		args = config;

		let pyConf = args.pythonLaunch;
		let cppConf = args.cppAttach;

		logger.logConfig('Python configuration', pyConf, 'DebugSession');
		logger.logConfig('C++ configuration', cppConf, 'DebugSession');
		
		// We force the Debugger to stopOnEntry so we can attach the cpp debugger
		let oldStopOnEntry : boolean = pyConf.stopOnEntry ? true : false;
		pyConf.stopOnEntry = true;
		logger.info(`Original stopOnEntry: ${oldStopOnEntry}, forcing stopOnEntry=true for C++ attach`, 'DebugSession');

		logger.info('Starting Python debugger...', 'DebugSession');
		await vscode.debug.startDebugging(this.folder, pyConf, undefined).then( pythonStartResponse => {

			if(!vscode.debug.activeDebugSession || !pythonStartResponse){
				logger.error('Python debugger failed to start', 'DebugSession');
				return;
			}
			
			logger.info('Python debugger started successfully', 'DebugSession');
			const pySession = vscode.debug.activeDebugSession;
			logger.info(`Python session ID: ${pySession.id}, name: ${pySession.name}`, 'DebugSession');
			
			logger.info('Requesting process info from Python debugger (pydevdSystemInfo)...', 'DebugSession');
			pySession.customRequest('pydevdSystemInfo').then(res => {

				if(!res.process.pid){
					let message = "The python debugger couldn't send its processId,						\
					 				make sure to enter an Issue on the official Python Cp++ Debug Github about this issue!" ;
					logger.error(message, 'DebugSession');
					return vscode.window.showErrorMessage(message).then(_ => {
						return;
					});
				}

				logger.info(`Python process PID: ${res.process.pid}`, 'DebugSession');

				// set processid to debugpy processid to attach to
				cppConf.processId = res.process.pid;
				cppConf.pid = res.process.pid;
				
				logger.info(`Starting C++ debugger, attaching to PID: ${res.process.pid}...`, 'DebugSession');

				vscode.debug.startDebugging(this.folder, cppConf, undefined).then(cppStartResponse => {

					// If the Cpp debugger wont start make sure to stop the python debugsession
					if(!cppStartResponse){
						logger.error('C++ debugger failed to start, stopping Python session', 'DebugSession');
						vscode.debug.stopDebugging(pySession);
						return;
					}
					
					logger.info('C++ debugger started successfully', 'DebugSession');
					
					// We have to delay the call to continue the process as it might not have fully attached yet
					const delay = (!args.optimizedLaunch) ? 500 : 0;
					logger.info(`Waiting ${delay}ms before continuing...`, 'DebugSession');
					
					setTimeout(_ => {
						/** 
						 * If the user hasn't defined/set stopOnEntry in the Python config 
						 * we continue as we force a stopOnEntry to attach the Cpp debugger
						 * */ 
						if(!oldStopOnEntry){
							logger.info('Continuing Python execution (stopOnEntry was not set by user)', 'DebugSession');
							pySession.customRequest('continue');
						} else {
							logger.info('Keeping stopOnEntry as user requested', 'DebugSession');
						}
						logger.divider('Debug Session Ready');
						logger.info('Both Python and C++ debuggers are attached and ready!', 'DebugSession');
					},
					delay);
				});
			});
		});
		
		this.sendResponse(response);
	}

	protected async checkConfig(config:ILaunchRequestArguments, folder:vscode.WorkspaceFolder): Promise<ILaunchRequestArguments | undefined>{
		
		logger.info('Checking and resolving configuration...', 'ConfigCheck');
		
		// Python Launch configuration can be set manually or automatically with the default settings
		let pythonLaunch;
		if(config.entirePythonConfig){
			logger.info('Using entirePythonConfig from launch.json', 'ConfigCheck');
			pythonLaunch = config.entirePythonConfig;
		}
		else if(!config.pythonConfig || config.pythonConfig === "custom" || config.pythonConfig === "manual"){
			// Make sure the user has defined the properties 'pythonLaunchName' & 'cppAttachName
			if(!config.pythonLaunchName){
				let msg = "Please make sure to define 'pythonLaunchName' for pythonCpp in your launch.json file or set 'pythonConfig' to default";
				logger.error(msg, 'ConfigCheck');
				return vscode.window.showErrorMessage(msg).then(_ => {
					return undefined;	// abort launch
				});
			} 
			else{
				logger.info(`Looking for Python config named: "${config.pythonLaunchName}"`, 'ConfigCheck');
				pythonLaunch = getConfig(config.pythonLaunchName, folder);
				if(!pythonLaunch){
					let message = "Please make sure you have a configurations with the names '" + config.pythonLaunchName + "' in your launch.json file.";
					logger.error(message, 'ConfigCheck');
					vscode.window.showErrorMessage(message);
					return undefined;
				}
				logger.info(`Found Python config: "${config.pythonLaunchName}"`, 'ConfigCheck');
			}
		}
		else if(config.pythonConfig === "default"){
			logger.info('Using default Python configuration', 'ConfigCheck');
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
		if(config.entireCppConfig){
			logger.info('Using entireCppConfig from launch.json', 'ConfigCheck');
			cppAttach = config.entireCppConfig;
		}
		else if(!config.cppConfig || config.cppConfig === "custom" || config.cppConfig === "manual"){
			// Make sure the user has defined the property 'cppAttachName'
			if(!config.cppAttachName){
				let msg = "Make sure to either define 'cppAttachName' for pythonCpp in your launch.json file or use the default configurations with the attribute 'cppConfig'";
				logger.error(msg, 'ConfigCheck');
				return vscode.window.showErrorMessage(msg).then(_ => {
					return undefined;	// abort launch
				});
			} 
			else{
				logger.info(`Looking for C++ config named: "${config.cppAttachName}"`, 'ConfigCheck');
				cppAttach = getConfig(config.cppAttachName, folder);
				if(!cppAttach){
					let message = "Make sure you have a configurations with the names '" + config.cppAttachName + "' in your launch.json file.";
					logger.error(message, 'ConfigCheck');
					vscode.window.showErrorMessage(message);
					return undefined;
				}
				logger.info(`Found C++ config: "${config.cppAttachName}"`, 'ConfigCheck');

				// If the program field isn't specified, fill it in automatically
				if(!cppAttach["program"] && cppAttach["type"] === "cppdbg"){
					const pythonPath = await getPythonPath(null);
					logger.info(`Auto-filling C++ program field with Python path: ${pythonPath}`, 'ConfigCheck');
					cppAttach["program"] = pythonPath;
				}

				cppAttach["processId"] = "";
			}
		}
		else if(config.cppConfig === "default (win) Attach"){
			logger.info('Using default Windows C++ attach configuration', 'ConfigCheck');
			cppAttach = {
				"name": "(Windows) Attach",
				"type": "cppvsdbg",
				"request": "attach",
				"processId": ""
			};
		}
		else if(config.cppConfig === "default (gdb) Attach"){
			logger.info('Using default GDB C++ attach configuration', 'ConfigCheck');
			const pythonPath = await getPythonPath(null);
			logger.info(`Python executable path: ${pythonPath}`, 'ConfigCheck');
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
		else if(config.cppConfig === "default (codelldb) Attach"){
			logger.info('Using default CodeLLDB attach configuration', 'ConfigCheck');
			cppAttach = {
				"name": "(codelldb) Attach",
				"type": "lldb",
				"request": "attach",
				"pid": ""
			};
		}

		config.pythonLaunch = pythonLaunch;
		config.cppAttach = cppAttach;

		logger.info('Configuration check completed successfully', 'ConfigCheck');
		return config;
	}
}

function getConfig(name:string, folder:vscode.WorkspaceFolder): JSON | undefined{
	const launchConfigs = vscode.workspace.getConfiguration('launch', folder.uri);
	const values: JSON | undefined = launchConfigs.get('configurations');
	if(!values){
		let message = "Unexpected error with the launch.json file" ;
		vscode.window.showErrorMessage(message);
		return undefined;
	}

	return nameDefinedInLaunch(name, values);
}

function nameDefinedInLaunch(name:string, launch:JSON): JSON | undefined {
	let i = 0;
	while(launch[i]){
		if(launch[i].name === name){
			return launch[i];
		}
		i++;
	}
	return undefined;
}