@echo off
cd e:\AJUI-main\AJUI-main
echo Pushing code to GitHub...
git add .
git commit -m "fix: editable PO Number, pCloud fallback, and mobile issuedAmount typing"
git push

cd mobile-supervisor
echo.
echo Building mobile APK...
call build_apk.bat
echo.
echo Process complete. Press any key to exit.
pause
