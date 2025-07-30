#include <iostream>
#include <string>
#include <opencv2/opencv.hpp>
int main(int argc, char* argv[]) {
    if (argc < 4) {
        std::cerr << "Usage: processor <input> <output> <filter>\n";
        return 1;
    }
    std::string inputPath  = argv[1]; //argument-1
    std::string outputPath = argv[2]; //argument-2
    std::string filter     = argv[3]; //argument-3
    cv::Mat img = cv::imread(inputPath, cv::IMREAD_COLOR);
    if (img.empty()) {
        std::cerr << "Failed to read input image: " << inputPath << "\n";
        return 2;
    }
    cv::Mat out;
    if (filter == "grayscale") {
        cv::cvtColor(img, out, cv::COLOR_BGR2GRAY);
        // write single-channel; many viewers are fine, or convert back to 3ch:
        // cv::cvtColor(out, out, cv::COLOR_GRAY2BGR);
    } else if (filter == "blur") {
        // Simple Gaussian blur
        cv::GaussianBlur(img, out, cv::Size(9, 9), 0);
    } else if (filter == "edge") {
        cv::Mat gray, edges;
        cv::cvtColor(img, gray, cv::COLOR_BGR2GRAY);
        cv::GaussianBlur(gray, gray, cv::Size(5,5), 1.2);
        cv::Canny(gray, edges, 75, 150);
        out = edges;
        // Or stack to 3 channels if needed:
        // cv::cvtColor(edges, out, cv::COLOR_GRAY2BGR);
    } else {
        std::cerr << "Unknown filter: " << filter << "\n";
        return 3;
    }
    if (!cv::imwrite(outputPath, out)) {
        std::cerr << "Failed to write output image: " << outputPath << "\n";
        return 4;
    }

    std::cout << "Wrote: " << outputPath << "\n";
    return 0;
}