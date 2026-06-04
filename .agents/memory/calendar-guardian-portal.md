---
name: Guardian Portal - Calendário Escolar
description: Dynamic calendar screen driven by schoolModuloInfantil flag; creche vs colégio tab switching; multimedia security; localStorage cache pattern.
---

## Rule
The `avaliacoes` sidebar item is a unified calendar entry-point for both colégios and creches. Context is driven by `schoolModuloInfantil` (fetched from `/guardian/infant/status`).

**Creche tabs:** Rotinas Diárias | Alimentação | Galeria  
**Colégio tabs:** Calendário de Provas | Horário de Aulas (+ Galeria de Momentos section rendered below both)

## calSub union type
`"provas"|"horario"|"rotinas"|"ementa"|"galeria"` — keep all 5 values in the union. Default "provas" for colégio; set "rotinas" when schoolModuloInfantil=true.

## Cache pattern (localStorage, 7-day TTL)
- `calCache<T>(key)` / `calCacheSet(key, data)` helpers at module level in encarregado.tsx
- Serve cached data immediately as initial useState value → background fetch updates state + cache
- Horário: `kw_c_h_{school_id}`, Provas: `kw_c_p_{school_id}`
- Rotinas: `kw_c_r_{token.slice(-8)}`, Ementa: `kw_c_e_{token.slice(-8)}_{semana}`

## Multimedia security (InfantGaleriaScreen)
Apply all of these to prevent user downloading media:
- Container: `select-none`, `onContextMenu={e => e.preventDefault()}`
- Images: `draggable={false}`, `onContextMenu`, `pointer-events-none` className
- Videos: `controlsList="nodownload nofullscreen"`, `disablePictureInPicture`, `onContextMenu`

**Why:** School photos/videos are private to enrolled families; the school explicitly requires download prevention.
