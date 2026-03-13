@echo off
powershell -Command "Start-Process powershell -ArgumentList '-ExecutionPolicy Bypass -NoExit -File C:\projects\SME\scripts\run-backend.ps1' -Verb RunAs"
exit