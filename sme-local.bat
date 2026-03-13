@echo off
powershell -Command "Start-Process powershell -ArgumentList '-ExecutionPolicy Bypass -File C:\projects\SME\scripts\setup-sme-local.ps1 %*' -Verb RunAs"
exit