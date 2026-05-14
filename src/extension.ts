/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import { activatePythonCppDebug } from './activatePythonCppDebug';
import { logger } from './logger';

let extPy;
let extCpp;

export async function activate(context: vscode.ExtensionContext) {
	// run the debug adapter inside the extension and directly talk to it
	
	logger.divider('Python C++ Debug Extension Activated');
	logger.info('Extension activation started', 'Extension');

	// Check if the user has the extension installed and if so, activate them
	extPy = vscode.extensions.getExtension("ms-python.python");

	// Only accept the official cpptools or the anysphere provider
	extCpp = vscode.extensions.getExtension("ms-vscode.cpptools") || vscode.extensions.getExtension("anysphere.cpptools");

	if(!extPy){
		logger.error('Python extension (ms-python.python) not found!', 'Extension');
		vscode.window.showErrorMessage("You must have the official Python extension to use this debugger!");
		return;
	}
	logger.info('Python extension found: ms-python.python', 'Extension');
    
	if(!extCpp){
		logger.error('C++ extension (ms-vscode.cpptools or compatible) not found!', 'Extension');
		vscode.window.showErrorMessage("You must have the C++ tools extension (ms-vscode.cpptools or a compatible provider) to use this debugger!");
		return;
	}
	logger.info(`C++ extension found: ${extCpp.id}`, 'Extension');
	
	if(!extPy.isActive){
		logger.info('Activating Python extension...', 'Extension');
		await extPy.activate();
		logger.info('Python extension activated', 'Extension');
	} else {
		logger.info('Python extension already active', 'Extension');
	}
	
	if(!extCpp.isActive){
		logger.info('Activating C++ extension...', 'Extension');
		await extCpp.activate();
		logger.info('C++ extension activated', 'Extension');
	} else {
		logger.info('C++ extension already active', 'Extension');
	}
			
	activatePythonCppDebug(context);
	
	logger.info('Extension activation completed successfully', 'Extension');
	logger.show();
}

export function deactivate() {
	logger.info('Extension deactivated', 'Extension');
}


