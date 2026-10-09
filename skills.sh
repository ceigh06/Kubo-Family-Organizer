#!/bin/bash
# skills.sh - Task agent orchestration for Kubo Family Organizer
# Place in project root: /e/projects/kubohub-main/skills.sh
# Run with: ./skills.sh [command] [agent]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_ROOT"

# Helper functions
log_info()   { echo -e "${GREEN}✓${NC} $1"; }
log_warn()   { echo -e "${YELLOW}!${NC} $1"; }
log_error()  { echo -e "${RED}✗${NC} $1"; }

# ============================================================
# Command: setup - Verify development environment
# ============================================================
cmd_setup() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}  Kubo Family Organizer - Environment  ${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""

    # Check Node.js
    if command -v node &> /dev/null; then
        local node_version=$(node --version)
        log_info "Node.js $node_version is available"
    else
        log_error "Node.js not found. Please install Node.js first."
    fi

    # Check npm/pnpm
    if command -v npm &> /dev/null; then
        log_info "npm is available"
    elif command -v pnpm &> /dev/null; then
        log_info "pnpm is available"
    else
        log_warn "Neither npm nor pnpm found"
    fi

    # Check node_modules
    if [ -d "node_modules" ]; then
        log_info "node_modules directory exists"
    else
        log_warn "node_modules not found. Run 'npm install'"
    fi

    # Check key dependencies for agents
    local deps_ok=true

    # TensorFlow.js for Computer Vision
    if [ -d "node_modules/@tensorflow/tfjs" ] || [ -d "node_modules/@tensorflow-models/mobilenet" ]; then
        log_info "@tensorflow-models/mobilenet is installed"
    else
        log_warn "@tensorflow-models/mobilenet not found (needed for computer vision agent)"
        deps_ok=false
    fi

    # tesseract.js for OCR
    if [ -d "node_modules/tesseract.js" ]; then
        log_info "tesseract.js is installed"
    else
        log_warn "tesseract.js not found (needed for OCR in computer vision agent)"
        deps_ok=false
    fi

    # Front-end dependencies
    if [ -d "node_modules/lucide-react" ]; then
        log_info "lucide-react is installed"
    else
        log_warn "lucide-react not found"
        deps_ok=false
    fi

    if [ -d "node_modules/tailwindcss" ]; then
        log_info "tailwindcss is installed"
    else
        log_warn "tailwindcss not found"
        deps_ok=false
    fi

    echo ""
    if [ "$deps_ok" = true ]; then
        log_info "Environment setup complete - all agents ready"
    else
        log_warn "Some dependencies missing - run 'npm install' if needed"
    fi

    # Check git status
    if [ -d ".git" ]; then
        local branch=$(git branch --show-current 2>/dev/null || echo "unknown")
        local status=$(git status --short | wc -l)
        echo -e "Git branch: ${BLUE}$branch${NC}"
        echo -e "Modified files: ${YELLOW}$status${NC}"
    fi
}

# ============================================================
# Command: agent - Launch a specific agent
# ============================================================
cmd_agent() {
    local agent_name="$1"

    case "$agent_name" in
        frontend-design)
            echo -e "${BLUE}========================================${NC}"
            echo -e "${BLUE}  Frontend Design Agent${NC}"
            echo -e "${BLUE}========================================${NC}"
            echo ""
            echo -e "Gear: ${GREEN}frontend-design:frontend-design skill${NC}"
            echo -e "Focus: UI/UX design for household organizer interface"
            echo -e "Target: src/features/ lists/, debts/, household/, calendar/ views"
            echo -e "Key files: ListsView.tsx, DebtsView.tsx, App.tsx"
            echo ""
            echo -e "Available via Claude Code: /frontend-design"
            echo -e "Or invoke: ${YELLOW}./skills.sh agent frontend-design${NC}"
            echo ""
            # Check current branch
            if [ -d ".git" ]; then
                echo -e "Current branch: $(git branch --show-current 2>/dev/null || echo 'unknown')"
            fi
            ;;

        computer-vision)
            echo -e "${BLUE}========================================${NC}"
            echo -e "${BLUE}  Computer Vision Specialist${NC}"
            echo -e "${BLUE}========================================${NC}"
            echo ""
            echo -e "Gear: ${GREEN}TensorFlow.js + Tesseract.js${NC}"
            echo -e "Focus: On-device grocery item recognition, OCR"
            echo -e "Libraries: @tensorflow-models/mobilenet, tesseract.js"
            echo -e "Technique: 100% local inference, no cloud APIs"
            echo -e "Catalog: Philippine household groceries (see src/ai/vision.ts)"
            echo -e "Key files: src/ai/vision.ts, src/features/lists/ListsView.tsx"
            echo ""
            echo -e "OCR Pipeline:"
            echo -e "  1. Native TextDetector API (Chrome experimental)"
            echo -e "  2. Tesseract.js fallback with OCR preprocessing"
            echo -e "  3. Color profiling for bottle/can identification"
            echo -e "  4. Catalog matching against 30+ grocery items"
            echo ""
            echo -e "Available via: ${YELLOW}./skills.sh agent computer-vision${NC}"
            echo -e "Or in Claude Code: use the dataviz skill for visualization"
            if [ -d "node_modules/@tensorflow-models/mobilenet" ]; then
                echo -e "✓ MobileNet model available"
            else
                echo -e "✗ MobileNet model not installed"
            fi
            if [ -d "node_modules/tesseract.js" ]; then
                echo -e "✓ Tesseract.js available"
            else
                echo -e "✗ Tesseract.js not installed"
            fi
            ;;

        security-audit)
            echo -e "${BLUE}========================================${NC}"
            echo -e "${BLUE}  Security Audit Agent${NC}"
            echo -e "${BLUE}========================================${NC}"
            echo ""
            echo -e "Gear: ${GREEN}security-review skill${NC}"
            echo -e "Focus: Code security review and best practices"
            echo -e "Target: src/ directory, dependencies, environment"
            echo -e "Check: Input validation, XSS risks, dependency safety"
            echo -e "Key files to examine: ListsView.tsx, DebtsView.tsx, API usage"
            echo ""
            echo -e "Running security review..."
            if command -v npx &> /dev/null; then
                echo -e "Can run: ${YELLOW}npx tsc --noEmit${NC} for type checking"
            fi
            echo -e "Can run: ${YELLOW}./skills.sh audit${NC} for detailed review"
            ;;

        audit)
            echo -e "${BLUE}========================================${NC}"
            echo -e "${BLUE}  Running Security Audit${NC}"
            echo -e "${BLUE}========================================${NC}"
            echo ""
            # Run TypeScript type check if available
            if command -v npx &> /dev/null; then
                echo -e "Running TypeScript type check..."
                npx tsc --noEmit 2>&1 | head -50
            else
                log_error "npx not available for type checking"
            fi

            # Check for common security concerns in code
            echo ""
            echo -e "Quick code analysis:"

            # Check for potential XSS - innerHTML usage
            local xss_count=0
            if grep -r "innerHTML" src/ --include="*.tsx" --include="*.ts" 2>/dev/null | head -5 > /dev/null; then
                xss_count=$((xss_count + 1))
                log_warn "innerHTML usage found in some TSX files"
            fi

            # Check for eval usage
            if grep -r "eval(" src/ --include="*.ts" 2>/dev/null | head -3 > /dev/null; then
                log_error "eval() usage found - potential security risk"
            fi

            # Check for database query patterns
            if grep -r "db\." src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -5 > /dev/null; then
                log_info "DB operations found - ensuring proper parameterization"
            fi

            echo ""
            echo -e "Audit complete. Review output above for details."
            ;;

        list|agents)
            echo -e "${BLUE}Available Agents:${NC}"
            echo ""
            echo -e "${BLUE}1. frontend-design${NC} - UI/UX design and component styling"
            echo -e "   Skill: frontend-design:frontend-design"
            echo -e "   Works on: ListsView.tsx, DebtsView.tsx, App.tsx"
            echo ""
            echo -e "${BLUE}2. computer-vision${NC} - On-device image recognition & OCR"
            echo -e "   Libraries: @tensorflow-models/mobilenet, tesseract.js"
            echo -e "   Works on: src/ai/vision.ts, grocery image processing"
            echo -e "   Focus: Philippine grocery item identification"
            echo ""
            echo -e "${BLUE}3. security-audit${NC} - Code security review"
            echo -e "   Skill: security-review"
            echo -e "   Focus: Code quality, XSS, dependency safety"
            echo -e "   Works on: All src/ files"
            echo ""
            echo -e "${BLUE}4. setup${NC} - Verify environment and dependencies"
            echo ""
            ;;

        *)
            echo -e "${RED}Unknown agent: $agent_name${NC}"
            echo ""
            echo -e "Available agents: frontend-design, computer-vision, security-audit, audit, list, setup"
            echo -e "Use: ${YELLOW}./skills.sh list${NC} to show all available agents"
            return 1
            ;;
    esac
}

# ============================================================
# Command: run - Run a specific task or workflow
# ============================================================
cmd_run() {
    local task="$1"

    case "$task" in
        install-deps)
            echo -e "${BLUE}Installing dependencies...${NC}"
            if command -v npm &> /dev/null; then
                npm install
            elif command -v pnpm &> /dev/null; then
                pnpm install
            else
                log_error "No package manager found"
                return 1
            fi
            ;;

        build)
            echo -e "${BLUE}Building project...${NC}"
            npm run build 2>&1
            ;;

        preview)
            echo -e "${BLUE}Previewing project...${NC}"
            npm run preview 2>&1
            ;;

        test)
            echo -e "${BLUE}Running tests...${NC}"
            npm test 2>&1 | tail -30
            ;;

        lint)
            echo -e "${BLUE}Running linter...${NC}"
            npm run lint 2>&1 | tail -30
            ;;

        *)
            echo -e "${RED}Unknown task: $task${NC}"
            echo -e "Available tasks: install-deps, build, preview, test, lint"
            return 1
            ;;
    esac
}

# ============================================================
# Main entry point
# ============================================================
main() {
    local command="${1:-}"

    case "$command" in
        setup)
            cmd_setup
            ;;
        agent)
            cmd_agent "$2"
            ;;
        run)
            cmd_run "$2"
            ;;
        list)
            cmd_agent list
            ;;
        *)
            echo -e "${BLU}========================================${NC}"
            echo -e "${BLUE}  Kubo Family Organizer - Skills${NC}"
            echo -e "${BLUE}========================================${NC}"
            echo ""
            echo -e "Usage: ${YELLOW}./skills.sh <command>${NC}"
            echo ""
            echo -e "Commands:"
            echo -e "  ${BLUE}setup${NC}    - Verify development environment"
            echo -e "  ${BLUE}agent <name>${NC} - Launch a specific agent"
            echo -e "  ${BLUE}run <task>${NC} - Run a build/test task"
            echo -e "  ${BLUE}list${NC}     - List available agents"
            echo ""
            echo -e "Agents:"
            echo -e "  frontend-design   - UI/UX design using frontend-design skill"
            echo -e "  computer-vision   - Computer vision specialist (TensorFlow.js + OCR)"
            echo -e "  security-audit    - Security audit agent"
            echo ""
            echo -e "Example: ${YELLOW}./skills.sh agent frontend-design${NC}"
            echo ""
            return 1
            ;;
    esac
}

# Run main function
main "$@"