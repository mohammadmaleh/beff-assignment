# Domain Context — Ubiquitous Language

The vocabulary this codebase uses. Schema columns, API fields, UI labels and test
names all draw from here, so the same concept has one name everywhere.

A reviewer at a battery company will read the dashboard. Terms and magnitudes need to
be plausible — this file is what keeps them honest.

> Terminology verified against [RWTH Aachen PEM's battery cell production
> documentation](https://www.pem.rwth-aachen.de/global/show_document.asp?id=aaaaaaaaabdqbtk),
> [Kadant DCF](https://dcf.kadant.com/en/blog/what-is-the-calendering-process-in-lithium-ion-battery-production)
> and [Thermo Fisher](https://www.thermofisher.com/blog/materials/how-lithium-ion-battery-manufacturers-can-conquer-separator-film-coating-and-calendering/).

---

## The product

**Beff** gives battery cell manufacturers visibility into pilot-line and production
data — where yield is lost, what it costs in scrap, and what it means for CO₂ per kWh.

The user is a **process engineer**, **quality engineer** or **production manager** at a
cell manufacturer or an OEM running a pilot line. They are technical, time-poor, and
already drowning in spreadsheets. They do not need to be impressed; they need to find
the problem.

---

## Cell production process

Ordered. `process_step` values in the schema use these keys.

| Key | Step | What happens |
|---|---|---|
| `mixing` | Mixing | Active material, binder and solvent are blended into a slurry |
| `coating` | Coating | Slurry is applied to metal foil — copper for anode, aluminium for cathode |
| `drying` | Drying | Solvent is driven off under controlled conditions |
| `calendering` | Calendering | Coated electrode is compressed under high load, reducing thickness and setting porosity to ~30–35% |
| `slitting` | Slitting | Wide coated web is cut into electrode-width strips |
| `die_cutting` | Die cutting | Electrode sheets are cut to final shape |
| `stacking` | Stacking / winding | Anode, separator and cathode are assembled into a cell stack |
| `welding` | Tab welding | Current collector tabs are joined |
| `filling` | Electrolyte filling | Cell is filled and sealed |
| `formation` | Formation | First controlled charge/discharge cycles — where the SEI layer forms |
| `aging` | Aging | Cells rest under monitoring; self-discharge outliers are caught here |
| `eol_test` | End-of-line test | Final capacity and safety verification |

**Why this ordering matters in the UI:** scrap discovered at `formation` is far more
expensive than scrap at `coating`, because all the upstream value is already committed.
The scrap breakdown chart is ordered by process step for exactly this reason, and late-
stage scrap is visually weighted.

---

## Metrics

| Term | Definition | Units | Plausible range |
|---|---|---|---|
| **First-pass yield (FPY)** | Cells passing end-of-line test without rework, as a share of cells started | % | 85–97% mature line; 40–80% pilot line |
| **Scrap rate** | Material or cells discarded, by process step | % | 1–8% per step |
| **Capacity retention** | Remaining capacity after N cycles, relative to initial | % | ~80% at 1000 cycles is a common EOL threshold |
| **C-rate** | Charge/discharge current relative to nominal capacity. 1C fully charges in ~1h | C | 0.05C formation, 1–3C testing |
| **State of health (SoH)** | Present capacity as a fraction of rated capacity | % | 100% new, 80% end of automotive life |
| **Energy density** | Energy per unit mass | Wh/kg | 150–300 Wh/kg for current Li-ion |
| **Areal loading** | Active material per unit electrode area | mg/cm² | 10–30 mg/cm² |
| **Porosity** | Void fraction in the calendered electrode | % | 30–35% after calendering |
| **CO₂ intensity** | Emissions per unit energy produced | kg CO₂e/kWh | 40–120 kg CO₂e/kWh depending on grid |

**Never invent numbers outside these ranges.** A 99.8% first-pass yield on a pilot line
is not impressive, it is obviously wrong, and it discredits everything around it.

---

## Organisational terms

| Term | Meaning |
|---|---|
| **Plant** | A physical manufacturing site |
| **Line** | A production line within a plant. A plant has many |
| **Batch** | A production run sharing material lot and process parameters. The unit of traceability |
| **Pilot line** | Low-volume line for process development. Lower yield is expected and normal |
| **Cell format** | Physical form: pouch, prismatic, cylindrical (e.g. 21700) |

---

## Product terms

| Term | Meaning |
|---|---|
| **Waitlist entry** | A pre-launch signup from the landing page. Not yet a user |
| **Onboarding** | The post-registration wizard capturing role, plant and line setup, and units |
| **Offboarding** | Account deletion. The brief names this explicitly; it is GDPR erasure |

---

## Privacy terms

Used precisely — these have legal meaning, and using them loosely in a German context
is worse than not using them.

| Term | Meaning |
|---|---|
| **Personal data** | Anything identifying a natural person. **Includes IP addresses** |
| **Data subject** | The person the data is about — here, the user |
| **DSAR** | Data Subject Access Request. Must be answered within **one month** |
| **Legal basis** | The Art. 6 justification for processing: consent, contract, legal obligation, legitimate interest |
| **Consent** | Freely given, specific, informed, unambiguous. Withdrawable as easily as given |
| **Erasure** | Art. 17, "right to be forgotten" |
| **Portability** | Art. 20 — a machine-readable copy the user can take elsewhere |
| **Anonymisation** | Irreversibly severing data from a person. **Anonymised data leaves GDPR scope**; pseudonymised data does not |
| **Retention period** | How long a data category is kept, and on what basis |

---

## Naming rules

- Process steps use the keys in the table above, never prose variants
  (`die_cutting`, not `dieCut` or `Die Cutting`).
- Percentages are stored as `NUMERIC` in the range 0–100, not 0–1. The column name
  ends in `_pct` so the unit is unambiguous at the call site.
- Timestamps are `TIMESTAMPTZ` and end in `_at`.
- Never abbreviate in schema or API field names. `capacity_retention_pct`, not `cap_ret`.
