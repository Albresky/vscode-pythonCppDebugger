import ctypes
import pathlib
import platform


def get_lib_path():
    base_path = pathlib.Path(__file__).parent
    
    system = platform.system()
    if system == "Linux":
        lib_name = "libexample.so"
    elif system == "Darwin":
        lib_name = "libexample.dylib"
    elif system == "Windows":
        lib_name = "example.dll"
    else:
        raise OSError(f"Unsupported operating system: {system}")
    
    return base_path / lib_name

def load_library():
    lib_path = get_lib_path()
    
    if not lib_path.exists():
        raise FileNotFoundError(
            f"lib not exists: {lib_path}\n"
            f"  cd {lib_path.parent}\n"
            f"  g++ -shared -fPIC -g -o {lib_path.name} cpp.cc"
        )
    
    lib = ctypes.CDLL(str(lib_path))
    
    lib.add.argtypes = (ctypes.c_int, ctypes.c_int)
    lib.add.restype = ctypes.c_int
    
    lib.fibonacci.argtypes = (ctypes.c_int,)
    lib.fibonacci.restype = ctypes.c_int
    return lib

def main():
    print("=" * 50)
    print("Python && C++ co-debug example")
    print("=" * 50)
    
    lib = load_library()
    print(f"Successfully loaded library: {get_lib_path()}")
    print()
    
    # Test add function
    a, b = 5, 7
    result = lib.add(a, b)  # Breakpoint: step into C++ code
    print(f"add({a}, {b}) = {result}")
    
    # Test fibonacci function
    fib_n = 10
    fib_result = lib.fibonacci(fib_n)  # Breakpoint: observe loop
    print(f"fibonacci({fib_n}) = {fib_result}")
    
    print()
    print("=" * 50)
    print("All tests completed!")
    print("=" * 50)


if __name__ == "__main__":
    main()