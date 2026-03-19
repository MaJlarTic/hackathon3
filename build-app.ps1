# build-app.ps1 - FINAL FIXED VERSION

Write-Host "====================================="
Write-Host "Building Electron app to EXE"
Write-Host "====================================="

# Check Node.js
try {
    $nodeVersion = node --version
    Write-Host "OK Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Node.js not found! Download from https://nodejs.org" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit
}

# Check npm
try {
    $npmVersion = npm --version
    Write-Host "OK npm: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: npm not found!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit
}

Write-Host "`nCreating package.json..." -ForegroundColor Yellow

$packageJson = @"
{
  "name": "smart-deadline-planner",
  "version": "1.0.0",
  "description": "Smart Deadline Planner",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "pack": "electron-packager . SmartPlanner --platform=win32 --arch=x64 --icon=icon.ico --out=dist --overwrite"
  },
  "author": "User",
  "license": "MIT",
  "devDependencies": {
    "electron": "^28.0.0",
    "electron-packager": "^17.1.2"
  }
}
"@

$packageJson | Out-File -FilePath "package.json" -Encoding ASCII
Write-Host "OK package.json created" -ForegroundColor Green

# Check icon.ico
if (-not (Test-Path "icon.ico")) {
    Write-Host "`nWARNING: icon.ico not found!" -ForegroundColor Yellow
    Write-Host "Creating dummy icon.ico (replace with real icon later)" -ForegroundColor Yellow
    "dummy icon file" | Out-File -FilePath "icon.ico" -Encoding ASCII
}

# Check main.js
if (-not (Test-Path "main.js")) {
    Write-Host "`nERROR: main.js not found!" -ForegroundColor Red
    Write-Host "Make sure this script is in the same folder as main.js" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit
} else {
    Write-Host "OK main.js found" -ForegroundColor Green
}

# Clean previous installations
Write-Host "`nCleaning previous installations..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Remove-Item -Recurse -Force "node_modules" -ErrorAction SilentlyContinue
}
if (Test-Path "package-lock.json") {
    Remove-Item -Force "package-lock.json" -ErrorAction SilentlyContinue
}

# Install dependencies
Write-Host "`nInstalling dependencies (2-5 minutes)..." -ForegroundColor Yellow
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "`nERROR installing dependencies!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit
}
Write-Host "OK dependencies installed" -ForegroundColor Green

# Build app
Write-Host "`nBuilding EXE (3-5 minutes)..." -ForegroundColor Yellow
npm run pack

# Check result
if (Test-Path "dist") {
    Write-Host "`n=====================================" -ForegroundColor Green
    Write-Host "BUILD SUCCESSFUL!" -ForegroundColor Green
    Write-Host "=====================================" -ForegroundColor Green
    
    $exeFiles = Get-ChildItem -Path "dist" -Recurse -Filter "*.exe"
    if ($exeFiles.Count -gt 0) {
        Write-Host "`nEXE files found:" -ForegroundColor Cyan
        foreach ($exe in $exeFiles) {
            $size = [math]::Round($exe.Length / 1MB, 2)
            Write-Host "  📦 $($exe.Name) - $size MB" -ForegroundColor White
            Write-Host "     📁 $($exe.Directory)" -ForegroundColor Gray
        }
    } else {
        Write-Host "`nLooking for application folder..." -ForegroundColor Yellow
        $appFolders = Get-ChildItem -Path "dist" -Directory
        foreach ($folder in $appFolders) {
            Write-Host "  📁 Found folder: $($folder.Name)" -ForegroundColor Green
            $appExe = Get-ChildItem -Path $folder.FullName -Filter "*.exe" -Recurse | Select-Object -First 1
            if ($appExe) {
                Write-Host "     ✅ Contains: $($appExe.Name)" -ForegroundColor Green
            }
        }
    }
    
    Write-Host "`n📁 Output folder: $((Get-Item "dist").FullName)" -ForegroundColor Cyan
    Write-Host "`n✅ Your app is ready! Check the dist folder." -ForegroundColor Green
} else {
    Write-Host "`n❌ ERROR: Build failed!" -ForegroundColor Red
    
    # Look for any built files
    $possibleExe = Get-ChildItem -Path "." -Recurse -Filter "*.exe" | Where-Object { $_.Name -like "*SmartPlanner*" }
    if ($possibleExe) {
        Write-Host "Found executable at: $($possibleExe[0].FullName)" -ForegroundColor Green
    }
}

Write-Host "`nPress Enter to exit"
Read-Host