#!/usr/bin/env bash
#
# VPN Platform Installation Script
# ---------------------------------
# Fully automated installer for the VPN Platform
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Configuration
INSTALL_DIR="/opt/vpn-platform"
LOG_FILE="${INSTALL_DIR}/install-notes.log"
REPO_URL="https://github.com/wilson1442/vpn-platform.git"

# Default credentials
ADMIN_EMAIL="admin@vpn.com"
ADMIN_PASSWORD='admin123!@#'

# Auto-generated values
DB_USER="vpn"
DB_NAME="vpn_platform"

# Functions
print_banner() {
    echo -e "${CYAN}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                                                              ║"
    echo "║              VPN Platform Installation Script                ║"
    echo "║                                                              ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

log() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    if [ -d "$(dirname "$LOG_FILE")" ]; then
        echo "[$timestamp] $1" >> "$LOG_FILE"
    fi
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
    log "INFO: $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
    log "SUCCESS: $1"
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
    log "WARNING: $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    log "ERROR: $1"
}

fatal() {
    error "$1"
    exit 1
}

generate_secret() {
    local length="${1:-48}"
    local format="${2:-base64}"

    if [ "$format" = "hex" ]; then
        openssl rand -hex "$length"
    else
        openssl rand -base64 "$length" | tr -d '\n'
    fi
}

generate_password() {
    openssl rand -base64 24 | tr -d '\n/+=' | head -c 24
}

detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
    elif [ -f /etc/redhat-release ]; then
        OS="rhel"
    elif [ -f /etc/debian_version ]; then
        OS="debian"
    else
        OS="unknown"
    fi
    echo "$OS"
}

install_dependencies() {
    info "Installing system dependencies..."

    local os=$(detect_os)

    case "$os" in
        ubuntu|debian)
            info "Detected Debian/Ubuntu system"
            export DEBIAN_FRONTEND=noninteractive

            apt-get update -qq

            apt-get install -y -qq curl git openssl ca-certificates gnupg lsb-release

            if ! command -v node &> /dev/null; then
                info "Installing Node.js 20..."
                curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
                apt-get install -y -qq nodejs
                success "Node.js installed"
            else
                node_version=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
                if [ "$node_version" -lt 20 ]; then
                    info "Upgrading Node.js to v20..."
                    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
                    apt-get install -y -qq nodejs
                    success "Node.js upgraded"
                else
                    info "Node.js $(node -v) already installed"
                fi
            fi

            if ! command -v pnpm &> /dev/null; then
                info "Installing pnpm..."
                npm install -g pnpm
                success "pnpm installed"
            else
                info "pnpm already installed"
            fi

            if ! command -v psql &> /dev/null; then
                info "Installing PostgreSQL..."
                apt-get install -y -qq postgresql postgresql-contrib
                systemctl start postgresql
                systemctl enable postgresql
                success "PostgreSQL installed"
            else
                info "PostgreSQL already installed"
                systemctl start postgresql 2>/dev/null || true
            fi

            if ! command -v redis-server &> /dev/null; then
                info "Installing Redis..."
                apt-get install -y -qq redis-server
                systemctl start redis-server
                systemctl enable redis-server
                success "Redis installed"
            else
                info "Redis already installed"
                systemctl start redis-server 2>/dev/null || true
            fi
            ;;

        centos|rhel|fedora|rocky|almalinux)
            info "Detected RHEL/CentOS/Fedora system"

            if command -v dnf &> /dev/null; then
                dnf install -y -q curl git openssl ca-certificates
            else
                yum install -y -q curl git openssl ca-certificates
            fi

            if ! command -v node &> /dev/null; then
                info "Installing Node.js 20..."
                curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
                if command -v dnf &> /dev/null; then
                    dnf install -y -q nodejs
                else
                    yum install -y -q nodejs
                fi
                success "Node.js installed"
            fi

            if ! command -v pnpm &> /dev/null; then
                info "Installing pnpm..."
                npm install -g pnpm
                success "pnpm installed"
            fi

            if ! command -v psql &> /dev/null; then
                info "Installing PostgreSQL..."
                if command -v dnf &> /dev/null; then
                    dnf install -y -q postgresql-server postgresql-contrib
                else
                    yum install -y -q postgresql-server postgresql-contrib
                fi
                postgresql-setup --initdb 2>/dev/null || true
                systemctl start postgresql
                systemctl enable postgresql
                success "PostgreSQL installed"
            fi

            if ! command -v redis-server &> /dev/null; then
                info "Installing Redis..."
                if command -v dnf &> /dev/null; then
                    dnf install -y -q redis
                else
                    yum install -y -q redis
                fi
                systemctl start redis
                systemctl enable redis
                success "Redis installed"
            fi
            ;;

        *)
            fatal "Unsupported OS: $os. Please install manually: curl, git, openssl, Node.js 20+, pnpm, PostgreSQL, Redis"
            ;;
    esac

    success "System dependencies installed"
}

setup_database() {
    info "Setting up PostgreSQL database..."

    # Generate database password
    DB_PASS=$(generate_password)

    # Create database user and database
    sudo -u postgres psql -c "DROP DATABASE IF EXISTS ${DB_NAME};" 2>/dev/null || true
    sudo -u postgres psql -c "DROP USER IF EXISTS ${DB_USER};" 2>/dev/null || true
    sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';" 2>/dev/null || true
    sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};" 2>/dev/null || true
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};" 2>/dev/null || true

    success "Database configured"
}

clone_repository() {
    info "Setting up repository..."

    if [ -d "$INSTALL_DIR" ] && [ -f "${INSTALL_DIR}/package.json" ]; then
        info "Repository already exists, updating..."
        cd "$INSTALL_DIR"
        git fetch origin
        git reset --hard origin/main
        success "Repository updated"
    elif [ -d "$INSTALL_DIR" ]; then
        info "Removing invalid installation directory..."
        rm -rf "$INSTALL_DIR"
        info "Cloning repository..."
        git clone "$REPO_URL" "$INSTALL_DIR"
        success "Repository cloned"
    else
        info "Cloning repository..."
        mkdir -p "$(dirname "$INSTALL_DIR")"
        git clone "$REPO_URL" "$INSTALL_DIR"
        success "Repository cloned"
    fi

    cd "$INSTALL_DIR"

    # Initialize log file
    echo "=== VPN Platform Installation Log ===" > "$LOG_FILE"
    log "Installation started"
}

generate_secrets() {
    info "Generating secure secrets..."

    JWT_ACCESS_SECRET=$(generate_secret 48 base64)
    JWT_REFRESH_SECRET=$(generate_secret 48 base64)
    PKI_ENCRYPTION_KEY=$(generate_secret 32 hex)

    success "Secrets generated"
}

create_env_file() {
    info "Creating .env files..."

    # Create root .env
    cat > "${INSTALL_DIR}/.env" << EOF
# Database
DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_ACCESS_SECRET=${JWT_ACCESS_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}

# Encryption key for private keys at rest (32 bytes hex)
PKI_ENCRYPTION_KEY=${PKI_ENCRYPTION_KEY}

# Mail (configure via UI)
SMTP_HOST=localhost
SMTP_PORT=587
SMTP_FROM=noreply@localhost

# Stripe (configure via UI)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3000
EOF

    # Copy to apps that need it
    cp "${INSTALL_DIR}/.env" "${INSTALL_DIR}/apps/api/.env"
    cp "${INSTALL_DIR}/.env" "${INSTALL_DIR}/apps/web/.env"

    success ".env files created"
}

install_application() {
    info "Installing application..."

    cd "$INSTALL_DIR"

    info "Installing Node.js dependencies..."
    pnpm install 2>&1 | tail -5

    info "Generating Prisma client..."
    pnpm db:generate 2>&1 | tail -3

    info "Running database migrations..."
    pnpm db:migrate 2>&1 | tail -3

    info "Building application (this may take a few minutes)..."
    pnpm build 2>&1 | tail -5

    # Copy static files for Next.js standalone build
    info "Preparing standalone web build..."
    if [ -d "${INSTALL_DIR}/apps/web/.next/standalone" ]; then
        cp -r "${INSTALL_DIR}/apps/web/public" "${INSTALL_DIR}/apps/web/.next/standalone/apps/web/" 2>/dev/null || true
        cp -r "${INSTALL_DIR}/apps/web/.next/static" "${INSTALL_DIR}/apps/web/.next/standalone/apps/web/.next/" 2>/dev/null || true
    fi

    success "Application built"

    # Create admin user
    info "Creating admin user..."

    # Create a temporary seed script
    cat > "${INSTALL_DIR}/apps/api/seed-admin.js" << 'SEEDEOF'
const { PrismaClient } = require('@prisma/client');
const argon2 = require('argon2');

async function main() {
    const prisma = new PrismaClient();
    const hash = await argon2.hash(process.env.ADMIN_PASS);

    await prisma.user.upsert({
        where: { email: process.env.ADMIN_EMAIL },
        update: { passwordHash: hash },
        create: {
            username: 'admin',
            email: process.env.ADMIN_EMAIL,
            passwordHash: hash,
            role: 'ADMIN',
        },
    });

    await prisma.$disconnect();
}

main().catch(console.error);
SEEDEOF

    # Run the seed script with pnpm
    cd "${INSTALL_DIR}"
    ADMIN_EMAIL="${ADMIN_EMAIL}" ADMIN_PASS="${ADMIN_PASSWORD}" pnpm --filter api exec node seed-admin.js 2>/dev/null
    rm -f "${INSTALL_DIR}/apps/api/seed-admin.js"

    success "Admin user created"
}

create_systemd_services() {
    info "Creating systemd services..."

    # API Service
    cat > /etc/systemd/system/vpn-api.service << EOF
[Unit]
Description=VPN Platform API
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=root
WorkingDirectory=${INSTALL_DIR}/apps/api
ExecStart=/usr/bin/node dist/main.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

    # Web Service - Next.js standalone in monorepo has server.js in apps/web subdirectory
    cat > /etc/systemd/system/vpn-web.service << EOF
[Unit]
Description=VPN Platform Web
After=network.target vpn-api.service

[Service]
Type=simple
User=root
WorkingDirectory=${INSTALL_DIR}/apps/web/.next/standalone/apps/web
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3100

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable vpn-api vpn-web
    systemctl start vpn-api
    sleep 3
    systemctl start vpn-web

    success "Services started"
}

get_server_ip() {
    # Get local IP - most reliable for private network installations
    local ip=$(hostname -I | awk '{print $1}')

    # Try to get public IP if local IP detection fails
    if [ -z "$ip" ]; then
        ip=$(curl -s --max-time 3 ifconfig.me 2>/dev/null | tr -d '[:space:]')
        # Validate it's an IP (simple check for numbers and dots only)
        if ! echo "$ip" | grep -qE '^[0-9.]+$'; then
            ip=""
        fi
    fi

    # Final fallback
    if [ -z "$ip" ]; then
        ip="localhost"
    fi

    echo "$ip"
}

print_summary() {
    local server_ip=$(get_server_ip)

    echo
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                              ║${NC}"
    echo -e "${GREEN}║               Installation Complete!                         ║${NC}"
    echo -e "${GREEN}║                                                              ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo
    echo -e "${BOLD}Access your VPN Platform:${NC}"
    echo -e "  URL: ${CYAN}http://${server_ip}:3100${NC}"
    echo
    echo -e "${BOLD}Default Admin Credentials:${NC}"
    echo -e "  Email:    ${CYAN}${ADMIN_EMAIL}${NC}"
    echo -e "  Password: ${CYAN}${ADMIN_PASSWORD}${NC}"
    echo
    echo -e "${BOLD}Service Commands:${NC}"
    echo -e "  Status:  ${CYAN}systemctl status vpn-api vpn-web${NC}"
    echo -e "  Restart: ${CYAN}systemctl restart vpn-api vpn-web${NC}"
    echo -e "  Logs:    ${CYAN}journalctl -u vpn-api -f${NC}"
    echo
    echo -e "${BOLD}Installation Directory:${NC} ${CYAN}${INSTALL_DIR}${NC}"
    echo
    echo -e "${YELLOW}Next Steps:${NC}"
    echo -e "  1. Open ${CYAN}http://${server_ip}:3100${NC} in your browser"
    echo -e "  2. Login with the admin credentials above"
    echo -e "  3. Configure your domain, SMTP, and other settings in Admin > Settings"
    echo -e "  4. Set up a reverse proxy (nginx/caddy) with SSL for production"
    echo

    log "Installation completed"
    log "Access URL: http://${server_ip}:3100"
}

# Main execution
main() {
    # Check if running as root
    if [ "$EUID" -ne 0 ]; then
        echo -e "${RED}[ERROR]${NC} This script must be run as root."
        echo "Please run: sudo bash install.sh"
        exit 1
    fi

    print_banner

    info "Starting fully automated installation..."
    echo

    install_dependencies
    clone_repository
    setup_database
    generate_secrets
    create_env_file
    install_application
    create_systemd_services
    print_summary
}

# Run main
main "$@"
