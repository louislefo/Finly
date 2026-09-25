@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo                 Finly - Uninstall Script
echo ========================================================
echo.

:: 1. Terminate running Finly processes
echo [1/3] Closing running Finly instances...
taskkill /F /IM Finly.exe /IM Finly-Portable.exe /T >nul 2>&1

:: 2. Remove application installed files if present
echo [2/3] Removing installed files and shortcuts...
if exist "%LOCALAPPDATA%\Programs\Finly" (
    rmdir /S /Q "%LOCALAPPDATA%\Programs\Finly" >nul 2>&1
)

:: Remove Start Menu Shortcuts
if exist "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Finly" (
    rmdir /S /Q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Finly" >nul 2>&1
)
if exist "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Finly.lnk" (
    del /F /Q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Finly.lnk" >nul 2>&1
)

:: Remove Desktop Shortcut
if exist "%USERPROFILE%\Desktop\Finly.lnk" (
    del /F /Q "%USERPROFILE%\Desktop\Finly.lnk" >nul 2>&1
)

:: 3. Prompt user before deleting local database and logs
echo.
set /p PURGE_DATA="[3/3] Do you also want to remove your local data and database (%APPDATA%\Finly)? (Y/N): "
if /I "!PURGE_DATA!"=="Y" (
    if exist "%APPDATA%\Finly" (
        rmdir /S /Q "%APPDATA%\Finly" >nul 2>&1
        echo Local data removed successfully.
    )
) else (
    echo Local database kept in %APPDATA%\Finly for future use.
)

echo.
echo ========================================================
echo          Finly uninstallation completed successfully.
echo ========================================================
echo.
pause
