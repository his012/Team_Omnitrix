@echo off
cd /d "%~dp0"
echo =========================================
echo   KisanMandi Ultimate v3 - Local Demo
echo =========================================
where py >nul 2>&1
if %errorlevel% equ 0 (
  py -m pip install -r requirements.txt
  if errorlevel 1 goto fail
  echo Opening KisanMandi on http://127.0.0.1:8001
  py app.py --port 8001
) else (
  python -m pip install -r requirements.txt
  if errorlevel 1 goto fail
  echo Opening KisanMandi on http://127.0.0.1:8001
  python app.py --port 8001
)
pause
exit /b 0
:fail
echo Setup failed. Check that Python and pip are installed.
pause
exit /b 1
