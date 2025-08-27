#include <iostream>
#include <string>
#include <opencv2/opencv.hpp>

int main(int argc, char* argv[]) {
    if (argc < 4) {
        std::cerr << "Usage: processor <input> <output> <filter>\n";
        return 1;
    }
    std::string inputPath  = argv[1];
    std::string outputPath = argv[2];
    std::string filter     = argv[3];

    cv::Mat img = cv::imread(inputPath, cv::IMREAD_COLOR);
    if (img.empty()) {
        std::cerr << "Failed to read input image: " << inputPath << "\n";
        return 2;
    }

    cv::Mat out;
    if (filter == "grayscale") {
        cv::cvtColor(img, out, cv::COLOR_BGR2GRAY);
    } else if (filter == "blur") {
        cv::GaussianBlur(img, out, cv::Size(9, 9), 0);
    } else if (filter == "edge") {
        cv::Mat gray, edges;
        cv::cvtColor(img, gray, cv::COLOR_BGR2GRAY);
        cv::GaussianBlur(gray, gray, cv::Size(5,5), 1.2);
        cv::Canny(gray, edges, 75, 150);
        out = edges;
    } else if (filter == "sharpen") {
        cv::Mat kernel = (cv::Mat_<float>(3,3) << 
            0, -1, 0,
            -1, 5, -1,
            0, -1, 0);
        cv::filter2D(img, out, img.depth(), kernel);
    } else if (filter == "emboss") {
        cv::Mat gray, emboss;
        cv::cvtColor(img, gray, cv::COLOR_BGR2GRAY);
        cv::Mat kernel = (cv::Mat_<float>(3,3) << 
            -2, -1, 0,
            -1, 1, 1,
            0, 1, 2);
        cv::filter2D(gray, emboss, gray.depth(), kernel);
        out = emboss;
    } else if (filter == "sepia") {
        cv::Mat kernel = (cv::Mat_<float>(4,4) <<
            0.272, 0.534, 0.131, 0,
            0.349, 0.686, 0.168, 0,
            0.393, 0.769, 0.189, 0,
            0, 0, 0, 1);
        cv::transform(img, out, kernel);
    } else if (filter == "negative") {
        cv::bitwise_not(img, out);
    } else if (filter == "brighten") {
        img.convertTo(out, -1, 1.0, 50);
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