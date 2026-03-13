-- AlterColumn: User.passwordHash TEXT → VARCHAR(255)
-- bcrypt=60 chars, argon2id≤97 chars; 255 provides headroom for future algorithms.
ALTER TABLE "User" ALTER COLUMN "passwordHash" TYPE VARCHAR(255);
