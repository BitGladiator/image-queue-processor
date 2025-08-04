# 🖼️ Image Queue Processor

A powerful and modern image processing pipeline that merges the strengths of **C++**, **Python**, and **Node.js** to deliver an asynchronous, scalable, and real-time image transformation system. Whether you're uploading photos to be filtered or tracking job statuses live — this project shows how multiple technologies can seamlessly work together in a production-ready architecture.

---

## 🚀 What It Does

- 🌐 Users can upload an image and select a processing filter via a simple web UI
- ⚙️ The request is sent to a Redis-backed queue using **BullMQ**
- 🖥️ A **Node.js worker** picks up the job and invokes a high-performance **C++ script** to apply the image filter
- 🗂️ The processed image is saved and can be viewed/downloaded
- 🔁 All this happens asynchronously using queues — keeping the UI fast and responsive

---

## 🧰 Tech Stack

| Layer        | Tech                           |
|--------------|--------------------------------|
| Web UI       | Flask (Python), HTML + Jinja2  |
| Queue        | BullMQ (Node.js) + Redis       |
| Processing   | C++ with OpenCV                |
| Metrics      | Prometheus (Optional)          |
| DevOps       | Docker & Docker Compose        |

---

## 📸 Screenshots

### 🏠 Home Page – Upload Interface

Users can upload an image and choose a filter from a dropdown menu.

![Home Page](./refimages/ScreenShot1.png)

---

### ✅ Job Completed – Result Display

After processing, the filtered image is displayed on a result page with a download option.

![Completed Page](./refimages/Screenshot2.png)

---

## 🐳 Running the Project

Ensure Docker and CMake are installed. Then run:

```bash
# From the root directory
./scripts/run_all.sh
````

This will:

* Build the C++ processor
* Start Redis, Flask app, and Node queue services
* Make the app available at [http://localhost:5000](http://localhost:5000)

---

## 📂 Folder Structure

```
image-queue-processor/
├── flask/           # Flask app and templates
├── node/            # BullMQ producer and consumer
├── cpp/             # C++ OpenCV processor
│   └── build/       # CMake build output
├── redis/           # Optional redis.conf
├── scripts/         # run_all.sh to start the full stack
├── docker-compose.yml
├── Dockerfile.flask
├── Dockerfile.node
```

---

## 🛠 Filters Supported

* Grayscale
* Blur
* Edge Detection
  *(Easily extendable with new filters in `processor.cpp`)*

---

## 📌 Future Improvements

* Integrate **Grafana + Prometheus** for real-time monitoring
* Add image history, download buttons, and login/auth support
* Deploy on cloud (e.g., Render, Fly.io, or GCP)

---

## 👨‍💻 Author

MIT License
Made with ❤️ by [Karan Sharma](https://github.com/BitGladiator)

