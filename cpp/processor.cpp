#include <iostream>
#include <string>
#include <opencv2/opencv.hpp>

int main(int argc, char* argv[]) {
    if (argc < 5) {
        std::cerr << "Usage: processor <input> <output> <filter> <intensity>\n";
        return 1;
    }
    std::string inputPath  = argv[1];
    std::string outputPath = argv[2];
    std::string filter     = argv[3];
    int intensity          = std::stoi(argv[4]);

    cv::Mat img = cv::imread(inputPath, cv::IMREAD_COLOR);
    if (img.empty()) {
        std::cerr << "Failed to read input image: " << inputPath << "\n";
        return 2;
    }
    float alpha = intensity / 100.0f;

    cv::Mat out;
    
    if (filter == "grayscale") {
        cv::Mat gray;
        cv::cvtColor(img, gray, cv::COLOR_BGR2GRAY);
        cv::cvtColor(gray, gray, cv::COLOR_GRAY2BGR);
        cv::addWeighted(img, 1.0 - alpha, gray, alpha, 0, out);
        
    } else if (filter == "blur") {
        int kernelSize = 3 + (int)(alpha * 48);
        if (kernelSize % 2 == 0) kernelSize++;
        cv::GaussianBlur(img, out, cv::Size(kernelSize, kernelSize), 0);
        
    } else if (filter == "edge") {
        cv::Mat gray, edges, edgesColor;
        cv::cvtColor(img, gray, cv::COLOR_BGR2GRAY);
        cv::GaussianBlur(gray, gray, cv::Size(5,5), 1.2);
        double threshold1 = 50 + alpha * 100;
        double threshold2 = 100 + alpha * 150;
        cv::Canny(gray, edges, threshold1, threshold2);
        cv::cvtColor(edges, edgesColor, cv::COLOR_GRAY2BGR);
        cv::addWeighted(img, 1.0 - alpha, edgesColor, alpha, 0, out);
        
    } else if (filter == "sharpen") {
        float strength = -1.0f * alpha * 2.0f; 
        cv::Mat kernel = (cv::Mat_<float>(3,3) << 
            0, strength, 0,
            strength, 1 + (-4 * strength), strength,
            0, strength, 0);
        cv::filter2D(img, out, img.depth(), kernel);
        
    } else if (filter == "emboss") {
        cv::Mat gray, emboss, embossColor;
        cv::cvtColor(img, gray, cv::COLOR_BGR2GRAY);
        float s = alpha * 2.0f;
        cv::Mat kernel = (cv::Mat_<float>(3,3) << 
            -s*2, -s, 0,
            -s, 1, s,
            0, s, s*2);
        cv::filter2D(gray, emboss, gray.depth(), kernel);
        emboss = emboss + cv::Scalar(128);
        cv::cvtColor(emboss, embossColor, cv::COLOR_GRAY2BGR);
        cv::addWeighted(img, 1.0 - alpha, embossColor, alpha, 0, out);
        
    } else if (filter == "sepia") {
        cv::Mat sepiaMat;
        float s = alpha;
        cv::Mat kernel = (cv::Mat_<float>(4,4) <<
            0.272*s + (1-s), 0.534*s, 0.131*s, 0,
            0.349*s, 0.686*s + (1-s), 0.168*s, 0,
            0.393*s, 0.769*s, 0.189*s + (1-s), 0,
            0, 0, 0, 1);
        cv::transform(img, out, kernel);
        
    } else if (filter == "negative") {
        cv::Mat negative;
        cv::bitwise_not(img, negative);
        cv::addWeighted(img, 1.0 - alpha, negative, alpha, 0, out);
        
    } else if (filter == "brighten") {
        int brightness = -50 + (int)(alpha * 200);
        img.convertTo(out, -1, 1.0, brightness);
        
    } else {
        std::cerr << "Unknown filter: " << filter << "\n";
        return 3;
    }

    if (!cv::imwrite(outputPath, out)) {
        std::cerr << "Failed to write output image: " << outputPath << "\n";
        return 4;
    }

    std::cout << "Wrote: " << outputPath << " with intensity " << intensity << "%\n";
    return 0;
}