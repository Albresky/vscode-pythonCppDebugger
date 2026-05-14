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
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
const activatePythonCppDebug_1 = require("./activatePythonCppDebug");
const logger_1 = require("./logger");
let extPy;
let extCpp;
function activate(context) {
    return __awaiter(this, void 0, void 0, function* () {
        // run the debug adapter inside the extension and directly talk to it
        logger_1.logger.divider('Python C++ Debug Extension Activated');
        logger_1.logger.info('Extension activation started', 'Extension');
        // Check if the user has the extension installed and if so, activate them
        extPy = vscode.extensions.getExtension("ms-python.python");
        // Only accept the official cpptools or the anysphere provider
        extCpp = vscode.extensions.getExtension("ms-vscode.cpptools") || vscode.extensions.getExtension("anysphere.cpptools");
        if (!extPy) {
            logger_1.logger.error('Python extension (ms-python.python) not found!', 'Extension');
            vscode.window.showErrorMessage("You must have the official Python extension to use this debugger!");
            return;
        }
        logger_1.logger.info('Python extension found: ms-python.python', 'Extension');
        if (!extCpp) {
            logger_1.logger.error('C++ extension (ms-vscode.cpptools or compatible) not found!', 'Extension');
            vscode.window.showErrorMessage("You must have the C++ tools extension (ms-vscode.cpptools or a compatible provider) to use this debugger!");
            return;
        }
        logger_1.logger.info(`C++ extension found: ${extCpp.id}`, 'Extension');
        if (!extPy.isActive) {
            logger_1.logger.info('Activating Python extension...', 'Extension');
            yield extPy.activate();
            logger_1.logger.info('Python extension activated', 'Extension');
        }
        else {
            logger_1.logger.info('Python extension already active', 'Extension');
        }
        if (!extCpp.isActive) {
            logger_1.logger.info('Activating C++ extension...', 'Extension');
            yield extCpp.activate();
            logger_1.logger.info('C++ extension activated', 'Extension');
        }
        else {
            logger_1.logger.info('C++ extension already active', 'Extension');
        }
        activatePythonCppDebug_1.activatePythonCppDebug(context);
        logger_1.logger.info('Extension activation completed successfully', 'Extension');
        logger_1.logger.show();
    });
}
exports.activate = activate;
function deactivate() {
    logger_1.logger.info('Extension deactivated', 'Extension');
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map