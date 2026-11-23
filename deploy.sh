#!/bin/bash
# Deploys the built app (dist/) to Firebase Hosting and the Firestore security rules.
# First run opens a browser window to sign in to Google.
set -e
cd "$(dirname "$0")"
npx -y firebase-tools@latest login
npx -y firebase-tools@latest deploy --only hosting,firestore:rules --project lapor72
