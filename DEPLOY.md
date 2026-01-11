# Deploying Wayfinder to Oracle Cloud (Free Forever)

Oracle Cloud's Always Free Tier includes 2 AMD VMs that never expire - perfect for Wayfinder.

## Step 1: Create Oracle Cloud Account

1. Go to [cloud.oracle.com](https://cloud.oracle.com)
2. Click "Sign Up" → Create a free account
3. You'll need a credit card (for verification only, won't be charged)

## Step 2: Create a Free VM

1. Go to **Compute → Instances → Create Instance**
2. Configure:
   - **Name:** `wayfinder`
   - **Image:** Ubuntu 22.04 (Canonical)
   - **Shape:** VM.Standard.E2.1.Micro (Always Free eligible)
   - **Networking:** Create new VCN or use existing
   - **Add SSH key:** Upload your public key or generate one

3. Click **Create**

## Step 3: Open Port 80

1. Go to **Networking → Virtual Cloud Networks**
2. Click your VCN → **Security Lists** → Default Security List
3. **Add Ingress Rule:**
   - Source CIDR: `0.0.0.0/0`
   - Destination Port: `80`
   - Protocol: TCP

## Step 4: Connect to Your VM

```bash
ssh ubuntu@<your-vm-public-ip>
```

## Step 5: Run Setup Script

```bash
# Download and run setup
curl -fsSL https://raw.githubusercontent.com/<your-repo>/main/deploy/oracle-setup.sh | bash

# Log out and back in for docker permissions
exit
ssh ubuntu@<your-vm-public-ip>
```

## Step 6: Deploy Wayfinder

```bash
# Clone your repo
cd /opt
git clone https://github.com/<your-username>/wayfinder.git
cd wayfinder

# Create environment file with your API keys
cat > .env << EOF
TOMTOM_API_KEY=your_tomtom_key_here
HERE_API_KEY=your_here_key_here
EOF

# Build and start
docker-compose up -d --build

# Check logs
docker-compose logs -f
```

## Step 7: Access Your App

Open `http://<your-vm-public-ip>` in your browser!

---

## Useful Commands

```bash
# View logs
docker-compose logs -f

# Restart
docker-compose restart

# Stop
docker-compose down

# Update to latest code
git pull && docker-compose up -d --build
```

## Custom Domain (Optional)

1. Get a free domain from [Freenom](https://freenom.com) or use your own
2. Point DNS A record to your VM's public IP
3. Add HTTPS with Certbot:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

---

## Troubleshooting

**Container won't start:**
```bash
docker-compose logs wayfinder
```

**Can't connect to port 80:**
- Check Oracle Security List has port 80 open
- Check `sudo iptables -L` for local firewall

**API errors:**
- Verify API keys in `.env`
- Check `docker-compose logs` for errors
