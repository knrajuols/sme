-- AlterColumn: AuditExportJob.fileUrl TEXT → VARCHAR(1024)
-- Object-storage internal key paths; pre-signed URLs must NOT be stored here.
ALTER TABLE "AuditExportJob" ALTER COLUMN "fileUrl" TYPE VARCHAR(1024);

-- AlterColumn: AuditExportJob.errorMsg TEXT → VARCHAR(2000)
-- Fits exception class + message + first-line stack frame; full traces belong in log aggregator.
ALTER TABLE "AuditExportJob" ALTER COLUMN "errorMsg" TYPE VARCHAR(2000);
