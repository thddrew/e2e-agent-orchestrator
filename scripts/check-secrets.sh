#!/bin/bash
# Script to check and set up GitHub Actions secrets

echo "🔍 Checking GitHub Actions secrets..."
echo ""

# Check if NPM_TOKEN exists
if gh secret list 2>/dev/null | grep -q "NPM_TOKEN"; then
    echo "✅ NPM_TOKEN secret exists"
    gh secret list | grep NPM_TOKEN
else
    echo "❌ NPM_TOKEN secret not found"
    echo ""
    echo "📝 To set it up:"
    echo ""
    echo "1. Get your npm token:"
    echo "   Visit: https://www.npmjs.com/settings/thddrew/tokens"
    echo "   Click 'Generate New Token' → Select 'Automation'"
    echo ""
    echo "2. Add it to GitHub (interactive):"
    echo "   gh secret set NPM_TOKEN --repo thddrew/e2e-agent-orchestrator"
    echo ""
    echo "   Or via web UI:"
    echo "   https://github.com/thddrew/e2e-agent-orchestrator/settings/secrets/actions"
    echo ""
    read -p "Do you want to set it up now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Paste your npm token (it will be hidden):"
        read -s NPM_TOKEN
        gh secret set NPM_TOKEN --repo thddrew/e2e-agent-orchestrator --body "$NPM_TOKEN"
        echo ""
        echo "✅ NPM_TOKEN secret set!"
    fi
fi

echo ""
echo "📊 Current secrets:"
gh secret list
