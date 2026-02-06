#!/bin/bash

# OAD Design Reviewer - Quick Setup Script
# This script helps you set up the Foundry agent integration

echo "🚀 OAD Design Reviewer - Foundry Agent Setup"
echo "=============================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js version: $(node --version)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm."
    exit 1
fi

echo "✅ npm version: $(npm --version)"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed successfully"

# Check if .env file exists
if [ ! -f .env ]; then
    echo ""
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "✅ .env file created"
    echo ""
    echo "⚠️  IMPORTANT: Please edit .env file with your actual values:"
    echo "   - FOUNDRY_ENDPOINT"
    echo "   - FOUNDRY_AGENT_ID"
    echo "   - AZURE_OPENAI_ENDPOINT"
    echo "   - AZURE_OPENAI_API_KEY"
    echo ""
    echo "   You can also update src/app.js with the same values."
else
    echo "✅ .env file already exists"
fi

# Check if Foundry configuration is set in app.js
echo ""
echo "🔍 Checking Foundry configuration in src/app.js..."

if grep -q "your-foundry-resource" src/app.js; then
    echo "⚠️  WARNING: src/app.js still contains placeholder Foundry configuration"
    echo "   Please update the CONFIG object in src/app.js with your actual values"
fi

if grep -q "your-agent-id" src/app.js; then
    echo "⚠️  WARNING: src/app.js still contains placeholder agent ID"
    echo "   Please update the agentId in src/app.js with your actual agent ID"
fi

echo ""
echo "🎯 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Configure your Azure AI Foundry agent"
echo "2. Update .env and src/app.js with your Foundry details"
echo "3. Run 'npm start' to start the API server"
echo "4. Open another terminal and run 'cd src && npx serve' for the frontend"
echo "5. Test at http://localhost:3000"
echo ""
echo "📚 For detailed setup instructions, see:"
echo "   - README.md for overview"
echo "   - azure/foundry-agent-integration.md for Foundry setup"
echo "   - QUICKSTART.md for step-by-step deployment"