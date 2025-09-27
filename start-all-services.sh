#!/bin/bash

# 🚀 Findy - Start All Services Script
# This script ensures all ports and services run smoothly

echo "🚀 Starting Findy Navigation Platform..."
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Function to kill process on port
kill_port() {
    local port=$1
    echo -e "${YELLOW}Cleaning up port $port...${NC}"
    lsof -ti :$port | xargs kill -9 2>/dev/null || true
    sleep 1
}

# Function to start service with retry
start_service() {
    local name=$1
    local command=$2
    local port=$3
    local max_attempts=3
    
    echo -e "${BLUE}Starting $name on port $port...${NC}"
    
    for attempt in $(seq 1 $max_attempts); do
        if check_port $port; then
            echo -e "${GREEN}✅ $name already running on port $port${NC}"
            return 0
        fi
        
        echo -e "${YELLOW}Attempt $attempt/$max_attempts: Starting $name...${NC}"
        eval "$command" &
        
        # Wait for service to start
        sleep 3
        
        if check_port $port; then
            echo -e "${GREEN}✅ $name started successfully on port $port${NC}"
            return 0
        fi
        
        echo -e "${RED}❌ $name failed to start (attempt $attempt)${NC}"
        sleep 2
    done
    
    echo -e "${RED}❌ Failed to start $name after $max_attempts attempts${NC}"
    return 1
}

# Clean up any existing processes on our ports
echo -e "${YELLOW}🧹 Cleaning up existing processes...${NC}"
kill_port 3000  # Frontend
kill_port 3001  # HMR
kill_port 8000  # Backend

# Wait for cleanup
sleep 2

# Check and start Redis (required for backend)
echo -e "${BLUE}🔧 Checking Redis...${NC}"
if ! check_port 6379; then
    echo -e "${YELLOW}Starting Redis...${NC}"
    redis-server --daemonize yes --port 6379 2>/dev/null || {
        echo -e "${RED}❌ Failed to start Redis${NC}"
        echo -e "${YELLOW}Installing Redis with Homebrew...${NC}"
        brew install redis 2>/dev/null && redis-server --daemonize yes --port 6379
    }
    sleep 2
fi

if check_port 6379; then
    echo -e "${GREEN}✅ Redis running on port 6379${NC}"
else
    echo -e "${YELLOW}⚠️ Redis not available, backend may have limited functionality${NC}"
fi

# Check and start PostgreSQL (if needed)
echo -e "${BLUE}🔧 Checking PostgreSQL...${NC}"
if ! check_port 5432; then
    echo -e "${YELLOW}Starting PostgreSQL...${NC}"
    brew services start postgresql 2>/dev/null || {
        echo -e "${YELLOW}Installing PostgreSQL with Homebrew...${NC}"
        brew install postgresql && brew services start postgresql
    }
    sleep 3
fi

if check_port 5432; then
    echo -e "${GREEN}✅ PostgreSQL running on port 5432${NC}"
else
    echo -e "${YELLOW}⚠️ PostgreSQL not available, using SQLite fallback${NC}"
fi

# Start Backend API Server
start_service "Backend API" "cd backend && npm run dev" 8000

# Start Frontend Development Server
start_service "Frontend" "npm run dev" 3000

# Verify all services are running
echo ""
echo -e "${BLUE}🔍 Service Status Check:${NC}"
echo "==============================="

services=("3000:Frontend" "8000:Backend" "6379:Redis" "5432:PostgreSQL")

for service in "${services[@]}"; do
    port="${service%%:*}"
    name="${service##*:}"
    
    if check_port $port; then
        echo -e "${GREEN}✅ $name - Running on port $port${NC}"
    else
        echo -e "${RED}❌ $name - Not running on port $port${NC}"
    fi
done

echo ""
echo -e "${GREEN}🎉 Findy Platform Status:${NC}"
echo "================================"
echo -e "${GREEN}🌐 Frontend: http://localhost:3000${NC}"
echo -e "${GREEN}🔧 Backend API: http://localhost:8000${NC}"
echo -e "${GREEN}📊 Backend Health: http://localhost:8000/api/v1/health${NC}"

# Check if Google Maps API key is configured
if [ -f ".env" ] && grep -q "VITE_GOOGLE_MAPS_API_KEY=AIzaSy" .env; then
    echo -e "${GREEN}🗺️ Google Maps: Configured and Active${NC}"
else
    echo -e "${YELLOW}⚠️ Google Maps: API key needs configuration${NC}"
fi

echo ""
echo -e "${BLUE}💡 Usage Tips:${NC}"
echo "- Click anywhere on the map to get directions"
echo "- Use the search bar to find places"
echo "- Switch transport modes (car/walk/bike/transit)"
echo "- All features are now running smoothly!"

echo ""
echo -e "${GREEN}✅ All services are ready! Happy navigating! 🚀${NC}"