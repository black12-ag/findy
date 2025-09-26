#!/bin/bash

# 🔍 QA VERIFICATION SCRIPT
# Automated checks for post-implementation quality assurance

echo "================================================"
echo "🔍 PathFinder Pro - QA Verification Starting..."
echo "================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
ISSUES_FOUND=()

# Function to check and report
check_item() {
    local description=$1
    local command=$2
    local expected=$3
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    result=$(eval "$command" 2>/dev/null)
    
    if [[ "$result" == *"$expected"* ]] || [[ $? -eq 0 ]]; then
        echo -e "${GREEN}✅ PASS${NC}: $description"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
    else
        echo -e "${RED}❌ FAIL${NC}: $description"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
        ISSUES_FOUND+=("$description")
    fi
}

echo ""
echo "1️⃣ CHECKING FOR MOCK DATA & DEBUG CODE..."
echo "----------------------------------------"

# Check for console.log statements
CONSOLE_LOGS=$(grep -r "console.log" src/ --include="*.tsx" --include="*.ts" 2>/dev/null | wc -l)
if [ $CONSOLE_LOGS -eq 0 ]; then
    echo -e "${GREEN}✅ No console.log statements found${NC}"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
else
    echo -e "${RED}❌ Found $CONSOLE_LOGS console.log statements${NC}"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
    ISSUES_FOUND+=("$CONSOLE_LOGS console.log statements remaining")
fi
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

# Check for alert() calls
ALERTS=$(grep -r "alert(" src/ --include="*.tsx" --include="*.ts" 2>/dev/null | wc -l)
if [ $ALERTS -eq 0 ]; then
    echo -e "${GREEN}✅ No alert() calls found${NC}"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
else
    echo -e "${RED}❌ Found $ALERTS alert() calls${NC}"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
    ISSUES_FOUND+=("$ALERTS alert() calls remaining")
fi
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

# Check for mock/dummy/fake keywords
MOCK_DATA=$(grep -r -E "(mock|dummy|fake|placeholder)" src/ --include="*.tsx" --include="*.ts" 2>/dev/null | wc -l)
if [ $MOCK_DATA -eq 0 ]; then
    echo -e "${GREEN}✅ No mock data keywords found${NC}"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
else
    echo -e "${YELLOW}⚠️  Found $MOCK_DATA potential mock data references${NC}"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
    ISSUES_FOUND+=("$MOCK_DATA mock data references")
fi
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

# Check for TODO/FIXME comments
TODOS=$(grep -r -E "(TODO|FIXME)" src/ --include="*.tsx" --include="*.ts" 2>/dev/null | wc -l)
if [ $TODOS -eq 0 ]; then
    echo -e "${GREEN}✅ No TODO/FIXME comments found${NC}"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
else
    echo -e "${YELLOW}⚠️  Found $TODOS TODO/FIXME comments${NC}"
    ISSUES_FOUND+=("$TODOS TODO/FIXME comments")
fi
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

echo ""
echo "2️⃣ CHECKING API KEY SECURITY..."
echo "--------------------------------"

# Check for hardcoded API keys in source
API_KEYS=$(grep -r "eyJvcmci src/ --include="*.tsx" --include="*.ts" 2>/dev/null | wc -l)
if [ $API_KEYS -eq 0 ]; then
    echo -e "${GREEN}✅ No hardcoded API keys in source${NC}"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
else
    echo -e "${RED}❌ CRITICAL: Found $API_KEYS hardcoded API keys!${NC}"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
    ISSUES_FOUND+=("CRITICAL: $API_KEYS hardcoded API keys")
fi
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

# Check if .env file exists
if [ -f ".env" ]; then
    echo -e "${GREEN}✅ .env file exists${NC}"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
else
    echo -e "${RED}❌ .env file missing${NC}"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
    ISSUES_FOUND+=(".env file missing")
fi
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

# Check if .env is in .gitignore
if grep -q "^.env$" .gitignore 2>/dev/null; then
    echo -e "${GREEN}✅ .env is in .gitignore${NC}"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
else
    echo -e "${RED}❌ .env not in .gitignore - security risk!${NC}"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
    ISSUES_FOUND+=(".env not in .gitignore")
fi
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

echo ""
echo "3️⃣ CHECKING FILE STRUCTURE..."
echo "------------------------------"

# Check for critical service files
SERVICES=("directionsService" "geocodingService" "poisService" "geolocationService" "auth" "storageService")
for service in "${SERVICES[@]}"; do
    if [ -f "src/services/${service}.ts" ]; then
        echo -e "${GREEN}✅ ${service}.ts exists${NC}"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
    else
        echo -e "${RED}❌ ${service}.ts missing${NC}"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
        ISSUES_FOUND+=("${service}.ts missing")
    fi
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
done

echo ""
echo "4️⃣ CHECKING COMPONENTS..."
echo "--------------------------"

# Check for critical components
COMPONENTS=("SearchPanel" "NavigationPanel" "SavedPlacesPanel" "ProfilePanel" "MapView" "SettingsPanel")
for component in "${COMPONENTS[@]}"; do
    if [ -f "src/components/${component}.tsx" ]; then
        echo -e "${GREEN}✅ ${component}.tsx exists${NC}"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
    else
        echo -e "${RED}❌ ${component}.tsx missing${NC}"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
        ISSUES_FOUND+=("${component}.tsx missing")
    fi
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
done

echo ""
echo "5️⃣ CHECKING BACKEND..."
echo "-----------------------"

# Check if backend directory exists
if [ -d "backend" ]; then
    echo -e "${GREEN}✅ Backend directory exists${NC}"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
    
    # Check for backend package.json
    if [ -f "backend/package.json" ]; then
        echo -e "${GREEN}✅ Backend package.json exists${NC}"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
    else
        echo -e "${RED}❌ Backend package.json missing${NC}"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
        ISSUES_FOUND+=("Backend package.json missing")
    fi
    
    # Check for Prisma schema
    if [ -f "backend/prisma/schema.prisma" ]; then
        echo -e "${GREEN}✅ Prisma schema exists${NC}"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
    else
        echo -e "${YELLOW}⚠️  Prisma schema not found${NC}"
        ISSUES_FOUND+=("Prisma schema missing")
    fi
else
    echo -e "${YELLOW}⚠️  Backend directory not found${NC}"
    ISSUES_FOUND+=("Backend directory missing")
fi
TOTAL_CHECKS=$((TOTAL_CHECKS + 3))

echo ""
echo "6️⃣ CHECKING BUILD..."
echo "--------------------"

# Check if build directory exists
if [ -d "build" ]; then
    echo -e "${GREEN}✅ Build directory exists${NC}"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
    
    # Check build size
    BUILD_SIZE=$(du -sh build | cut -f1)
    echo -e "${BLUE}ℹ️  Build size: $BUILD_SIZE${NC}"
else
    echo -e "${YELLOW}⚠️  No build directory - run 'npm run build'${NC}"
fi
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

echo ""
echo "7️⃣ CHECKING DEPENDENCIES..."
echo "----------------------------"

# Check if node_modules exists
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✅ Dependencies installed${NC}"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
    
    # Count total dependencies
    TOTAL_DEPS=$(npm list --depth=0 2>/dev/null | wc -l)
    echo -e "${BLUE}ℹ️  Total dependencies: ~$TOTAL_DEPS${NC}"
else
    echo -e "${RED}❌ Dependencies not installed - run 'npm install'${NC}"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
    ISSUES_FOUND+=("Dependencies not installed")
fi
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

echo ""
echo "8️⃣ CHECKING FOR DUPLICATE CODE..."
echo "----------------------------------"

# Check for duplicate service imports
DUPLICATE_IMPORTS=$(grep -r "import.*from.*services" src/ --include="*.tsx" --include="*.ts" | sort | uniq -d | wc -l)
if [ $DUPLICATE_IMPORTS -eq 0 ]; then
    echo -e "${GREEN}✅ No duplicate service imports found${NC}"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
else
    echo -e "${YELLOW}⚠️  Found $DUPLICATE_IMPORTS potential duplicate imports${NC}"
fi
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

echo ""
echo "9️⃣ CHECKING TEST COVERAGE..."
echo "-----------------------------"

# Check if test files exist
TEST_FILES=$(find src -name "*.test.ts" -o -name "*.test.tsx" 2>/dev/null | wc -l)
if [ $TEST_FILES -gt 0 ]; then
    echo -e "${GREEN}✅ Found $TEST_FILES test files${NC}"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
else
    echo -e "${YELLOW}⚠️  No test files found${NC}"
    ISSUES_FOUND+=("No test files")
fi
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

echo ""
echo "🔟 CHECKING ENVIRONMENT VARIABLES..."
echo "------------------------------------"

# Check for required environment variables in code
ENV_VARS=$(grep -r "process.env\|import.meta.env" src/ --include="*.tsx" --include="*.ts" 2>/dev/null | grep -o "VITE_[A-Z_]*" | sort | uniq)
echo -e "${BLUE}ℹ️  Environment variables used:${NC}"
for var in $ENV_VARS; do
    echo "   - $var"
    if [ -f ".env" ] && grep -q "$var" .env 2>/dev/null; then
        echo -e "     ${GREEN}✓ Defined in .env${NC}"
    else
        echo -e "     ${RED}✗ Not in .env${NC}"
        ISSUES_FOUND+=("$var not defined in .env")
    fi
done

echo ""
echo "================================================"
echo "📊 QA VERIFICATION SUMMARY"
echo "================================================"
echo ""
echo -e "Total Checks: ${BLUE}$TOTAL_CHECKS${NC}"
echo -e "Passed: ${GREEN}$PASSED_CHECKS${NC}"
echo -e "Failed: ${RED}$FAILED_CHECKS${NC}"
echo ""

# Calculate percentage
if [ $TOTAL_CHECKS -gt 0 ]; then
    PERCENTAGE=$((PASSED_CHECKS * 100 / TOTAL_CHECKS))
    
    if [ $PERCENTAGE -ge 90 ]; then
        echo -e "${GREEN}✅ QUALITY SCORE: $PERCENTAGE% - EXCELLENT!${NC}"
    elif [ $PERCENTAGE -ge 70 ]; then
        echo -e "${YELLOW}⚠️  QUALITY SCORE: $PERCENTAGE% - NEEDS IMPROVEMENT${NC}"
    else
        echo -e "${RED}❌ QUALITY SCORE: $PERCENTAGE% - CRITICAL ISSUES${NC}"
    fi
fi

echo ""
if [ ${#ISSUES_FOUND[@]} -gt 0 ]; then
    echo -e "${RED}🔴 ISSUES TO FIX:${NC}"
    for issue in "${ISSUES_FOUND[@]}"; do
        echo "   • $issue"
    done
else
    echo -e "${GREEN}🟢 NO CRITICAL ISSUES FOUND!${NC}"
fi

echo ""
echo "================================================"
echo "🏁 QA Verification Complete"
echo "================================================"

# Return exit code based on critical failures
if [ $FAILED_CHECKS -gt 5 ]; then
    exit 1
else
    exit 0
fi