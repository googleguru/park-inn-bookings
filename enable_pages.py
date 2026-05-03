#!/usr/bin/env python3
import subprocess
import json
import sys
import time

# Get GitHub token from environment
token = subprocess.run(['gh', 'auth', 'token'], capture_output=True, text=True).stdout.strip()

if not token:
    print("❌ No GitHub token found. Please authenticate with: gh auth login")
    sys.exit(1)

print("🔄 Configuring GitHub Pages...")
print()

# Make the API call to configure Pages
import urllib.request
import urllib.error

url = "https://api.github.com/repos/googleguru/park-inn-bookings/pages"
headers = {
    "Authorization": f"token {token}",
    "Accept": "application/vnd.github.v3+json",
    "Content-Type": "application/json"
}

data = json.dumps({
    "source": {
        "branch": "gh-pages",
        "path": "/"
    }
}).encode('utf-8')

try:
    req = urllib.request.Request(url, data=data, headers=headers, method='POST')
    with urllib.request.urlopen(req) as response:
        result = json.loads(response.read().decode())
        print("✅ GitHub Pages configured successfully!")
        print(f"📍 URL: https://googleguru.github.io/park-inn-bookings/")
        print(f"🌿 Branch: {result.get('source', {}).get('branch', 'gh-pages')}")
except urllib.error.HTTPError as e:
    if e.code == 409:
        # Already exists, try PATCH
        print("ℹ️  Pages already configured, updating...")
        req = urllib.request.Request(url, data=data, headers=headers, method='PATCH')
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode())
            print("✅ GitHub Pages updated successfully!")
            print(f"📍 URL: https://googleguru.github.io/park-inn-bookings/")
    else:
        print(f"❌ Error: {e.code} - {e.read().decode()}")
        sys.exit(1)

print()
print("🚀 Deployment Status:")
print("   Check: https://github.com/googleguru/park-inn-bookings/actions")
