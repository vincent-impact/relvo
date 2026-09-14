#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Modele de cout IA pour Relvo. Voir conception/06-benchmark-iag.md.

    python3 scripts/cout-iag.py              # barème par fournisseur + décomposition
    python3 scripts/cout-iag.py --sensi      # sensibilité + marge par siège
    python3 scripts/cout-iag.py --piles      # piles mixtes, contraintes techniques incluses
    python3 scripts/cout-iag.py --effort     # sensibilite au niveau de raisonnement

⚠️ Les jetons de raisonnement sont factures au tarif de SORTIE. EFFORT est le
parametre le plus sensible de tout ce modele, et le defaut de l'API est "medium".

Prix relevés le 13/09/2026 sur les pages officielles des fournisseurs.
A REVALIDER avant toute décision — voir §7 du document.
"""
import sys

USD_PER_EUR = 1.1592                     # BCE, 11/09/2026
EUR = lambda usd: usd / USD_PER_EUR

# --------------------------------------------------------------------------
# 1. VOLUMETRIE — compte type
# --------------------------------------------------------------------------
MSG_TOTAL, PART_ENTRANTS = 5000, 0.60
MSG_IN  = int(MSG_TOTAL * PART_ENTRANTS)
MSG_OUT = MSG_TOTAL - MSG_IN

TAUX_ORPHELIN, TAUX_SUIVI = 0.15, 0.70   # le reste = bruit, A1 puis abandon
TAUX_PJ, TAUX_RESUME_PJ   = 0.08, 0.80
ANALYSES_PJ, REGEN_DRAFT, INGEST_KNOW = 40, 200, 10
CHAT_TOURS, CHAT_ALLERS, PART_CHAT_L, CHAT_CONVS = 300, 2.4, 0.30, 60

# --------------------------------------------------------------------------
# 2. PROFIL DE TOKENS — (ref, tier, appels, cache_in, frais_in, out)
#    tier S = classification / M = extraction+redaction / L = raisonnement
# --------------------------------------------------------------------------
SOLL = [
    ("A1  classification domaine",   "S", MSG_IN,                              0,    700,   30),
    ("A2-A6 ouverture/rattachement", "M", int(MSG_IN*TAUX_ORPHELIN),        6000,   4000,  600),
    ("A7  relecture sujet suivi",    "M", int(MSG_IN*TAUX_SUIVI),           6000,   3500,  450),
    ("A9  etiquetage PJ",            "S", int(MSG_IN*TAUX_PJ),                 0,   1500,   20),
    ("A10 message sortant",          "M", MSG_OUT,                          6000,   2000,  150),
    ("B1  regeneration brouillon",   "M", REGEN_DRAFT,                      6000,   5000,  500),
    ("B2  resume PJ (1er acces)",    "M", int(MSG_IN*TAUX_PJ*TAUX_RESUME_PJ),  0,   6000,  300),
    ("B3  analyse PJ approfondie",   "L", ANALYSES_PJ,                         0,  15000, 1200),
    ("B4  ingestion Connaissances",  "M", INGEST_KNOW,                         0,  12000,  400),
    ("C1  chat (tier moyen)",        "M", int(CHAT_TOURS*(1-PART_CHAT_L)*CHAT_ALLERS), 12000, 3000, 450),
    ("C1  chat (tier haut)",         "L", int(CHAT_TOURS*PART_CHAT_L*CHAT_ALLERS),     12000, 3000, 600),
    ("C2  titre de conversation",    "S", CHAT_CONVS,                          0,    800,   20),
]

# Variante optimisee : A10 -> tier S, A7 contexte frais -30 %, A1 prompt raccourci.
OPT = []
for ref, tier, n, ci, fi, o in SOLL:
    if   ref.startswith("A10"): OPT.append((ref+" *", "S", n, 0, 1200, 80))
    elif ref.startswith("A7"):  OPT.append((ref+" *", "M", n, 6000, int(fi*0.7), o))
    elif ref.startswith("A1 "): OPT.append((ref+" *", "S", n, 0, 450, 30))
    else:                       OPT.append((ref, tier, n, ci, fi, o))

# --------------------------------------------------------------------------
# 3. TARIFS — USD / million de tokens. cw = multiplicateur d'ecriture de cache.
# --------------------------------------------------------------------------
MODELS = {
    "Claude Haiku 4.5":        dict(inp=1.00,  cache=0.10,  out=5.00,  cw=1.25, cmin=4096),
    "Claude Sonnet 5":         dict(inp=2.00,  cache=0.20,  out=10.00, cw=1.25, cmin=1024),
    "Claude Opus 5":           dict(inp=5.00,  cache=0.50,  out=25.00, cw=1.25, cmin=512),
    "GPT-5.6 Luna":            dict(inp=0.20,  cache=0.02,  out=1.20,  cw=0.0,  cmin=1024),
    "GPT-5.6 Terra":           dict(inp=2.00,  cache=0.20,  out=12.00, cw=0.0,  cmin=1024),
    "GPT-5.6 Sol":             dict(inp=4.00,  cache=0.40,  out=20.00, cw=0.0,  cmin=1024),
    "GPT-6 Astra":             dict(inp=10.0,  cache=1.00,  out=50.00, cw=0.0,  cmin=1024),
    "Gemini 3.5 Flash-Lite":   dict(inp=0.30,  cache=0.03,  out=2.50,  cw=0.0,  cmin=4096),
    "Gemini 3.8 Flash":        dict(inp=0.75,  cache=0.075, out=3.75,  cw=0.0,  cmin=4096),
    "Gemini 3.8 Flash (2027)": dict(inp=1.50,  cache=0.15,  out=7.50,  cw=0.0,  cmin=4096),
    "Gemini 3.1 Pro":          dict(inp=2.00,  cache=0.20,  out=12.00, cw=0.0,  cmin=4096),
    "Ministral 3 8B":          dict(inp=0.15,  cache=0.015, out=0.15,  cw=0.0,  cmin=64),
    "Mistral Small 4":         dict(inp=0.15,  cache=0.015, out=0.60,  cw=0.0,  cmin=64),
    "Mistral Large 3":         dict(inp=0.50,  cache=0.05,  out=1.50,  cw=0.0,  cmin=64),
    "Mistral Medium 3.5":      dict(inp=1.50,  cache=0.15,  out=7.50,  cw=0.0,  cmin=64),
    "deepseek-flash":          dict(inp=0.30,  cache=0.006, out=1.20,  cw=0.0,  cmin=1),
    "deepseek-v4-pro":         dict(inp=1.32,  cache=0.044, out=3.96,  cw=0.0,  cmin=1),
    "Qwen3.7 Flash":           dict(inp=0.028, cache=0.003, out=0.165, cw=0.0,  cmin=1),
    "Qwen3.5 Plus":            dict(inp=0.115, cache=0.012, out=0.688, cw=0.0,  cmin=1),
    "Qwen3.8-Max":             dict(inp=2.00,  cache=0.20,  out=6.00,  cw=0.0,  cmin=1),
}

TAUX_ECRITURE_CACHE = 0.15   # 1 ecriture pour ~7 lectures

# Jetons de raisonnement (GPT-5.6, Gemini thinking) : FACTURES AU TARIF DE SORTIE.
# Ordres de grandeur par niveau d'effort, a remplacer par la mesure reelle
# (usage.output_tokens_details.reasoning_tokens). Le defaut de l'API OpenAI est "medium".
RAISONNEMENT = {"none": 0, "low": 300, "medium": 800, "high": 2000, "xhigh": 5000}
EFFORT = {"S": "none", "M": "low", "Ms": "low", "Ml": "low", "L": "medium", "Lv": "medium"}
FACTEUR_L = 2          # le tier haut raisonne environ deux fois plus longtemps

def jetons_raisonnement(tier):
    n = RAISONNEMENT[EFFORT[tier]]
    return n * FACTEUR_L if tier in ("L", "Lv") else n

def cost_call(m, cache_in, fresh_in, out):
    p = MODELS[m]
    if cache_in and cache_in < p["cmin"]:      # sous le seuil : pas de cache possible
        fresh_in += cache_in; cache_in = 0
    return (cache_in * p["cache"]
            + cache_in * TAUX_ECRITURE_CACHE * p["inp"] * p["cw"]
            + fresh_in * p["inp"]
            + out * p["out"]) / 1e6

def total(affect, soll, facteur=1.0, raisonnement=True):
    return sum(cost_call(affect[t], int(ci*facteur), int(fi*facteur),
                         int(o*facteur) + (jetons_raisonnement(t) if raisonnement else 0)) * n
               for _, t, n, ci, fi, o in soll)

ANTH = {"S": "Claude Haiku 4.5",      "M": "Claude Sonnet 5",    "L": "Claude Opus 5"}
OAI  = {"S": "GPT-5.6 Luna",          "M": "GPT-5.6 Terra",      "L": "GPT-5.6 Sol"}
GOOG = {"S": "Gemini 3.5 Flash-Lite", "M": "Gemini 3.8 Flash",   "L": "Gemini 3.1 Pro"}
G27  = {"S": "Gemini 3.5 Flash-Lite", "M": "Gemini 3.8 Flash (2027)", "L": "Gemini 3.1 Pro"}
MIST = {"S": "Ministral 3 8B",        "M": "Mistral Medium 3.5", "L": "Mistral Medium 3.5"}
MECO = {"S": "Ministral 3 8B",        "M": "Mistral Small 4",    "L": "Mistral Large 3"}
DEEP = {"S": "deepseek-flash",        "M": "deepseek-flash",     "L": "deepseek-v4-pro"}
QWEN = {"S": "Qwen3.7 Flash",         "M": "Qwen3.5 Plus",       "L": "Qwen3.8-Max"}
MIXB = {"S": "Gemini 3.5 Flash-Lite", "M": "Claude Sonnet 5",    "L": "Claude Opus 5"}

SCEN = [(ANTH, "Anthropic (Haiku/Sonnet 5/Opus 5)"), (OAI, "OpenAI (Luna/Terra/Sol)"),
        (GOOG, "Google (Flash-Lite/3.8 Flash/3.1 Pro)"), (G27, "Google - apres 01/01/2027"),
        (MIST, "Mistral (souverainete UE)"), (MECO, "Mistral - variante economique"),
        (DEEP, "DeepSeek (heures pleines) [ECARTE RGPD]"), (QWEN, "Qwen / Alibaba [ZONE GRISE]"),
        (MIXB, "MIX B (Flash-Lite/Sonnet 5/Opus 5)")]

def main():
    n_calls = sum(n for _, _, n, _, _, _ in SOLL)
    tin  = sum((ci+fi)*n for _, _, n, ci, fi, _ in SOLL)
    tout = sum(o*n for _, _, n, _, _, o in SOLL)
    print(f"Volumetrie : {MSG_TOTAL} msg/mois ({MSG_IN} entrants / {MSG_OUT} sortants)")
    print(f"{n_calls} appels API/mois | {tin/1e6:.2f} M tokens in | {tout/1e6:.2f} M tokens out\n")
    print(f"{'Scenario':<46}{'base EUR':>10}{'optimise EUR':>14}{'EUR/1000 msg':>14}")
    print("-"*84)
    for a, lab in sorted(SCEN, key=lambda x: total(x[0], OPT)):
        b, o = EUR(total(a, SOLL)), EUR(total(a, OPT))
        print(f"{lab:<46}{b:>10.2f}{o:>14.2f}{o/(MSG_TOTAL/1000):>14.2f}")
    print(f"\nDecomposition — {SCEN[0][1]}, avant optimisation :")
    print(f"{'Poste':<34}{'tier':<6}{'appels':>8}{'EUR/mois':>10}{'%':>7}")
    print("-"*84)
    t = total(ANTH, SOLL)
    for ref, tier, n, ci, fi, o in sorted(
            SOLL, key=lambda s: -cost_call(ANTH[s[1]], s[3], s[4], s[5])*s[2]):
        c = cost_call(ANTH[tier], ci, fi, o) * n
        print(f"{ref:<34}{tier:<6}{n:>8}{EUR(c):>10.2f}{100*c/t:>6.1f}%")

def sensi():
    print("=== Sensibilite au profil de tokens (Anthropic optimise) ===")
    for f in (0.5, 0.75, 1.0, 1.5, 2.0, 3.0):
        print(f"  x{f:<6.2f} {EUR(total(ANTH, OPT, f)):>8.2f} EUR/mois")
    print("\n=== Sensibilite au volume ===")
    base = EUR(total(ANTH, OPT))
    for v in (1000, 2500, 5000, 10000, 25000, 50000):
        print(f"  {v:>6} msg/mois {base*v/MSG_TOTAL:>9.2f} EUR/mois")
    print("\n=== Poids du chat (C1) ===")
    for tours in (100, 300, 600, 1200, 2400):
        s = [(r, t, (int(tours*(1-PART_CHAT_L)*CHAT_ALLERS) if "tier moyen" in r else
                     int(tours*PART_CHAT_L*CHAT_ALLERS)     if "tier haut"  in r else n), ci, fi, o)
             for r, t, n, ci, fi, o in OPT]
        print(f"  {tours:>5} tours/mois {EUR(total(ANTH, s)):>9.2f} EUR/mois")
    print("\n=== Marge par siege (69 EUR/siege/mois) ===")
    for a, lab in ((ANTH, "Anthropic"), (MIXB, "MIX B"), (GOOG, "Google"), (MIST, "Mistral UE")):
        c = EUR(total(a, OPT))
        print(f"  {lab:<12} cout IA {c:>7.2f} EUR | " + " | ".join(
            f"{s} siege(s): {100*c/(69*s):>5.1f}% du CA" for s in (1, 3, 5, 10)))


# --------------------------------------------------------------------------
# 4. TIERS ETENDUS ET CONTRAINTES PAR FOURNISSEUR
#    Ms = sortie structuree (ecrit en base) / Ml = redaction-lecture libre
#    Lv = analyse de document (exige la vision)
#    Un fournisseur sans JSON strict paie une boucle de reprise sur Ms ;
#    un fournisseur sans PDF natif paie la rasterisation sur A9/B2/B3.
# --------------------------------------------------------------------------
POSTES_STRUCT  = ("A2-A6", "A7", "A10", "B1", "B4")
POSTES_DOC     = ("A9", "B2", "B3")
SURCOUT_RASTER = 1.6     # tokens supplementaires quand la page doit etre rasterisee
TAUX_REPRISE   = 0.12    # part des appels structures rejoues faute de JSON strict

def tiers_etendus(soll):
    out = []
    for ref, tier, n, ci, fi, o in soll:
        if tier == "M":
            tier = "Ms" if ref.startswith(POSTES_STRUCT) else "Ml"
        if ref.startswith("B3"):
            tier = "Lv"
        out.append((ref, tier, n, ci, fi, o))
    return out

# pile : tier -> (modele, pdf_natif, json_strict)
def total_pile(pile, soll):
    t = 0.0
    for ref, tier, n, ci, fi, o in soll:
        m, pdf, js = pile[tier]
        if not pdf and ref.startswith(POSTES_DOC):   fi = int(fi * SURCOUT_RASTER)
        if not js  and ref.startswith(POSTES_STRUCT): n = int(n * (1 + TAUX_REPRISE))
        t += cost_call(m, ci, fi, o + jetons_raisonnement(tier)) * n
    return t

DS, DSP = ("deepseek-flash", False, False), ("deepseek-v4-pro", False, False)
LUN, TER, SOL = ("GPT-5.6 Luna", True, True), ("GPT-5.6 Terra", True, True), ("GPT-5.6 Sol", True, True)
HAI, SON, OPU = ("Claude Haiku 4.5", True, True), ("Claude Sonnet 5", True, True), ("Claude Opus 5", True, True)
FLT, G38 = ("Gemini 3.5 Flash-Lite", True, False), ("Gemini 3.8 Flash", True, False)

PILES = [
 ("RETENU — 100 % OpenAI, Luna/Luna/Terra",           {"S":LUN,"Ms":LUN,"Ml":LUN,"L":TER,"Lv":TER}),
 ("Hybride — DeepSeek sauf la structure",            {"S":DS, "Ms":LUN,"Ml":DS, "L":DSP,"Lv":DS}),
 ("DeepSeek integral",                               {"S":DS, "Ms":DS, "Ml":DS, "L":DSP,"Lv":DS}),
 ("Google — Flash-Lite + 3.8 Flash",                 {"S":FLT,"Ms":G38,"Ml":G38,"L":G38,"Lv":G38}),
 ("OpenAI premium — Luna/Terra/Sol",                 {"S":LUN,"Ms":TER,"Ml":TER,"L":SOL,"Lv":SOL}),
 ("Anthropic premium — Haiku/Sonnet 5/Opus 5",       {"S":HAI,"Ms":SON,"Ml":SON,"L":OPU,"Lv":OPU}),
]

def piles():
    soll = tiers_etendus(OPT)
    print(f"{'Pile':<50}{'EUR/mois':>10}{'EUR/1000':>10}{'1 siege':>9}{'3 sieges':>10}")
    print("-" * 89)
    for lab, p in sorted(PILES, key=lambda x: total_pile(x[1], soll)):
        c = EUR(total_pile(p, soll))
        print(f"{lab:<50}{c:>10.2f}{c/(MSG_TOTAL/1000):>10.2f}{100*c/69:>8.1f}%{100*c/207:>9.1f}%")

def effort():
    pile = {"S": "GPT-5.6 Luna", "M": "GPT-5.6 Luna", "L": "GPT-5.6 Terra"}
    print("Jetons de raisonnement = factures au tarif de SORTIE.\n")
    print(f"{'reglage':<48}{'EUR/mois':>10}{'facteur':>9}")
    print("-" * 67)
    ref = None
    for lab, e in [("tout `none` — plancher",            {"S":"none","M":"none","L":"none"}),
                   ("tout `low`",                        {"S":"low","M":"low","L":"low"}),
                   ("tout `medium` — DEFAUT DE L'API",   {"S":"medium","M":"medium","L":"medium"}),
                   ("RETENU : S=none, M=low, L=medium",  {"S":"none","M":"low","L":"medium"}),
                   ("tout `high` — plafond de derapage", {"S":"high","M":"high","L":"high"})]:
        sauve = dict(EFFORT); EFFORT.update(e)
        c = EUR(total(pile, OPT))
        EFFORT.clear(); EFFORT.update(sauve)
        if ref is None: ref = c
        print(f"{lab:<48}{c:>10.2f}{c/ref:>8.1f}x")

if __name__ == "__main__":
    if "--effort" in sys.argv:
        effort()
    elif "--piles" in sys.argv:
        piles()
    else:
        main()
        if "--sensi" in sys.argv:
            print(); sensi()

