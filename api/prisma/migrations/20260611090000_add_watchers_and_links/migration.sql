-- CreateTable
CREATE TABLE "TicketWatcher" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketWatcher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketLink" (
    "id" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TicketWatcher_ticketId_userId_key" ON "TicketWatcher"("ticketId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "TicketLink_fromId_toId_key" ON "TicketLink"("fromId", "toId");

-- AddForeignKey
ALTER TABLE "TicketWatcher" ADD CONSTRAINT "TicketWatcher_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketWatcher" ADD CONSTRAINT "TicketWatcher_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketLink" ADD CONSTRAINT "TicketLink_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketLink" ADD CONSTRAINT "TicketLink_toId_fkey" FOREIGN KEY ("toId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
