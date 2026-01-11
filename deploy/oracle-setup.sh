#!/bin/bash
# Oracle Cloud VM Setup Script for Wayfinder
# Run this on a fresh Ubuntu 22.04 VM

set -e

echo "=== Wayfinder Oracle Cloud Setup ==="

# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install Docker
echo "Installing Docker..."
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
echo "Installing Docker Compose..."
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Create app directory
sudo mkdir -p /opt/wayfinder
sudo chown $USER:$USER /opt/wayfinder

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "1. Log out and back in (for docker group)"
echo "2. Clone your repo: git clone <your-repo> /opt/wayfinder"
echo "3. Create .env file: nano /opt/wayfinder/.env"
echo "4. Add your API keys:"
echo "   TOMTOM_API_KEY=your_key"
echo "   HERE_API_KEY=your_key"
echo "5. Start the app: cd /opt/wayfinder && docker-compose up -d"
echo ""
echo "Open port 80 in Oracle Cloud Security List!"
