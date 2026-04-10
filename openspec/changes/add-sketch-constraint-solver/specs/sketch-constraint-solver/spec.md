## ADDED Requirements

### Requirement: Sketch solving SHALL be implemented as a sketch-only 2D constraint subsystem
The system SHALL provide a dedicated 2D sketch solver that consumes authored sketch definitions and produces solved sketch geometry using only the sketch contract types, without importing kernel-specific modules or frontend interaction state.

#### Scenario: Modeling code requests a solve
- **WHEN** the modeling boundary issues a sketch solve request
- **THEN** the solve math is executed by a dedicated sketch-only subsystem that depends only on sketch-contract data and numeric helpers

#### Scenario: Solver module is tested directly
- **WHEN** a unit test constructs an authored sketch definition with supported constraints and dimensions
- **THEN** the sketch solver can validate and solve that definition without requiring kernel adapters, viewport state, or editor sessions

### Requirement: Sketch solver SHALL support analytical least-squares evaluation for supported authored constraints
The system SHALL evaluate supported sketch constraints and dimensions as explicit solver-owned loss terms with analytical gradients over the sketch parameter vector, so convergence behavior is deterministic and testable.

#### Scenario: Supported line and point constraints are present
- **WHEN** the authored sketch contains supported distance, angle, coincidence, horizontal, vertical, parallel, perpendicular, equal-length, or arc-endpoint constraints
- **THEN** the solver evaluates those authored facts as explicit loss terms and uses their analytical gradients during iteration

#### Scenario: A supported driving dimension is present
- **WHEN** the authored sketch contains a supported distance or radius dimension
- **THEN** the solver treats that authored dimension as a driving solve term and reports the solved value in the solved snapshot

### Requirement: Sketch solver SHALL expose deterministic solve outcomes through the existing solved-sketch contract
The system SHALL return solved points, solved entities, per-constraint statuses, per-dimension statuses, and machine-readable solve state using the existing solved sketch schema.

#### Scenario: Solve converges for a valid constrained sketch
- **WHEN** the solver reaches a valid low-loss solution for a supported authored sketch
- **THEN** the response reports `solveState: solved`, returns authoritative solved geometry, and reports satisfied/driving statuses for the solved authored constraints and dimensions

#### Scenario: Solve cannot satisfy the authored system fully
- **WHEN** the solver detects invalid input, inconsistent constraints, or non-convergent results
- **THEN** it returns machine-readable diagnostics and an appropriate solved-sketch status instead of inventing unsourced geometry
