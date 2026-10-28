-- M24.1 — le fournisseur derrière un canal est l'un des deux que l'application
-- sait servir : l'agrégateur, ou le relais Gmail de Relvo. Une règle qui ne
-- vivrait que dans le code serait contournée par le premier script venu.
ALTER TABLE "channel_configs"
  ADD CONSTRAINT "channel_configs_provider_check"
  CHECK ("provider" IN ('unipile', 'gmail'));
