#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

case "$(uname -s)" in
    Linux*)
        OUTPUT="libexample.so"
        EXTRA_FLAGS="-fPIC"
        ;;
    Darwin*)
        OUTPUT="libexample.dylib"
        EXTRA_FLAGS="-fPIC"
        ;;
    MINGW*|MSYS*|CYGWIN*)
        OUTPUT="example.dll"
        EXTRA_FLAGS=""
        ;;
    *)
        echo "Unknown OS type: $(uname -s)"
        exit 1
        ;;
esac

# Compile commands:
# -g: Include debug information (required for debugging)
# -shared: Create a shared library
# -fPIC: Generate position-independent code (required on Linux/macOS)
# -O0: Disable optimization (easier to debug)
g++ -shared $EXTRA_FLAGS -g -O0 -o "$OUTPUT" cpp.cc

echo "Build completed: $OUTPUT"
echo ""
echo "You can now run python.py to test:"
echo "  python3 python.py"
echo ""
echo "Or use VSCode's 'Python C++ Debug' configuration to debug"