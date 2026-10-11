-- CreateTable
CREATE TABLE "DeliveryOption" (
    "method" "DeliveryMethod" NOT NULL,
    "feeUsd" DECIMAL(10,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryOption_pkey" PRIMARY KEY ("method")
);

-- CreateTable
CREATE TABLE "CommuneSetting" (
    "name" TEXT NOT NULL,
    "isServed" BOOLEAN NOT NULL DEFAULT true,
    "surchargeUsd" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommuneSetting_pkey" PRIMARY KEY ("name")
);
