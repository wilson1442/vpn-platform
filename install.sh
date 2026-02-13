#!/usr/bin/env bash
#
# VPN Platform Installation Script
# ---------------------------------
# Interactive installer for setting up the VPN Platform
#

set -e

# If script is being piped (stdin is not a terminal), download and re-execute with TTY
if [ ! -t 0 ]; then
    SCRIPT_URL="https://raw.githubusercontent.com/wilson1442/vpn-platform/main/install.sh"
    TEMP_SCRIPT=$(mktemp)
    curl -fsSL "$SCRIPT_URL" -o "$TEMP_SCRIPT"
    chmod +x "$TEMP_SCRIPT"
    # Re-execute with stdin from terminal
    exec bash "$TEMP_SCRIPT" "$@" < /dev/tty
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Defaults
INSTALL_DIR="/opt/vpn-platform"
LOG_FILE="${INSTALL_DIR}/install-notes.log"
REPO_URL="https://github.com/wilson1442/vpn-platform.git"

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
    # Only log if the log file directory exists
    if [ -d "$(dirname "$LOG_FILE")" ]; then
        echo "[$timestamp] $1" >> "$LOG_FILE"
    fi
}

log_masked() {
    local key="$1"
    local value="$2"
    local masked="${value:0:8}********"
    log "$key: $masked"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
    if [ -d "$(dirname "$LOG_FILE")" ]; then
        log "INFO: $1"
    fi
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
    if [ -d "$(dirname "$LOG_FILE")" ]; then
        log "SUCCESS: $1"
    fi
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
    if [ -d "$(dirname "$LOG_FILE")" ]; then
        log "WARNING: $1"
    fi
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    if [ -d "$(dirname "$LOG_FILE")" ]; then
        log "ERROR: $1"
    fi
}

fatal() {
    error "$1"
    exit 1
}

prompt() {
    local var_name="$1"
    local prompt_text="$2"
    local default_value="$3"
    local is_secret="${4:-false}"

    if [ -n "$default_value" ]; then
        prompt_text="${prompt_text} [${default_value}]"
    fi

    echo -en "${CYAN}${prompt_text}: ${NC}"

    if [ "$is_secret" = "true" ]; then
        read -s value
        echo
    else
        read value
    fi

    if [ -z "$value" ] && [ -n "$default_value" ]; then
        value="$default_value"
    fi

    eval "$var_name=\"$value\""
}

prompt_confirm() {
    local prompt_text="$1"
    local default="${2:-y}"

    if [ "$default" = "y" ]; then
        prompt_text="${prompt_text} [Y/n]"
    else
        prompt_text="${prompt_text} [y/N]"
    fi

    echo -en "${CYAN}${prompt_text}: ${NC}"
    read answer

    if [ -z "$answer" ]; then
        answer="$default"
    fi

    case "$answer" in
        [Yy]* ) return 0 ;;
        * ) return 1 ;;
    esac
}

validate_domain() {
    local domain="$1"
    if [[ "$domain" =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
        return 0
    fi
    return 1
}

validate_email() {
    local email="$1"
    if [[ "$email" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
        return 0
    fi
    return 1
}

validate_password() {
    local password="$1"
    if [ ${#password} -ge 8 ]; then
        return 0
    fi
    return 1
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
        OS_VERSION=$VERSION_ID
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

            # Update package list
            apt-get update -qq

            # Install basic dependencies
            apt-get install -y -qq curl git openssl ca-certificates gnupg lsb-release

            # Install Node.js 20 if not present
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

            # Install pnpm
            if ! command -v pnpm &> /dev/null; then
                info "Installing pnpm..."
                npm install -g pnpm
                success "pnpm installed"
            else
                info "pnpm already installed"
            fi

            # Install PostgreSQL
            if ! command -v psql &> /dev/null; then
                info "Installing PostgreSQL..."
                apt-get install -y -qq postgresql postgresql-contrib
                systemctl start postgresql
                systemctl enable postgresql
                success "PostgreSQL installed"
            else
                info "PostgreSQL already installed"
            fi

            # Install Redis
            if ! command -v redis-server &> /dev/null; then
                info "Installing Redis..."
                apt-get install -y -qq redis-server
                systemctl start redis-server
                systemctl enable redis-server
                success "Redis installed"
            else
                info "Redis already installed"
            fi
            ;;

        centos|rhel|fedora|rocky|almalinux)
            info "Detected RHEL/CentOS/Fedora system"

            # Install basic dependencies
            if command -v dnf &> /dev/null; then
                dnf install -y -q curl git openssl ca-certificates
            else
                yum install -y -q curl git openssl ca-certificates
            fi

            # Install Node.js 20
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

            # Install pnpm
            if ! command -v pnpm &> /dev/null; then
                info "Installing pnpm..."
                npm install -g pnpm
                success "pnpm installed"
            fi

            # Install PostgreSQL
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

            # Install Redis
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
            warn "Unknown OS: $os. Please install dependencies manually:"
            echo "  - curl, git, openssl"
            echo "  - Node.js v20+"
            echo "  - pnpm"
            echo "  - PostgreSQL"
            echo "  - Redis"

            if ! prompt_confirm "Continue anyway?" "n"; then
                exit 1
            fi
            ;;
    esac

    success "System dependencies installed"
}

check_prerequisites() {
    info "Verifying prerequisites..."

    local missing=()

    # Check for curl
    if ! command -v curl &> /dev/null; then
        missing+=("curl")
    fi

    # Check for git
    if ! command -v git &> /dev/null; then
        missing+=("git")
    fi

    # Check for openssl
    if ! command -v openssl &> /dev/null; then
        missing+=("openssl")
    fi

    # Check for Node.js
    if ! command -v node &> /dev/null; then
        missing+=("node (v20+)")
    else
        node_version=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$node_version" -lt 20 ]; then
            missing+=("node (v20+ required, found v$node_version)")
        fi
    fi

    # Check for pnpm
    if ! command -v pnpm &> /dev/null; then
        missing+=("pnpm")
    fi

    # Check for PostgreSQL
    if ! command -v psql &> /dev/null; then
        missing+=("postgresql")
    fi

    # Check for Redis
    if ! command -v redis-server &> /dev/null && ! command -v redis-cli &> /dev/null; then
        missing+=("redis")
    fi

    if [ ${#missing[@]} -gt 0 ]; then
        error "Missing prerequisites after installation:"
        for item in "${missing[@]}"; do
            echo -e "  ${RED}- $item${NC}"
        done
        echo
        fatal "Please install the missing prerequisites and run this script again."
    fi

    success "All prerequisites verified"
}

setup_database() {
    info "Setting up PostgreSQL database..."

    # Create database user and database
    sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';" 2>/dev/null || true
    sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};" 2>/dev/null || true
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};" 2>/dev/null || true

    success "Database configured"
}

clone_repository() {
    info "Setting up repository..."

    if [ -d "$INSTALL_DIR" ] && [ -f "${INSTALL_DIR}/package.json" ]; then
        info "Repository already exists at ${INSTALL_DIR}"

        cd "$INSTALL_DIR"

        if prompt_confirm "Update to latest version?" "y"; then
            info "Pulling latest changes..."
            git fetch origin
            git pull origin main
            success "Repository updated"
        fi
    elif [ -d "$INSTALL_DIR" ]; then
        # Directory exists but isn't a valid repo
        warn "Directory ${INSTALL_DIR} exists but is not a valid installation"

        if prompt_confirm "Remove and re-clone?" "y"; then
            rm -rf "$INSTALL_DIR"
            info "Cloning repository to ${INSTALL_DIR}..."
            git clone "$REPO_URL" "$INSTALL_DIR"
            success "Repository cloned"
        else
            fatal "Cannot continue without a valid repository"
        fi
    else
        info "Cloning repository to ${INSTALL_DIR}..."

        # Create parent directory if needed
        mkdir -p "$(dirname "$INSTALL_DIR")"

        # Clone the repository
        git clone "$REPO_URL" "$INSTALL_DIR"

        success "Repository cloned"
    fi

    cd "$INSTALL_DIR"

    # Initialize log file now that directory exists
    echo "=== VPN Platform Installation Log ===" > "$LOG_FILE"
    log "Installation started"
    log "Working directory: $INSTALL_DIR"
}

collect_configuration() {
    echo
    echo -e "${BOLD}=== Installation Configuration ===${NC}"
    echo

    # Domain
    while true; do
        prompt DOMAIN "Enter your domain (e.g., vpn.example.com)" ""
        if validate_domain "$DOMAIN"; then
            break
        fi
        error "Invalid domain format. Please enter a valid domain."
    done
    log "Domain: $DOMAIN"

    echo
    echo -e "${BOLD}=== SMTP Configuration ===${NC}"
    echo

    prompt SMTP_HOST "SMTP Host" "localhost"
    prompt SMTP_PORT "SMTP Port" "587"

    while true; do
        prompt SMTP_FROM "SMTP From Email" "noreply@${DOMAIN}"
        if validate_email "$SMTP_FROM"; then
            break
        fi
        error "Invalid email format."
    done

    if prompt_confirm "Configure SMTP authentication?" "n"; then
        prompt SMTP_USER "SMTP Username" ""
        prompt SMTP_PASS "SMTP Password" "" "true"
    else
        SMTP_USER=""
        SMTP_PASS=""
    fi

    log "SMTP Host: $SMTP_HOST"
    log "SMTP Port: $SMTP_PORT"
    log "SMTP From: $SMTP_FROM"
    log "SMTP User: ${SMTP_USER:-<not configured>}"
    if [ -n "$SMTP_PASS" ]; then
        log_masked "SMTP Password" "$SMTP_PASS"
    fi

    echo
    echo -e "${BOLD}=== Admin Account ===${NC}"
    echo

    while true; do
        prompt ADMIN_EMAIL "Admin Email" ""
        if validate_email "$ADMIN_EMAIL"; then
            break
        fi
        error "Invalid email format."
    done

    while true; do
        prompt ADMIN_PASSWORD "Admin Password (min 8 characters)" "" "true"
        if validate_password "$ADMIN_PASSWORD"; then
            prompt ADMIN_PASSWORD_CONFIRM "Confirm Password" "" "true"
            if [ "$ADMIN_PASSWORD" = "$ADMIN_PASSWORD_CONFIRM" ]; then
                break
            fi
            error "Passwords do not match."
        else
            error "Password must be at least 8 characters."
        fi
    done

    log "Admin Email: $ADMIN_EMAIL"
    log_masked "Admin Password" "$ADMIN_PASSWORD"

    echo
    echo -e "${BOLD}=== Database Configuration ===${NC}"
    echo

    if prompt_confirm "Auto-generate database credentials? (Recommended)" "y"; then
        DB_USER="vpn"
        DB_PASS=$(generate_password)
        DB_NAME="vpn_platform"
        info "Database credentials will be auto-generated"
    else
        prompt DB_USER "Database Username" "vpn"
        prompt DB_PASS "Database Password" "" "true"
        prompt DB_NAME "Database Name" "vpn_platform"
    fi

    DB_HOST="localhost"

    log "Database User: $DB_USER"
    log_masked "Database Password" "$DB_PASS"
    log "Database Name: $DB_NAME"
    log "Database Host: $DB_HOST"

    echo
    echo -e "${BOLD}=== Generating Secrets ===${NC}"
    echo

    info "Generating secure secrets..."

    JWT_ACCESS_SECRET=$(generate_secret 48 base64)
    JWT_REFRESH_SECRET=$(generate_secret 48 base64)
    PKI_ENCRYPTION_KEY=$(generate_secret 32 hex)

    log_masked "JWT_ACCESS_SECRET" "$JWT_ACCESS_SECRET"
    log_masked "JWT_REFRESH_SECRET" "$JWT_REFRESH_SECRET"
    log_masked "PKI_ENCRYPTION_KEY" "$PKI_ENCRYPTION_KEY"

    success "Secrets generated"
}

create_env_file() {
    info "Creating .env file..."

    cat > "${INSTALL_DIR}/.env" << EOF
# Database
DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:5432/${DB_NAME}

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_ACCESS_SECRET=${JWT_ACCESS_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}

# Encryption key for private keys at rest (32 bytes hex)
PKI_ENCRYPTION_KEY=${PKI_ENCRYPTION_KEY}

# Mail
SMTP_HOST=${SMTP_HOST}
SMTP_PORT=${SMTP_PORT}
SMTP_FROM=${SMTP_FROM}
EOF

    if [ -n "$SMTP_USER" ]; then
        echo "SMTP_USER=${SMTP_USER}" >> "${INSTALL_DIR}/.env"
        echo "SMTP_PASS=${SMTP_PASS}" >> "${INSTALL_DIR}/.env"
    fi

    cat >> "${INSTALL_DIR}/.env" << EOF

# Stripe (configure later)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Frontend
NEXT_PUBLIC_API_URL=https://${DOMAIN}/api
EOF

    success ".env file created"
    log "Created .env file"
}

install_application() {
    info "Starting application installation..."
    log "=== Application Installation Started ==="

    cd "$INSTALL_DIR"

    # Install dependencies
    info "Installing Node.js dependencies (this may take a few minutes)..."
    log "Running: pnpm install"

    if pnpm install 2>&1 | tee -a "$LOG_FILE"; then
        success "Dependencies installed"
    else
        fatal "Failed to install dependencies"
    fi

    # Generate Prisma client
    info "Generating Prisma client..."
    log "Running: pnpm db:generate"

    if pnpm db:generate 2>&1 | tee -a "$LOG_FILE"; then
        success "Prisma client generated"
    else
        fatal "Failed to generate Prisma client"
    fi

    # Run migrations
    info "Running database migrations..."
    log "Running: pnpm db:migrate"

    if pnpm db:migrate 2>&1 | tee -a "$LOG_FILE"; then
        success "Migrations completed"
    else
        fatal "Failed to run migrations"
    fi

    # Build
    info "Building application (this may take several minutes)..."
    log "Running: pnpm build"

    if pnpm build 2>&1 | tee -a "$LOG_FILE"; then
        success "Build completed"
    else
        fatal "Failed to build application"
    fi

    # Create admin user
    info "Creating admin user..."
    log "Creating admin user: $ADMIN_EMAIL"

    cd "${INSTALL_DIR}/apps/api"

    local seed_script="
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

async function main() {
    const prisma = new PrismaClient();
    const hash = await bcrypt.hash('${ADMIN_PASSWORD}', 10);

    await prisma.user.upsert({
        where: { email: '${ADMIN_EMAIL}' },
        update: {},
        create: {
            email: '${ADMIN_EMAIL}',
            password: hash,
            role: 'ADMIN',
        },
    });

    console.log('Admin user created');
    await prisma.\$disconnect();
}

main().catch(console.error);
"

    if node -e "$seed_script" 2>&1 | tee -a "$LOG_FILE"; then
        success "Admin user created"
    else
        warn "Failed to create admin user. You may need to create it manually."
    fi

    cd "$INSTALL_DIR"

    log "=== Application Installation Completed ==="
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

    # Web Service
    cat > /etc/systemd/system/vpn-web.service << EOF
[Unit]
Description=VPN Platform Web
After=network.target vpn-api.service

[Service]
Type=simple
User=root
WorkingDirectory=${INSTALL_DIR}/apps/web
ExecStart=/usr/bin/node .next/standalone/server.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3100

[Install]
WantedBy=multi-user.target
EOF

    # Reload systemd and enable services
    systemctl daemon-reload
    systemctl enable vpn-api vpn-web

    # Start services
    info "Starting services..."
    systemctl start vpn-api
    sleep 3
    systemctl start vpn-web

    success "Systemd services created and started"
}

print_summary() {
    echo
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                              ║${NC}"
    echo -e "${GREEN}║               Installation Complete!                         ║${NC}"
    echo -e "${GREEN}║                                                              ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo
    echo -e "${BOLD}Access your VPN Platform:${NC}"
    echo -e "  URL: ${CYAN}https://${DOMAIN}${NC}"
    echo -e "  Admin Email: ${CYAN}${ADMIN_EMAIL}${NC}"
    echo
    echo -e "${BOLD}Installation Details:${NC}"
    echo -e "  Directory: ${CYAN}${INSTALL_DIR}${NC}"
    echo -e "  Log File: ${CYAN}${LOG_FILE}${NC}"
    echo
    echo -e "${BOLD}Service Commands:${NC}"
    echo -e "  Status:  ${CYAN}systemctl status vpn-api vpn-web${NC}"
    echo -e "  Restart: ${CYAN}systemctl restart vpn-api vpn-web${NC}"
    echo -e "  Logs:    ${CYAN}journalctl -u vpn-api -f${NC}"
    echo
    echo -e "${YELLOW}IMPORTANT:${NC}"
    echo -e "  - Configure your reverse proxy (nginx/caddy) to point to this server"
    echo -e "  - Set up SSL certificates for ${DOMAIN}"
    echo -e "  - API runs on port 3000, Web runs on port 3100"
    echo -e "  - Review and update SMTP settings if needed"
    echo -e "  - Configure Stripe keys in .env for payment processing"
    echo

    log "=== Installation Summary ==="
    log "URL: https://${DOMAIN}"
    log "Admin Email: ${ADMIN_EMAIL}"
    log "Installation completed successfully"
}

# Main execution
main() {
    # Check if running as root
    if [ "$EUID" -ne 0 ]; then
        fatal "This script must be run as root. Please use: sudo bash install.sh"
    fi

    print_banner

    # Collect configuration
    collect_configuration

    # Install system dependencies
    install_dependencies

    # Clone or update repository
    clone_repository

    # Verify prerequisites after installation
    check_prerequisites

    # Setup database
    setup_database

    # Create .env file
    create_env_file

    echo
    echo -e "${BOLD}=== Starting Installation ===${NC}"
    echo

    # Install application
    install_application

    # Create and start systemd services
    create_systemd_services

    # Print summary
    print_summary
}

# Run main
main "$@"
