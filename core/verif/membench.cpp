#include <iostream>
#include <vector>

const size_t MEMORY_SIZE = 1024 * 1024 * 1024; // 2^30 ints = 4GB
const size_t NUM_RUNS = 100;
const size_t CACHE_LINE_SIZE = 64;
int main() {

    // do something with the written/read values to prevent compiler optimizing the loops out
    volatile long long counter = 0;
    std::vector<int> dram_buffer(MEMORY_SIZE);

    for (int run = 0; run < NUM_RUNS; run++) {

        std::cout << "Run " << run << "\n";
    
        // Write memory 
        for (int i = 0; i < MEMORY_SIZE; ++i) {
            dram_buffer[i] = (i * run) % 1024;
        }
    
        // Read memory while trying to avoid cache hits
        for (int line_idx = 0; line_idx < CACHE_LINE_SIZE / sizeof(int); line_idx++) {
            for (size_t i = 0; i < MEMORY_SIZE; i += 64) { 
                counter += dram_buffer[i];
            }
        }

    }
    return 0;
}
