-- CreateTable
CREATE TABLE "staff_notifications" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "intake_id" TEXT,
    "message" TEXT NOT NULL,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "staff_notifications_clinic_id_idx" ON "staff_notifications"("clinic_id");

-- CreateIndex
CREATE INDEX "staff_notifications_clinic_id_read_at_idx" ON "staff_notifications"("clinic_id", "read_at");

-- CreateIndex
CREATE INDEX "staff_notifications_intake_id_idx" ON "staff_notifications"("intake_id");

-- AddForeignKey
ALTER TABLE "staff_notifications" ADD CONSTRAINT "staff_notifications_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_notifications" ADD CONSTRAINT "staff_notifications_intake_id_fkey" FOREIGN KEY ("intake_id") REFERENCES "intakes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

