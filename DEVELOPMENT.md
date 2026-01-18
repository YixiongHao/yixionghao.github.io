# Development Workflow

## Local Testing

### Option 1: VS Code Live Server
1. Install the "Live Server" extension in VS Code
2. Right-click `index.html` and select "Open with Live Server"
3. Browser opens at `http://127.0.0.1:5500`

### Option 2: Python HTTP Server
```bash
# Python 3
python -m http.server 8000

# Then open http://localhost:8000
```

### Option 3: Node.js
```bash
npx serve
# Opens at http://localhost:3000
```

## Deploying to GitHub Pages

1. Commit your changes:
```bash
git add .
git commit -m "Your commit message"
```

2. Push to main branch:
```bash
git push origin main
```

3. GitHub Pages automatically deploys from the main branch. Site will be live at `https://yix.github.io` (or your configured domain).

## Notes

- Changes typically take 1-2 minutes to appear on the live site after pushing
- Check the "Actions" tab on GitHub to see deployment status
- For custom domains, configure in repo Settings > Pages
