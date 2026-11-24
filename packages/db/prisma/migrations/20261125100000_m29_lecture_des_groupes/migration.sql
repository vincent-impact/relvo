-- M29.5 — la lecture des groupes, deux fois par jour : jusqu'où un groupe a été lu.
ALTER TABLE "conversations" ADD COLUMN "group_read_until" TIMESTAMP(3);
