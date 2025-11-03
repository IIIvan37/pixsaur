#!/bin/bash
# Test script for Netlify Functions
# Usage: ./test-functions.sh [function-name]

set -e

BASE_URL="${BASE_URL:-http://localhost:8888/.netlify/functions}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Testing Pixsaur Netlify Functions${NC}"
echo "Base URL: $BASE_URL"
echo ""

# Test health endpoint
test_health() {
    echo -e "${YELLOW}Testing /health endpoint...${NC}"
    response=$(curl -s "$BASE_URL/health")
    
    if echo "$response" | grep -q "Pixsaur API is running"; then
        echo -e "${GREEN}✓ Health check passed${NC}"
        echo "$response" | jq '.'
    else
        echo -e "${RED}✗ Health check failed${NC}"
        echo "$response"
        exit 1
    fi
    echo ""
}

# Test assemble endpoint
test_assemble() {
    echo -e "${YELLOW}Testing /assemble endpoint...${NC}"
    
    payload='{
        "code": "ORG &4000\nLD A,1\nLD B,2\nADD A,B\nRET"
    }'
    
    response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "$payload" \
        "$BASE_URL/assemble")
    
    if echo "$response" | grep -q "success"; then
        echo -e "${GREEN}✓ Assemble endpoint responding${NC}"
        echo "$response" | jq '.'
    else
        echo -e "${RED}✗ Assemble endpoint failed${NC}"
        echo "$response"
    fi
    echo ""
}

# Test create-dsk endpoint
test_create_dsk() {
    echo -e "${YELLOW}Testing /create-dsk endpoint...${NC}"
    
    payload='{
        "files": [{
            "name": "TEST.BIN",
            "data": "SGVsbG8gQ1BD",
            "type": "binary"
        }],
        "format": "DATA"
    }'
    
    response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "$payload" \
        "$BASE_URL/create-dsk")
    
    if echo "$response" | grep -q "success"; then
        echo -e "${GREEN}✓ Create DSK endpoint responding${NC}"
        echo "$response" | jq '.'
    else
        echo -e "${RED}✗ Create DSK endpoint failed${NC}"
        echo "$response"
    fi
    echo ""
}

# Test create-sna endpoint
test_create_sna() {
    echo -e "${YELLOW}Testing /create-sna endpoint...${NC}"
    
    payload='{
        "binary": "MQICAwM=",
        "loadAddress": 16384,
        "startAddress": 16384
    }'
    
    response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "$payload" \
        "$BASE_URL/create-sna")
    
    if echo "$response" | grep -q "success"; then
        echo -e "${GREEN}✓ Create SNA endpoint responding${NC}"
        echo "$response" | jq '.'
    else
        echo -e "${RED}✗ Create SNA endpoint failed${NC}"
        echo "$response"
    fi
    echo ""
}

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo -e "${YELLOW}Warning: jq is not installed. Install it for better JSON output.${NC}"
    echo ""
fi

# Run tests based on argument
case "${1:-all}" in
    health)
        test_health
        ;;
    assemble)
        test_assemble
        ;;
    dsk)
        test_create_dsk
        ;;
    sna)
        test_create_sna
        ;;
    all)
        test_health
        test_assemble
        test_create_dsk
        test_create_sna
        echo -e "${GREEN}All tests completed!${NC}"
        ;;
    *)
        echo "Usage: $0 [health|assemble|dsk|sna|all]"
        exit 1
        ;;
esac
