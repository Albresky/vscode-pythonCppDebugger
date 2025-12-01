# VS Code Python C++ Debug

[English](readme.md) | [中文](readme_zh.md)

This debugger starts a Python debugger and attaches a C++ debugger to it for debugging Python code that calls functions from shared object files (.so/.dll).

![vscode-pythonCpp example](images/pythonCppExample.gif)

## Requirements

To use this debug extension you must have the following extensions installed:
* **Python** by Microsoft (`ms-python.python`)
* **C/C++** by Microsoft (`ms-vscode.cpptools`)
* **CodeLLDB** by Vadim Chugunov (`vadimcn.vscode-lldb`) - *Optional, for LLDB debugging*

## Default Configurations

If you plan to use the default configuration of the Python and/or C++ debugger, you don't need to define them manually.

* **Python:** `pythonConfig: default` will start the Python debugger with the default configuration (Python: Current File)
  
* **C++:** 
  - `cppConfig: default (win) Attach` - Windows debugger (cppvsdbg)
  - `cppConfig: default (gdb) Attach` - GDB debugger (Linux recommended)
  - `cppConfig: default (codelldb) Attach` - CodeLLDB debugger (macOS recommended, also works on Linux)

### Example: Using Default Configuration

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Python C++ Debug",
      "type": "pythoncpp",
      "request": "launch",
      "pythonConfig": "default",
      "cppConfig": "default (gdb) Attach"
    }
  ]
}
```

## Custom Configurations

To manually define the configurations, set `pythonLaunchName` & `cppAttachName` to the name of the configuration you wish to use from your launch.json file.

### Example 1: Windows (cppvsdbg)

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Python C++ Debug",
      "type": "pythoncpp",
      "request": "launch",
      "pythonLaunchName": "Python: Current File",
      "cppAttachName": "(Windows) Attach"
    },
    {
      "name": "(Windows) Attach",
      "type": "cppvsdbg",
      "request": "attach",
      "processId": ""
    },
    {
      "name": "Python: Current File",
      "type": "debugpy",
      "request": "launch",
      "program": "${file}",
      "console": "integratedTerminal"
    }
  ]
}
```

### Example 2: Linux (GDB)

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Python C++ Debug",
      "type": "pythoncpp",
      "request": "launch",
      "pythonLaunchName": "Python: Current File",
      "cppAttachName": "(gdb) Attach"
    },
    {
      "name": "(gdb) Attach",
      "type": "cppdbg",
      "request": "attach",
      "program": "/usr/bin/python3",
      "processId": "",
      "MIMode": "gdb",
      "setupCommands": [
        {
          "description": "Enable pretty-printing for gdb",
          "text": "-enable-pretty-printing",
          "ignoreFailures": true
        }
      ]
    },
    {
      "name": "Python: Current File",
      "type": "debugpy",
      "request": "launch",
      "program": "${file}",
      "console": "integratedTerminal"
    }
  ]
}
```

### Example 3: macOS / Linux (CodeLLDB)

> **Note:** Requires the [CodeLLDB](https://marketplace.visualstudio.com/items?itemName=vadimcn.vscode-lldb) extension.

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Python C++ Debug",
      "type": "pythoncpp",
      "request": "launch",
      "pythonLaunchName": "Python: Current File",
      "cppAttachName": "(codelldb) Attach"
    },
    {
      "name": "(codelldb) Attach",
      "type": "lldb",
      "request": "attach",
      "pid": ""
    },
    {
      "name": "Python: Current File",
      "type": "debugpy",
      "request": "launch",
      "program": "${file}",
      "console": "integratedTerminal"
    }
  ]
}
```

## How It Works

When you start Python C++ Debug, it:
1. Launches a Python debugger with `stopOnEntry` enabled
2. Gets the Python process ID
3. Attaches the C++ debugger to that process
4. Continues Python execution (if `stopOnEntry` wasn't originally set)

## Important Notes

* Make sure the shared object files (.so/.dll) you are loading have been compiled with **debug info** (`-g` flag).
* Between consecutive breakpoints where one is in Python and the other in C++ code, only the **Continue** button will work correctly.
* The **Restart** button isn't supported due to the Python debugger changing its processId after a restart.

## Building from Source

```bash
# Install dependencies
yarn install

# Compile TypeScript
yarn run compile

# Package extension
NODE_OPTIONS=--openssl-legacy-provider vsce package
```
