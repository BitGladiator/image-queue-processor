#!/bin/bash

echo "Building C++ Processor..."
cd ../cpp/build || exit
cmake ..
make
cd ../../scripts || exit

echo "Starting Docker containers..."
docker-compose up --build
