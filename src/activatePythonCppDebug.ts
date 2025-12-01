/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import { WorkspaceFolder, DebugConfiguration, ProviderResult, CancellationToken } from 'vscode';
import { PythonCppDebugSession } from './pythonCppDebug';
import { logger } from './logger';
import * as os from 'os';

/**
 * Windows: cppvsdbg
 * macOS/Linux: codelldb (Requires vadimcn.vscode-lldb)
 * Linux: gdb
 */
export function getDefaultCppConfig(): string {
	const platform = os.platform();
	if (platform === 'win32') {
		return 'default (win) Attach';
	} else if (platform === 'darwin') {
		return 'default (codelldb) Attach';
	} else {
		return 'default (gdb) Attach';
	}
}

export function activatePythonCppDebug(context: vscode.ExtensionContext, factory?: vscode.DebugAdapterDescriptorFactory) {

	logger.info('Registering debug commands and providers...', 'Activate');

	context.subscriptions.push(
		vscode.commands.registerCommand('extension.pythonCpp-debug.runEditorContents', (resource: vscode.Uri) => {
			logger.info('Command: runEditorContents triggered', 'Command');
			let targetResource = resource;
			if (!targetResource && vscode.window.activeTextEditor) {
				targetResource = vscode.window.activeTextEditor.document.uri;
			}
			if (targetResource) {
				const cppConfig = getDefaultCppConfig();
				logger.info(`Running file: ${targetResource.fsPath}, using ${cppConfig}`, 'Command');
				vscode.debug.startDebugging(undefined, {
					type: 'pythoncpp',
					name: 'PythonCpp Debug',
					request: 'launch',
					pythonConfig: 'default',
					cppConfig: cppConfig
				},
					{ noDebug: true }
				);
			}
		}),
		vscode.commands.registerCommand('extension.pythonCpp-debug.debugEditorContents', (resource: vscode.Uri) => {
			logger.info('Command: debugEditorContents triggered', 'Command');
			let targetResource = resource;
			if (!targetResource && vscode.window.activeTextEditor) {
				targetResource = vscode.window.activeTextEditor.document.uri;
			}
			if (targetResource) {
				const cppConfig = getDefaultCppConfig();
				logger.info(`Debugging file: ${targetResource.fsPath}, using ${cppConfig}`, 'Command');
				vscode.debug.startDebugging(undefined, {
					type: 'pythoncpp',
					name: 'PythonCpp Debug',
					request: 'launch',
					pythonConfig: 'default',
					cppConfig: cppConfig
				});
			}
		})
	);

	// register a configuration provider for 'pythoncpp' debug type
	const provider = new PythonCppConfigurationProvider();
	context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('pythoncpp', provider));
	logger.info('Registered DebugConfigurationProvider for pythoncpp', 'Activate');



	if (!factory) {
		factory = new InlineDebugAdapterFactory();
	}
	context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('pythoncpp', factory));
	if ('dispose' in factory) {
		context.subscriptions.push(factory);
	}
	
	logger.info('Registered DebugAdapterDescriptorFactory', 'Activate');
	logger.info('Debug activation completed', 'Activate');

}

class PythonCppConfigurationProvider implements vscode.DebugConfigurationProvider {

	/**
	 * Check Debug Configuration before DebugSession is launched
	 */
	resolveDebugConfiguration(
		folder: WorkspaceFolder | undefined,
		config: DebugConfiguration,
		token?: CancellationToken
	): ProviderResult<DebugConfiguration | undefined> {

		logger.divider('Resolving Debug Configuration');
		logger.logConfig('Input configuration', config, 'ConfigProvider');

		// if launch.json is missing or empty
		if (!config.type && !config.request && !config.name) {
			let msg = "Please make sure you have a launch.json file with a configuration of type 'pythoncpp' to use this debugger";
			logger.error(msg, 'ConfigProvider');
			return vscode.window.showErrorMessage(msg).then(_ => {
				return undefined;	// abort launch
			});
		}

		if (!folder) {
			let msg = "Working folder not found, open a folder and try again";
			logger.error(msg, 'ConfigProvider');
			return vscode.window.showErrorMessage(msg).then(_ => {
				return undefined;
			});
		}
		
		logger.info(`Working folder: ${folder.uri.fsPath}`, 'ConfigProvider');

		if (
			!config.entirePythonConfig &&
			((config.pythonConfig && (config.pythonConfig === 'custom' || config.pythonConfig === 'manual')) || !config.pythonConfig) &&
			!config.pythonLaunchName
		) {
			let msg = 
			"Make sure to either set 'pythonLaunchName' to the name of " +
			"your python configuration or set 'pythonConfig: default'";
			logger.error(msg, 'ConfigProvider');
			return vscode.window.showErrorMessage(msg).then(_ => {
				return undefined;	// abort launch
			});
		}

		if (
			!config.entireCppConfig &&
			((config.cppConfig && (config.cppConfig === 'custom' || config.cppConfig === 'manual')) || !config.cppConfig) &&
			!config.cppAttachName
		) {
			let msg = 
			"Make sure to either set 'cppAttachName' to the name of " +
			"your C++ configuration or set 'cppConfig' to the default configuration you wish to use";
			logger.error(msg, 'ConfigProvider');
			return vscode.window.showErrorMessage(msg).then(_ => {
				return undefined;	// abort launch
			});
		}

		logger.info('Configuration validation passed', 'ConfigProvider');
		return config;
	}

	async provideDebugConfigurations(
		folder?: vscode.WorkspaceFolder, 
		token?: vscode.CancellationToken
	): Promise<vscode.DebugConfiguration[]> {

		interface MenuItem extends vscode.QuickPickItem {
			configuration: vscode.DebugConfiguration;
			type: string;
		}

		const gdbConfig: vscode.DebugConfiguration = {
			"name": "(gdb) Attach",
			"type": "cppdbg",
			"request": "attach",
			"program": await getPythonPath(null),
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
		const codelldbConfig: vscode.DebugConfiguration = {
			"name": "(codelldb) Attach",
			"type": "lldb",
			"request": "attach",
			"pid": ""
		};

		const winConfig: vscode.DebugConfiguration = {
			"name": "(Windows) Attach",
			"type": "cppvsdbg",
			"request": "attach",
			"processId": ""
		};

		const items: MenuItem[] = [
			{ label: "Python C++ Debugger", configuration: winConfig, description: "Default", type: "Default" },
			{ label: "Python C++ Debugger", configuration: winConfig, description: "Custom: Windows", type: "(Windows)" },
			{ label: "Python C++ Debugger", configuration: gdbConfig, description: "Custom: GDB", type: "(gdb)" },
			{ label: "Python C++ Debugger", configuration: codelldbConfig, description: "Custom: CodeLLDB", type: "(codelldb)" }
		];

		const selection: MenuItem | undefined = await vscode.window.showQuickPick(items, { placeHolder: "Select a configuration" });
		if(!selection || selection.type === "Default") {
			const defaultConfig: vscode.DebugConfiguration = {
				"name": "Python C++ Debugger",
				"type": "pythoncpp",
				"request": "launch",
				"pythonConfig": "default",
				"cppConfig": getDefaultCppConfig()
			};
			return [defaultConfig];
		}

		const pythonConfig: vscode.DebugConfiguration = {
			"name": "Python: Current File",
			"type": "python",
			"request": "launch",
			"program": "${file}",
			"console": "integratedTerminal"
		};

		const pythonCppConfig: vscode.DebugConfiguration = {
			"name": "Python C++ Debugger",
			"type": "pythoncpp",
			"request": "launch",
			"pythonLaunchName": "Python: Current File",
			"cppAttachName": selection.type + " Attach"
		};

		return [pythonCppConfig, selection.configuration, pythonConfig];
	}

}

export async function getPythonPath(document: vscode.TextDocument | null): Promise<string> {
	try {
		let pyExt = vscode.extensions.getExtension('ms-python.python');
		if (!pyExt) {
			return 'python';
		}

		if (pyExt.packageJSON?.featureFlags?.usingNewInterpreterStorage) {
			if (!pyExt.isActive) {
				await pyExt.activate();
			}

			const pythonPath = pyExt.exports.settings.getExecutionDetails ?
				pyExt.exports.settings.getExecutionDetails(
					document?.uri
				).execCommand :
				pyExt.exports.settings.getExecutionCommand(document?.uri);
			return pythonPath ? pythonPath.join(' ') : 'python';
		} else {
			let path;
			if (document) {
				path = vscode.workspace.getConfiguration(
					'python',
					document.uri
				).get<string>('pythonPath');
			}
			else {
				path = vscode.workspace.getConfiguration(
					'python'
				).get<string>('pythonPath');
			}
			if (!path) {
				return 'python';
			}
		}
	} catch (ignored) {
		return 'python';
	}
	return 'python';
}

class InlineDebugAdapterFactory implements vscode.DebugAdapterDescriptorFactory {

	createDebugAdapterDescriptor(_session: vscode.DebugSession): ProviderResult<vscode.DebugAdapterDescriptor> {
		return new vscode.DebugAdapterInlineImplementation(new PythonCppDebugSession());
	}
}
