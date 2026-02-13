#!/usr/bin/env bash
#
# VPN Platform Installation Script
# ---------------------------------
# Interactive installer for setting up the VPN Platform
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

# Defaults
INSTALL_DIR="/opt/vpn"
LOG_FILE="${INSTALL_DIR}/install-notes.log"
INSTALL_TYPE="docker"

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
    echo "[$timestamp] $1" >> "$LOG_FILE"
}

log_masked() {
    local key="$1"
    local value="$2"
    local masked="${value:0:8}********"
    log "$key: $masked"
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

prompt_choice() {
    local var_name="$1"
    local prompt_text="$2"
    shift 2
    local options=("$@")

    echo -e "${CYAN}${prompt_text}:${NC}"
    local i=1
    for opt in "${options[@]}"; do
        echo -e "  ${BOLD}$i)${NC} $opt"
        ((i++))
    done

    while true; do
        echo -en "${CYAN}Enter choice [1-${#options[@]}]: ${NC}"
        read choice

        if [[ "$choice" =~ ^[0-9]+$ ]] && [ "$choice" -ge 1 ] && [ "$choice" -le "${#options[@]}" ]; then
            eval "$var_name=\"${options[$((choice-1))]}\""
            return 0
        fi

        echo -e "${RED}Invalid choice. Please try again.${NC}"
    done
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

check_prerequisites() {
    info "Checking prerequisites..."

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

    if [ "$INSTALL_TYPE" = "Docker (recommended)" ]; then
        # Check for Docker
        if ! command -v docker &> /dev/null; then
            missing+=("docker")
        fi

        # Check for Docker Compose
        if ! docker compose version &> /dev/null && ! command -v docker-compose &> /dev/null; then
            missing+=("docker-compose")
        fi
    else
        # Native installation requirements
        if ! command -v node &> /dev/null; then
            missing+=("node (v20+)")
        else
            node_version=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
            if [ "$node_version" -lt 20 ]; then
                missing+=("node (v20+ required, found v$node_version)")
            fi
        fi

        if ! command -v pnpm &> /dev/null; then
            missing+=("pnpm")
        fi

        if ! command -v psql &> /dev/null; then
            missing+=("postgresql-client")
        fi
    fi

    if [ ${#missing[@]} -gt 0 ]; then
        error "Missing prerequisites:"
        for item in "${missing[@]}"; do
            echo -e "  ${RED}- $item${NC}"
        done
        echo
        echo -e "${YELLOW}Please install the missing prerequisites and run this script again.${NC}"
        exit 1
    fi

    success "All prerequisites satisfied"
}

collect_configuration() {
    echo
    echo -e "${BOLD}=== Installation Configuration ===${NC}"
    echo

    # Installation type
    prompt_choice INSTALL_TYPE "Select installation type" "Docker (recommended)" "Native"
    log "Installation type: $INSTALL_TYPE"

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

    if [ "$INSTALL_TYPE" = "Docker (recommended)" ]; then
        DB_HOST="postgres"
    else
        prompt DB_HOST "Database Host" "localhost"
    fi

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

# Node Agent
AGENT_API_BASE_URL=http://api:3000

# Frontend
NEXT_PUBLIC_API_URL=https://${DOMAIN}/api
EOF

    success ".env file created"
    log "Created .env file"
}

create_docker_compose_override() {
    info "Creating docker-compose.override.yml..."

    cat > "${INSTALL_DIR}/docker-compose.override.yml" << EOF
version: "3.9"

services:
  postgres:
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASS}
      POSTGRES_DB: ${DB_NAME}

  api:
    environment:
      DATABASE_URL: postgresql://${DB_USER}:${DB_PASS}@postgres:5432/${DB_NAME}
      JWT_ACCESS_SECRET: \${JWT_ACCESS_SECRET}
      JWT_REFRESH_SECRET: \${JWT_REFRESH_SECRET}
      PKI_ENCRYPTION_KEY: \${PKI_ENCRYPTION_KEY}
      SMTP_HOST: ${SMTP_HOST}
      SMTP_PORT: "${SMTP_PORT}"
      SMTP_FROM: ${SMTP_FROM}
EOF

    if [ -n "$SMTP_USER" ]; then
        cat >> "${INSTALL_DIR}/docker-compose.override.yml" << EOF
      SMTP_USER: ${SMTP_USER}
      SMTP_PASS: \${SMTP_PASS}
EOF
    fi

    cat >> "${INSTALL_DIR}/docker-compose.override.yml" << EOF

  web:
    environment:
      NEXT_PUBLIC_API_URL: https://${DOMAIN}/api
EOF

    success "docker-compose.override.yml created"
    log "Created docker-compose.override.yml"
}

install_docker() {
    info "Starting Docker installation..."
    log "=== Docker Installation Started ==="

    cd "$INSTALL_DIR"

    # Create override file for custom configuration
    create_docker_compose_override

    # Pull and build
    info "Building Docker images (this may take several minutes)..."
    log "Running: docker compose build"

    if docker compose build 2>&1 | tee -a "$LOG_FILE"; then
        success "Docker images built"
    else
        fatal "Failed to build Docker images"
    fi

    # Start services
    info "Starting services..."
    log "Running: docker compose up -d"

    if docker compose up -d 2>&1 | tee -a "$LOG_FILE"; then
        success "Services started"
    else
        fatal "Failed to start services"
    fi

    # Wait for services to be healthy
    info "Waiting for services to be healthy..."
    local max_attempts=60
    local attempt=0

    while [ $attempt -lt $max_attempts ]; do
        if docker compose ps | grep -q "healthy"; then
            postgres_healthy=$(docker compose ps postgres 2>/dev/null | grep -c "healthy" || echo "0")
            if [ "$postgres_healthy" -gt 0 ]; then
                success "Services are healthy"
                break
            fi
        fi

        sleep 2
        ((attempt++))
        echo -n "."
    done
    echo

    if [ $attempt -ge $max_attempts ]; then
        warn "Services may not be fully healthy. Continuing anyway..."
    fi

    # Run migrations
    info "Running database migrations..."
    log "Running: docker compose exec api pnpm db:migrate"

    if docker compose exec -T api pnpm db:migrate 2>&1 | tee -a "$LOG_FILE"; then
        success "Migrations completed"
    else
        fatal "Failed to run migrations"
    fi

    # Seed admin user
    info "Creating admin user..."
    log "Creating admin user: $ADMIN_EMAIL"

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

    if docker compose exec -T api node -e "$seed_script" 2>&1 | tee -a "$LOG_FILE"; then
        success "Admin user created"
    else
        warn "Failed to create admin user. You may need to create it manually."
    fi

    log "=== Docker Installation Completed ==="
}

install_native() {
    info "Starting Native installation..."
    log "=== Native Installation Started ==="

    cd "$INSTALL_DIR"

    # Install dependencies
    info "Installing dependencies..."
    log "Running: pnpm install"

    if pnpm install 2>&1 | tee -a "$LOG_FILE"; then
        success "Dependencies installed"
    else
        fatal "Failed to install dependencies"
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
    info "Building application..."
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

    log "=== Native Installation Completed ==="
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
    echo -e "  Type: ${CYAN}${INSTALL_TYPE}${NC}"
    echo -e "  Directory: ${CYAN}${INSTALL_DIR}${NC}"
    echo -e "  Log File: ${CYAN}${LOG_FILE}${NC}"
    echo

    if [ "$INSTALL_TYPE" = "Docker (recommended)" ]; then
        echo -e "${BOLD}Useful Commands:${NC}"
        echo -e "  View logs: ${CYAN}docker compose logs -f${NC}"
        echo -e "  Restart:   ${CYAN}docker compose restart${NC}"
        echo -e "  Stop:      ${CYAN}docker compose down${NC}"
        echo
    else
        echo -e "${BOLD}Starting the Application:${NC}"
        echo -e "  API:  ${CYAN}cd apps/api && pnpm start:prod${NC}"
        echo -e "  Web:  ${CYAN}cd apps/web && pnpm start${NC}"
        echo
    fi

    echo -e "${YELLOW}IMPORTANT:${NC}"
    echo -e "  - Configure your reverse proxy (nginx/caddy) to point to this server"
    echo -e "  - Set up SSL certificates for ${DOMAIN}"
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
    print_banner

    # Initialize log file
    mkdir -p "$(dirname "$LOG_FILE")"
    echo "=== VPN Platform Installation Log ===" > "$LOG_FILE"
    log "Installation started"
    log "Working directory: $INSTALL_DIR"

    # Check if we're in the right directory
    if [ ! -f "${INSTALL_DIR}/package.json" ]; then
        # Try to detect if we're being run from the repo
        SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
        if [ -f "${SCRIPT_DIR}/package.json" ]; then
            INSTALL_DIR="$SCRIPT_DIR"
            LOG_FILE="${INSTALL_DIR}/install-notes.log"
            echo "=== VPN Platform Installation Log ===" > "$LOG_FILE"
            log "Installation started"
            log "Working directory: $INSTALL_DIR"
        else
            fatal "Could not find VPN Platform installation. Please run this script from the project directory."
        fi
    fi

    cd "$INSTALL_DIR"

    # Collect configuration
    collect_configuration

    # Check prerequisites based on installation type
    check_prerequisites

    # Create .env file
    create_env_file

    echo
    echo -e "${BOLD}=== Starting Installation ===${NC}"
    echo

    # Run appropriate installation
    if [ "$INSTALL_TYPE" = "Docker (recommended)" ]; then
        install_docker
    else
        install_native
    fi

    # Print summary
    print_summary
}

# Run main
main "$@"
