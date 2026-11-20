@echo off
title EduConnect360 Dev Server
echo ========================================================
echo  Starting EduConnect360 Development Server...
echo  Opening on http://localhost:5173
echo ========================================================
npx pnpm --filter @workspace/educonnect360 run dev
pause
