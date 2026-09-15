# One-command backend dev startup.
#
# Run this instead of manually activating the venv / pip install / seeding
# every time you open the project:
#
#   cd backend
#   .\dev.ps1
#
# It only does the slow steps (create venv, pip install, seed data) when
# something actually changed, so after the first run it just starts the
# server in a couple of seconds.

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$venvPython = ".\venv\Scripts\python.exe"
$hashFile = ".\venv\.requirements.hash"

# 1. Create the venv if it's missing. Must be 3.12 -- this project's
#    compiled deps (pydantic_core etc.) don't have working wheels for the
#    3.14 that "py" resolves to by default on this machine.
if (-not (Test-Path $venvPython)) {
    Write-Host "No venv found -- creating one with Python 3.12..." -ForegroundColor Cyan
    py -3.12 -m venv venv
}

# 2. Reinstall requirements only if requirements.txt changed since the last install.
$currentHash = (Get-FileHash requirements.txt -Algorithm SHA256).Hash
$previousHash = if (Test-Path $hashFile) { Get-Content $hashFile -Raw } else { "" }

if ($currentHash -ne $previousHash.Trim()) {
    Write-Host "requirements.txt changed -- installing dependencies..." -ForegroundColor Cyan
    & $venvPython -m pip install -r requirements.txt -q
    Set-Content -Path $hashFile -Value $currentHash -NoNewline
} else {
    Write-Host "Dependencies already up to date, skipping pip install." -ForegroundColor DarkGray
}

# 3. Apply any pending migrations (no-op if none are pending).
& $venvPython manage.py migrate --noinput

# 4. Seed data. Both commands already check the database and skip
#    themselves if it's already populated, so this is safe and fast to
#    run on every startup.
& $venvPython manage.py seed_questions
& $venvPython manage.py seed_study_content

# 5. Start the dev server.
Write-Host "Starting Django dev server..." -ForegroundColor Green
& $venvPython manage.py runserver
