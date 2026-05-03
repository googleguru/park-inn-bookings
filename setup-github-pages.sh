#!/bin/bash

# GitHub Pages Setup Script
# Run this script locally on your machine with: bash setup-github-pages.sh

set -e

echo "🚀 GitHub Pages Setup for park-inn-bookings"
echo "============================================"
echo ""

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed."
    echo "   Install from: https://cli.github.com/"
    exit 1
fi

# Check authentication
if ! gh auth status &> /dev/null; then
    echo "❌ Not authenticated with GitHub."
    echo "   Run: gh auth login"
    exit 1
fi

OWNER="googleguru"
REPO="park-inn-bookings"

echo "📋 Repository: $OWNER/$REPO"
echo ""

# Configure GitHub Pages
echo "⏳ Configuring GitHub Pages..."
echo ""

# Try to create/update Pages configuration
if gh api repos/$OWNER/$REPO/pages \
    -X POST \
    -f source='{"branch":"gh-pages","path":"/"}' \
    > /dev/null 2>&1; then
    echo "✅ GitHub Pages configured successfully!"
elif gh api repos/$OWNER/$REPO/pages \
    -X PATCH \
    -f source='{"branch":"gh-pages","path":"/"}' \
    > /dev/null 2>&1; then
    echo "✅ GitHub Pages configuration updated!"
else
    echo "ℹ️  Trying alternative configuration method..."
    # Try with the full API path
    TOKEN=$(gh auth token)
    curl -X POST \
      -H "Accept: application/vnd.github.v3+json" \
      -H "Authorization: token $TOKEN" \
      https://api.github.com/repos/$OWNER/$REPO/pages \
      -d '{"source":{"branch":"gh-pages","path":"/"}}' \
      2>/dev/null || echo "⚠️  Manual configuration needed"
fi

echo ""
echo "✅ Setup Complete!"
echo ""
echo "📍 Your site will be available at:"
echo "   https://$OWNER.github.io/$REPO/"
echo ""
echo "🔍 Check deployment status:"
echo "   https://github.com/$OWNER/$REPO/actions"
echo ""
