#include <iostream>

// Use extern "C" to prevent C++ name mangling, ensuring Python ctypes can find the functions
extern "C" {

// Addition function
int add(int x, int y) {
    int result = x + y;  // Set breakpoint here for debugging
    return result;
}

// Fibonacci sequence function
int fibonacci(int n) {
    if (n <= 0) return 0;
    if (n == 1) return 1;
    
    int a = 0, b = 1, temp;
    for (int i = 2; i <= n; i++) {
        temp = a + b;  // Set breakpoint here to observe variable changes in the loop
        a = b;
        b = temp;
    }
    return b;
}
}  // extern "C"


// Only for standalone compilation testing
int main(int argc, char* argv[]) {
    std::cout << "Testing C++ functions:" << std::endl;
    std::cout << "add(5, 7) = " << add(5, 7) << std::endl;
    std::cout << "fibonacci(10) = " << fibonacci(10) << std::endl;
    return 0;
}