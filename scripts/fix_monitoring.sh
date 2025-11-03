#!/bin/bash

echo "Fixing Prometheus monitoring setup..."

echo "Stopping current containers..."
docker-compose down


echo "Updating Prometheus configuration..."
cat > monitoring/prometheus.yml << EOF
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'flask'
    static_configs:
      - targets: ['flask:5000']
    metrics_path: /metrics
    scrape_interval: 30s
    scrape_timeout: 10s

  - job_name: 'node'
    static_configs:
      - targets: ['node:3000']
    metrics_path: /metrics
    scrape_interval: 30s
    scrape_timeout: 10s

  - job_name: 'redis-exporter'
    static_configs:
      - targets: ['redis-exporter:9121']
    scrape_interval: 30s
EOF


echo "Updating Flask requirements..."
cat > flask/requirements.txt << EOF
Flask==2.3.2
requests==2.31.0
psutil==5.9.5
EOF

echo "Rebuilding and starting services..."
docker-compose up --build -d

echo "Waiting for services to start..."
sleep 30

echo "Checking service health..."
echo "Flask health: $(curl -s http://localhost:5000/health || echo 'Not ready')"
echo "Node health: $(curl -s http://localhost:3000/health || echo 'Not ready')"
echo "Prometheus targets: http://localhost:9090/targets"
echo "Grafana dashboard: http://localhost:3001 (admin/admin)"

echo "Monitoring setup complete!"
echo ""
echo " Access points:"
echo "  - Main App: http://localhost:5000"
echo "  - Node API: http://localhost:3000"  
echo "  - Prometheus: http://localhost:9090"
echo "  - Grafana: http://localhost:3001"
echo ""
echo "Metrics endpoints:"
echo "  - Flask metrics: http://localhost:5000/metrics"
echo "  - Node metrics: http://localhost:3000/metrics"
echo "  - Queue stats: http://localhost:3000/stats"
