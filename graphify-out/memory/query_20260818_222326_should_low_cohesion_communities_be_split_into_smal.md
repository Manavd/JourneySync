---
type: "query"
date: "2026-08-18T22:23:26.877906+00:00"
question: "Should low-cohesion communities be split into smaller modules?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["Trip Data Model (Shared)", "Live Flight Provider Integration"]
---

# Q: Should low-cohesion communities be split into smaller modules?

## Answer

Not automatically. graphify's cohesion score is raw edge density (internal_edges / C(n,2)), which mechanically decays toward 0 as community size grows even for a genuinely well-formed, densely-internally-connected cluster. Verified: Trip Data Model (Shared) n=153, 795 internal edges, density 0.0684 exactly matches reported cohesion 0.0684. Live Flight Provider Integration (n=64, 127 internal edges, 0 external edges - fully self-contained) also matches this pattern and should NOT be split; it is a clean module boundary. Only split on independent semantic evidence (inspecting actual member labels for unrelated topics), not on the cohesion score alone for communities above roughly 30-40 nodes.

## Outcome

- Signal: useful

## Source Nodes

- Trip Data Model (Shared)
- Live Flight Provider Integration