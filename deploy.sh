git add .
git commit -m $1
git push -u origin main --force
npm run build
firebase deploy --only hosting
